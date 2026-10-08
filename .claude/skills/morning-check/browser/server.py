"""Static server for running the morning suite in a browser tab (no Node).

  python3 -I .claude/skills/morning-check/browser/server.py [port]

Serves the repo at / and this folder at /__h/. Open /__h/pw.html in the
desktop app's browser pane and call runSuite() - see ../SKILL.md.

- GET  /<path>           a repo file (no caching)
- GET  /__h/<path>       a harness file (kept out of the repo)
- POST /__mock           JSON {rules:[{match, status, body, delay}]} - replaces the rules.
                         `match` is a regex tested against the prompt; first match wins.
                         `body` is returned as JSON. A rule with "none" answers {"result":"none"}.
- GET  /__calls          JSON list of every prompt sent to api/generate since the last reset
- POST /__reset          clear calls and rules
- POST /api/generate     answered from the rules; 500 {"error":"no mock"} when nothing matches
- POST /api/<other>      404 JSON
"""
import json, os, re, sys, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, unquote

HARN = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HARN, '..', '..', '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
STATE = {'rules': [], 'calls': [], 'blocked': []}
import tempfile
OUT = os.path.join(tempfile.gettempdir(), 'sf-morning-browser')
os.makedirs(OUT, exist_ok=True)
HOOK = (b'<script>try{if(window.parent!==window&&window.parent.__sfHook)'
        b'window.parent.__sfHook(window)}catch(e){}</script>')
LOCK = threading.Lock()


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def translate_path(self, path):
        p = unquote(urlparse(path).path)
        if p.startswith('/__h/'):
            base, rest = HARN, p[len('/__h/'):]
        else:
            base, rest = REPO, p.lstrip('/')
        full = os.path.abspath(os.path.join(base, rest))
        if not full.startswith(base):
            return os.path.join(REPO, '__nope__')
        return full

    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _blocked(self):
        p = urlparse(self.path).path
        with LOCK:
            return any(p.endswith(b) for b in STATE['blocked'])

    def send_head(self):
        p = urlparse(self.path).path
        if self._blocked():
            self.send_error(404)
            return None
        full = self.translate_path(self.path)
        if p.endswith('.html') and not p.startswith('/__h/') and os.path.isfile(full):
            data = open(full, 'rb').read()
            m = re.search(rb'<head[^>]*>', data, re.I)
            at = m.end() if m else 0
            data = data[:at] + HOOK + data[at:]
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            import io
            return io.BytesIO(data)
        return super().send_head()

    def do_GET(self):
        if self.path.startswith('/__calls'):
            with LOCK:
                return self._json(200, STATE['calls'])
        if self.path.startswith('/__repo'):
            return self._json(200, {'repo': REPO, 'out': OUT})
        return super().do_GET()

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(n) if n else b''
        path = urlparse(self.path).path
        if path == '/__mock':
            with LOCK:
                STATE['rules'] = json.loads(raw or b'{}').get('rules', [])
            return self._json(200, {'ok': True})
        if path == '/__write':
            from urllib.parse import parse_qs
            name = os.path.basename(parse_qs(urlparse(self.path).query).get('name', ['out.txt'])[0])
            open(os.path.join(OUT, name), 'wb').write(raw)
            return self._json(200, {'ok': True, 'path': os.path.join(OUT, name)})
        if path == '/__block':
            o = json.loads(raw or b'{}')
            with LOCK:
                if o.get('clear'):
                    STATE['blocked'] = []
                if o.get('add'):
                    STATE['blocked'].append(o['add'])
            return self._json(200, {'ok': True})
        if path == '/__reset':
            with LOCK:
                STATE['rules'], STATE['calls'] = [], []
            return self._json(200, {'ok': True})
        if path == '/api/generate':
            try:
                body = json.loads(raw or b'{}')
            except Exception:
                body = {}
            prompt = body.get('prompt') or ''
            with LOCK:
                STATE['calls'].append(prompt)
                rules = list(STATE['rules'])
            for r in rules:
                if re.search(r.get('match', '.'), prompt, re.S):
                    if r.get('delay'):
                        time.sleep(r['delay'] / 1000.0)
                    if r.get('none'):
                        return self._json(200, {'result': 'none'})
                    return self._json(r.get('status', 200), r.get('body', {}))
            return self._json(500, {'error': 'no mock'})
        return self._json(404, {'error': 'not here'})


ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
