#!/usr/bin/env python3
"""Run the idea reader's prompt (and today's subtopic prompt) through real models.

    python3 .claude/skills/subject-reader/scripts/run_models.py            # dry run: prompts only, no API calls
    python3 .claude/skills/subject-reader/scripts/run_models.py --go       # makes the calls (costs a little)

    --models a,b,c   default: the model the app uses now, haiku 5.5, sonnet 5.5
    --notes DIR      your own notes: DIR/<name>.txt, optional first lines
                     "# subject: ...", "# family: general", "# days: 5"
    --only NAME      one subject (a part of its name)
    --no-old         skip today's prompt (halves the calls)
    --out DIR        default: the scratchpad-style folder ./subject-reader-out

Needs ANTHROPIC_API_KEY in the environment for --go. Standard library only;
the logic runs through Node, or macOS's JavaScriptCore if Node is missing.
Calls the Anthropic API directly with the same system prompt api/generate.js
sends, so the comparison matches what the app would do.
"""
import argparse, json, os, re, shutil, subprocess, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
JSC = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc'
NODERUN = os.path.join(REPO, '.claude', 'skills', 'morning-check', 'browser', 'noderun.js')
DEFAULT_MODELS = ['claude-haiku-4-5-20251001', 'claude-haiku-5-5', 'claude-sonnet-5-5']


def run_js(script, *args):
    node = shutil.which('node')
    cmd = [node, script] + list(args) if node else [JSC, NODERUN, '--', script] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or 'UNCAUGHT' in r.stdout:
        sys.exit('script failed: ' + ' '.join(cmd) + '\n' + r.stdout[-1500:] + r.stderr[-1500:])
    return r.stdout


def system_prompt():
    """The system prompt api/generate.js sends, read from the file so it cannot drift."""
    src = open(os.path.join(REPO, 'api', 'generate.js'), encoding='utf-8').read()
    m = re.search(r"system:\s*\[(.*?)\]\.join\(' '\)", src, re.S)
    if not m:
        sys.exit('could not find the system prompt in api/generate.js - did it move?')
    parts = re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1))
    return ' '.join(p.replace("\\'", "'") for p in parts)


def load_subjects(notes_dir):
    if not notes_dir:
        return json.load(open(os.path.join(HERE, 'sample_notes.json'), encoding='utf-8'))
    out = []
    for fn in sorted(os.listdir(notes_dir)):
        if not fn.endswith('.txt'):
            continue
        text = open(os.path.join(notes_dir, fn), encoding='utf-8').read()
        meta = {'subject': fn[:-4].replace('-', ' '), 'family': 'general', 'days': '5'}
        while text.startswith('#'):
            line, _, text = text.partition('\n')
            k, _, v = line[1:].partition(':')
            meta[k.strip().lower()] = v.strip()
        out.append({'name': fn[:-4], 'subject': meta['subject'], 'localType': meta['family'],
                    'days': int(meta['days'] or 5), 'notes': text.strip()})
    return out


def call(model, system, prompt, key):
    body = json.dumps({'model': model, 'max_tokens': 8096, 'system': system,
                       'messages': [{'role': 'user', 'content': prompt[:60000]}]}).encode()
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body, method='POST', headers={
        'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
        return ''.join(b.get('text', '') for b in data.get('content', [])), time.time() - t, None
    except urllib.error.HTTPError as e:
        return '', time.time() - t, 'HTTP %s %s' % (e.code, e.read()[:200].decode('utf-8', 'replace'))
    except Exception as e:  # network, timeout
        return '', time.time() - t, str(e)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--go', action='store_true')
    ap.add_argument('--models', default=','.join(DEFAULT_MODELS))
    ap.add_argument('--notes')
    ap.add_argument('--only')
    ap.add_argument('--no-old', action='store_true')
    ap.add_argument('--out', default=os.path.join(os.getcwd(), 'subject-reader-out'))
    a = ap.parse_args()

    models = [m for m in a.models.split(',') if m]
    subjects = [s for s in load_subjects(a.notes) if not a.only or a.only.lower() in s['name'].lower()]
    if not subjects:
        sys.exit('no subjects matched')
    os.makedirs(a.out, exist_ok=True)
    sj = os.path.join(a.out, 'subjects.json')
    json.dump(subjects, open(sj, 'w'))
    prompts = json.loads(run_js(os.path.join(HERE, 'make_prompts.js'), sj))

    kinds = ['new'] + ([] if a.no_old else ['old'])
    calls = len(subjects) * len(models) * len(kinds)
    print('%d subject(s) x %d model(s) x %d prompt(s) = %d call(s)' % (len(subjects), len(models), len(kinds), calls))
    for s in subjects:
        p = prompts[s['name']]
        print('  %-24s new prompt %5d chars, old prompt %5d chars' % (s['name'], len(p['newPrompt']), len(p['oldPrompt'])))
    if not a.go:
        print('\nDry run - nothing was sent. Add --go to make the calls (needs ANTHROPIC_API_KEY).')
        return
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        sys.exit('ANTHROPIC_API_KEY is not set')

    system = system_prompt()
    results = []
    for s in subjects:
        for m in models:
            for kind in kinds:
                prompt = prompts[s['name']]['newPrompt' if kind == 'new' else 'oldPrompt']
                text, secs, err = call(m, system, prompt, key)
                fn = os.path.join(a.out, '%s.%s.%s.json' % (s['name'], re.sub(r'[^a-z0-9.]+', '-', m), kind))
                open(fn, 'w', encoding='utf-8').write(text)
                results.append({'name': s['name'], 'ctx': prompts[s['name']]['ctx'], 'model': m, 'kind': kind,
                                'seconds': secs, 'file': fn, 'error': err})
                print('  %-22s %-28s %s  %.1fs%s' % (s['name'], m, kind, secs, '  ' + err if err else ''))
    json.dump(results, open(os.path.join(a.out, 'results.json'), 'w'))
    print('\n' + run_js(os.path.join(HERE, 'report.js'), a.out))
    print('Raw answers are in ' + a.out)


if __name__ == '__main__':
    main()
