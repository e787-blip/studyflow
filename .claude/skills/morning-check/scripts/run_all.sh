#!/usr/bin/env bash
# The StudyFlow morning suite: parse every page, then drive real page loads of
# lesson.html and app.html in Chromium with api/generate mocked. Prints one
# line per check and a summary; exits 1 if anything failed.
#   bash .claude/skills/morning-check/scripts/run_all.sh [out-dir]
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
OUT="${1:-/tmp/sf-morning}"
mkdir -p "$OUT"; cd "$OUT" || exit 2
PORT=8765
if ! curl -s -o /dev/null "http://localhost:$PORT/lesson.html"; then
  (cd "$REPO" && python3 -m http.server $PORT >"$OUT/server.log" 2>&1 &)
  for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null "http://localhost:$PORT/lesson.html" && break; sleep 1; done
fi
export SF_BASE="http://localhost:$PORT/"
FAILS=0; SUMMARY=""
note() { SUMMARY="$SUMMARY
$1"; echo "$1"; }
check() {  # name, pass-pattern, command...
  local name="$1" pass="$2"; shift 2
  local log="$OUT/$name.log"
  timeout 300 "$@" >"$log" 2>&1
  if grep -qE "FAIL|pageerror|TypeError|ReferenceError|SyntaxError|ERR_CONNECTION|card not found|no walkthrough" "$log" || ! grep -qE "$pass" "$log"; then
    FAILS=$((FAILS+1)); note "FAIL  $name   (see $log)"; grep -E "FAIL|Error|not found" "$log" | head -5 | sed 's/^/        /'
  else note "ok    $name"; fi
}
# 1. Every script block parses (login.html's module script is checked as a module).
node "$HERE/parsecheck.js" "$REPO/lesson.html" "$REPO/app.html" "$REPO/dashboard.html" "$REPO/index.html" >"$OUT/parse.log" 2>&1
python3 - "$REPO" "$OUT" <<'PY'
import re,sys,os
repo,out=sys.argv[1],sys.argv[2]
for f in os.listdir(repo):
    if not f.endswith('.html') or f in ('lesson.html','app.html','dashboard.html','index.html'): continue
    s=open(os.path.join(repo,f),encoding='utf8').read()
    for i,m in enumerate(re.finditer(r'<script([^>]*)>([\s\S]*?)</script>',s)):
        if 'src=' in m.group(1): continue
        ext='mjs' if 'module' in m.group(1) else 'js'
        open(os.path.join(out,'blk_%s_%d.%s'%(f,i,ext)),'w').write(m.group(2))
PY
for b in "$OUT"/blk_*; do node --check "$b" >>"$OUT/parse.log" 2>&1 && echo "$(basename "$b") OK" >>"$OUT/parse.log" || echo "$(basename "$b") FAIL" >>"$OUT/parse.log"; done
node --check "$REPO/sf-draw.js" >>"$OUT/parse.log" 2>&1 && echo "sf-draw.js OK" >>"$OUT/parse.log" || echo "sf-draw.js FAIL" >>"$OUT/parse.log"
for a in "$REPO"/api/*.js; do node --check "$a" >>"$OUT/parse.log" 2>&1 || echo "$(basename "$a") FAIL" >>"$OUT/parse.log"; done
if grep -q FAIL "$OUT/parse.log"; then FAILS=$((FAILS+1)); note "FAIL  parse"; grep FAIL "$OUT/parse.log" | sed 's/^/        /'; else note "ok    parse (every page, sf-draw.js, api/*.js)"; fi
# 2. Behaviour, on real page loads.
check edges        "ALL EDGE CASES PASS"   node "$HERE/test_edges.js"
check walk         "WALK CLEAN"            node "$HERE/test_walk.js"
check captions     "CAPTIONS OK"           node "$HERE/test_caption.js"
check recall       "no page errors"        node "$HERE/test_recall.js"
check moment       "no page errors"        node "$HERE/test_moment.js"
check on_the_spot  "ON-THE-SPOT OK"        node "$HERE/test_ontheSpot.js"
check predraw      "PREDRAW OK"            node "$HERE/test_predraw.js"
check auto_cap     "no page errors"        node "$HERE/test_cap.js"
check app_predraw  "APP PREDRAW OK"        node "$HERE/test_appdraw.js"
check walk_label   "no page errors"        node "$HERE/walk_pic.js" label wl
check walk_picture "no page errors"        node "$HERE/walk_pic.js" veins wv
check walk_model   "no page errors"        node "$HERE/walk_model.js"
check board_sizes  "no page errors"        node "$HERE/board_sizes2.js"
check slide        "no errors"             node "$HERE/slide_check.js"
check review_change "REVIEW CHANGE OK"     node "$HERE/test_review_change.js"
check mix          "MIX OK"                node "$HERE/test_mix.js"
check visuals      "VISUALS OK"            node "$HERE/test_visuals.js"
# 3. The picture budget: at most 30% of question cards, never the same picture twice.
FX="$HERE/bigday" timeout 300 node "$HERE/census.js" 0 >"$OUT/census.log" 2>&1
PCT=$(grep -oE "\(([0-9]+)%\)" "$OUT/census.log" | tr -dc 0-9); REP=$(grep -oE "repeated pictures: [0-9]+" "$OUT/census.log" | tr -dc 0-9)
if [ -n "$PCT" ] && [ "$PCT" -le 30 ] && [ "$REP" = "0" ] && grep -q "no page errors" "$OUT/census.log"; then note "ok    picture budget ($PCT% of cards, 0 repeats)"; else FAILS=$((FAILS+1)); note "FAIL  picture budget (pct=$PCT repeats=$REP, see $OUT/census.log)"; fi
# 4. Every diagram renders exactly as the audited baseline.
timeout 300 node "$HERE/dg_regress.js" "$OUT/diagrams.json" >"$OUT/diagrams.log" 2>&1
if cmp -s "$HERE/diagram_baseline.json" "$OUT/diagrams.json"; then note "ok    diagram regression (identical to baseline)"; else FAILS=$((FAILS+1)); note "FAIL  diagram regression: output differs from diagram_baseline.json (diff it; update the baseline only for an intended, looked-at change)"; fi
echo; echo "=== $FAILS failed. Logs and screenshots in $OUT ==="
[ "$FAILS" -eq 0 ]
