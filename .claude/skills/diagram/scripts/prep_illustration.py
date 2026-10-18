"""Build illustrations/*.svg from Wikimedia Commons files listed in
references/illustrations.json.

    python3 -I .claude/skills/diagram/scripts/prep_illustration.py [id ...]

Needs the morning-check harness server on 8766 (it serves the repo and takes
/__write) and Google Chrome. For each item:

  1. download the file and read its licence and author from Commons (never typed by hand);
  2. clean it here: no metadata, editor cruft, comments, DOCTYPE entities, scripts,
     <image>, <foreignObject>, on* handlers or external links;
  3. a headless Chrome pass (prep-illustration.html) measures every label after all
     transforms, translates, re-emits the labels in one phone-sized style with the key
     ones bold (the labelling card's pins), crops to the drawing and bakes the credit in;
  4. sanitise again with an allowlist and round every number, then write
     illustrations/<id>.svg and the generated credit block in sf-library.js.

LOOK at every result (illustration-preview or a lesson card) before shipping it.
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
CONF = os.path.join(HERE, '..', 'references', 'illustrations.json')
OUTDIR = os.path.join(REPO, 'illustrations')
STAGE = os.path.join(OUTDIR, '.stage')
CACHE = os.path.join(tempfile.gettempdir(), 'sf-illustration-cache')
SERVER = 'http://localhost:8766'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
UA = 'StudyFlowIllustrationPrep/1.0 (educational app; github e787-blip)'
BUDGET_KB = 80          # gzipped, which is what Vercel sends


def http(url, data=None, tries=5):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # 429s back off
            err = e
            time.sleep(5 * (i + 1))
    raise err


def fetch(title):
    os.makedirs(CACHE, exist_ok=True)
    safe = re.sub(r'[^A-Za-z0-9._-]', '_', title)
    mp, fp = os.path.join(CACHE, safe + '.json'), os.path.join(CACHE, safe)
    if os.path.exists(mp) and os.path.exists(fp):
        return open(fp, encoding='utf8', errors='replace').read(), json.load(open(mp))
    q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'titles': 'File:' + title, 'prop': 'imageinfo',
                                'iiprop': 'url|extmetadata', 'iiextmetadatafilter': 'LicenseShortName|Artist|LicenseUrl'})
    p = list(json.loads(http('https://commons.wikimedia.org/w/api.php?' + q))['query']['pages'].values())[0]
    ii = p['imageinfo'][0]
    m = ii['extmetadata']
    meta = {'title': title, 'page': 'https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(title.replace(' ', '_')),
            'license': m.get('LicenseShortName', {}).get('value', ''),
            'licenseUrl': m.get('LicenseUrl', {}).get('value', ''),
            'author': re.sub(r'\s+', ' ', re.sub('<[^>]+>', '', m.get('Artist', {}).get('value', ''))).strip()}
    time.sleep(2)
    body = http(ii['url']).decode('utf8', 'replace')
    open(fp, 'w', encoding='utf8').write(body)
    json.dump(meta, open(mp, 'w'))
    time.sleep(2)
    return body, meta


def clean(s):
    # DOCTYPE entities (Illustrator files) are substituted, then the DOCTYPE goes.
    ents = dict(re.findall(r'<!ENTITY\s+(\w+)\s+"([^"]*)"\s*>', s))
    for k, v in ents.items():
        s = s.replace('&' + k + ';', v)
    s = re.sub(r'<\?xml[^>]*\?>|<!DOCTYPE[\s\S]*?\]>\s*|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->', '', s)
    for tag in ('metadata', 'sodipodi:namedview', 'script', 'foreignObject', 'title', 'desc', 'i:pgf'):
        s = re.sub(r'<%s\b[\s\S]*?</%s>' % (tag, tag), '', s)
        s = re.sub(r'<%s\b[^>]*/>' % tag, '', s)
    s = re.sub(r'<image\b[\s\S]*?(/>|</image>)', '', s)
    # Any element in an editor's namespace (inkscape:path-effect, sodipodi:guide...) is not drawing.
    s = re.sub(r'<((?!svg:|xlink:)[a-z]+:[\w-]+)\b[^>]*/>', '', s)
    s = re.sub(r'<((?!svg:|xlink:)[a-z]+:[\w-]+)\b[^>]*>[\s\S]*?</\1>', '', s)
    # Editor attributes only: a namespace PREFIX and a colon. (Without the colon this
    # matched id, x, x1 and x2 and scattered the drawing.)
    s = re.sub(r'\s(?:inkscape|sodipodi|i|x|graph|a|dc|cc|rdf):[\w-]+="[^"]*"', '', s)
    s = re.sub(r'\sxmlns:(?!xlink)\w+="[^"]*"', '', s)
    s = re.sub(r'\son\w+\s*=\s*"[^"]*"', '', s)
    s = re.sub(r'(xlink:href|href)="(?!#)[^"]*"', '', s)
    return s.strip()


ALLOWED = set('svg g switch path rect circle ellipse line polyline polygon text tspan defs lineargradient radialgradient stop '
              'clippath mask pattern use symbol marker filter fegaussianblur feoffset feblend fecolormatrix '
              'fecomposite feflood femerge femergenode'.split())


def sanitise(s):
    bad = [t for t in re.findall(r'<([A-Za-z][\w:-]*)', s) if t.lower() not in ALLOWED]
    if bad:
        raise SystemExit('refusing: unexpected elements ' + ', '.join(sorted(set(bad))))
    s = re.sub(r'\son\w+\s*=\s*"[^"]*"', '', s)
    s = re.sub(r'(xlink:href|href)="(?!#)[^"]*"', '', s)
    s = re.sub(r'url\((?!#)[^)]*\)', 'none', s)
    if re.search(r'javascript:|<script|data:', s, re.I):
        raise SystemExit('refusing: script or data URL survived')
    return s


def shrink(s, vbw):
    nd = 2 if vbw < 200 else 1     # never whole numbers: relative path steps drift

    def rnd(m):
        v = round(float(m.group(0)), nd)
        t = ('%.*f' % (nd, v)).rstrip('0').rstrip('.') if nd else str(int(round(v)))
        return '0' if t in ('-0', '') else t

    def tag(m):
        t = m.group(0)
        return re.sub(r'-?\d*\.\d{%d,}(?:e-?\d+)?' % (nd + 1 if nd else 1), rnd, t)
    s = re.sub(r'<[^>]+>', tag, s)
    s = re.sub(r'>\s+<', '><', s)
    return s


def short_author(a):
    a = re.sub(r'^(This SVG image was created by|Created by|Own work by)\s*', '', a, flags=re.I)
    a = re.split(r'[.;]\s|\s\(|,\straduction|,\stranslation', a)[0]
    return a.strip()[:48] or 'Unknown'


def server_out():
    return json.loads(http(SERVER + '/__repo'))['out']


def browser(job, src):
    out = server_out()
    for f in (job['id'] + '.svg', job['id'] + '.report.json', 'prep.done'):
        try: os.remove(os.path.join(out, f))
        except OSError: pass
    prof = tempfile.mkdtemp(prefix='sf-prep-')
    url = SERVER + '/.claude/skills/diagram/scripts/prep-illustration.html?' + urllib.parse.urlencode({'src': src, 'job': json.dumps(job)})
    p = subprocess.Popen([CHROME, '--headless=new', '--no-first-run', '--user-data-dir=' + prof, '--window-size=1200,1200', url],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(120):
            if os.path.exists(os.path.join(out, 'prep.done')): break
            time.sleep(0.5)
    finally:
        p.kill()
    rep = json.load(open(os.path.join(out, job['id'] + '.report.json')))
    if 'error' in rep:
        raise SystemExit(job['id'] + ': ' + rep['error'])
    return open(os.path.join(out, job['id'] + '.svg'), encoding='utf8').read(), rep


def main():
    conf = json.load(open(CONF))
    only = set(sys.argv[1:])
    os.makedirs(STAGE, exist_ok=True)
    credits = []
    for it in conf['items']:
        raw, meta = fetch(it['src'])
        lic = meta['license'] or 'see source'
        author = it.get('author') or short_author(meta['author'])
        credit = 'Illustration: ' + author + ', Wikimedia Commons' + ('' if re.search('public domain|cc0', lic, re.I) else ', ' + lic)
        credits.append({'id': it['id'], 'title': it['title'], 'author': author, 'license': lic,
                        'licenseUrl': meta.get('licenseUrl', ''), 'source': meta['page'], 'credit': credit})
        if only and it['id'] not in only:
            continue
        open(os.path.join(STAGE, it['id'] + '.svg'), 'w', encoding='utf8').write(clean(raw))
        job = {'id': it['id'], 'title': it['title'], 'key': it.get('key', []), 'translate': it.get('translate', {}),
               'drop': it.get('drop', []), 'leave': it.get('leave', []), 'credit': credit}
        svg, rep = browser(job, '/illustrations/.stage/' + it['id'] + '.svg')
        vbw = float(re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+)', svg).group(1))
        svg = shrink(sanitise(svg), vbw)
        svg = svg.replace(' xmlns:xlink="http://www.w3.org/1999/xlink"', '', 1) if 'xlink:' not in svg[200:] else svg
        open(os.path.join(OUTDIR, it['id'] + '.svg'), 'w', encoding='utf8').write(svg)
        import gzip
        kb = len(gzip.compress(svg.encode(), 9)) // 1024
        print('%-20s %4d KB gz %s  labels: %s' % (it['id'], kb, 'OVER BUDGET' if kb > BUDGET_KB else '', ', '.join(rep['labels'][:14])))
        if rep['missingKeys']:
            print('    key labels not found:', ', '.join(rep['missingKeys']))
    # The generated credit list in sf-library.js, between its markers.
    lib = os.path.join(REPO, 'sf-library.js')
    if os.path.exists(lib):
        s = open(lib, encoding='utf8').read()
        block = '/* BEGIN CREDITS (generated by prep_illustration.py) */\n  var CREDITS = ' + \
                json.dumps({c['id']: c for c in credits}, indent=2, ensure_ascii=False).replace('\n', '\n  ') + \
                ';\n  /* END CREDITS */'
        s = re.sub(r'/\* BEGIN CREDITS[\s\S]*?/\* END CREDITS \*/', lambda m: block, s)
        open(lib, 'w', encoding='utf8').write(s)
    for f in os.listdir(STAGE):
        os.remove(os.path.join(STAGE, f))
    os.rmdir(STAGE)


if __name__ == '__main__':
    main()
