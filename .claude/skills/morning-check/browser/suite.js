/* The run_all.sh check list, run in this tab through pwshim.js. Same pass/fail
   rule as run_all.sh: a log fails on FAIL|pageerror|TypeError|ReferenceError|
   SyntaxError|ERR_CONNECTION|card not found|no walkthrough, or when the pass
   pattern is missing. Parsing (parseall.js under JavaScriptCore) and the
   diagram baseline comparison (cmp against the file dg_regress writes to the
   server's out folder) happen outside the browser - see ../SKILL.md. */
(function () {
  var S = '/.claude/skills/morning-check/scripts/';
  var CHECKS = [
    ['edges', 'ALL EDGE CASES PASS', S + 'test_edges.js'],
    ['walk', 'WALK CLEAN', S + 'test_walk.js'],
    ['captions', 'CAPTIONS OK', S + 'test_caption.js'],
    ['recall', 'no page errors', S + 'test_recall.js'],
    ['moment', 'no page errors', S + 'test_moment.js'],
    ['on_the_spot', 'ON-THE-SPOT OK', S + 'test_ontheSpot.js'],
    ['predraw', 'PREDRAW OK', S + 'test_predraw.js'],
    ['auto_cap', 'no page errors', S + 'test_cap.js'],
    ['app_predraw', 'APP PREDRAW OK', S + 'test_appdraw.js'],
    ['walk_label', 'no page errors', S + 'walk_pic.js', ['label', 'wl']],
    ['walk_picture', 'no page errors', S + 'walk_pic.js', ['veins', 'wv']],
    ['walk_model', 'no page errors', S + 'walk_model.js'],
    ['board_sizes', 'no page errors', S + 'board_sizes2.js'],
    ['slide', 'no errors', S + 'slide_check.js'],
    ['review_change', 'REVIEW CHANGE OK', S + 'test_review_change.js'],
    ['mix', 'MIX OK', S + 'test_mix.js'],
    ['visuals', 'VISUALS OK', S + 'test_visuals.js'],
    ['eqcard', 'EQCARD OK', S + 'test_eqcard.js'],
    ['language', 'LANGUAGE OK', S + 'test_language.js'],
    ['languages', 'LANGUAGES OK', S + 'test_languages.js'],
    ['history', 'HISTORY OK', S + 'test_history.js'],
    ['newtypes', 'NEWTYPES OK', S + 'test_newtypes.js'],
    ['draw_on', 'DRAWON OK', S + 'test_drawon.js'],
    ['icons', 'ICONS OK', S + 'test_icons.js'],
    ['topics_rules', 'TOPICS OK', '/.claude/skills/subtopics/scripts/check_topics.js'],
    ['topics_page', 'TOPICS PAGE OK', S + 'test_topics.js'],
    ['e2e_cards', 'E2E CARDS OK', S + 'test_e2e_cards.js'],
    ['census', '__census__', S + 'census.js', ['0'], { FX: S + 'bigday' }],
    ['diagrams', '__any__', S + 'dg_regress.js', ['diagrams.json']]
  ];
  var BAD = /FAIL|pageerror|TypeError|ReferenceError|SyntaxError|ERR_CONNECTION|card not found|no walkthrough/;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  window.__suite = { results: [], running: false };
  window.runSuite = async function (only) {
    var st = window.__suite; st.results = []; st.running = true; st.started = Date.now();
    for (var i = 0; i < CHECKS.length; i++) {
      var c = CHECKS[i];
      if (only && only.indexOf(c[0]) < 0) continue;
      st.current = c[0];
      var id = runTest(c[2], c[3] || [], c[4] || {});
      var t0 = Date.now();
      while (!__runs[id].done && Date.now() - t0 < 300000) await sleep(250);
      var r = __runs[id], log = r.lines.join('\n'), ok;
      if (c[1] === '__census__') {
        var pct = (/\((\d+)%\)/.exec(log) || [])[1], rep = (/repeated pictures: (\d+)/.exec(log) || [])[1];
        ok = pct != null && +pct <= 30 && rep === '0' && /no page errors/.test(log);
      } else if (c[1] === '__any__') ok = r.done && !/UNCAUGHT/.test(log);
      else ok = r.done && !BAD.test(log) && new RegExp(c[1]).test(log);
      if (!r.done) log += '\nTIMED OUT';
      st.results.push({ name: c[0], ok: ok, ms: Date.now() - t0, bad: ok ? [] : r.lines.filter(function (l) { return BAD.test(l) || /UNCAUGHT|TIMED OUT/.test(l); }).slice(0, 8), log: log });
      // close any page a failed test left behind
      Array.prototype.slice.call(document.querySelectorAll('#stage iframe')).forEach(function (f) { f.remove(); });
    }
    st.running = false; st.current = null; st.ms = Date.now() - st.started;
    return window.suiteSummary();
  };
  window.suiteSummary = function () {
    var st = window.__suite;
    return { running: st.running, current: st.current, failed: st.results.filter(function (r) { return !r.ok; }).length,
      lines: st.results.map(function (r) { return (r.ok ? 'ok    ' : 'FAIL  ') + r.name + ' (' + Math.round(r.ms / 1000) + 's)' + (r.ok ? '' : '\n        ' + r.bad.join('\n        ')); }) };
  };
})();
