// Minimal Node shim for JavaScriptCore: enough of require/fs/path/vm/process
// to run the repo's pure-logic test scripts (no Playwright).
var __argv = (typeof arguments !== 'undefined') ? arguments : [];
var console = { log: function () { print(Array.prototype.map.call(arguments, function (a) { return typeof a === 'string' ? a : JSON.stringify(a); }).join(' ')); } };
console.error = console.warn = console.log;
var process = { exitCode: 0, argv: ['node', __argv[0]].concat(Array.prototype.slice.call(__argv, 1)), env: {}, exit: function (c) { throw { __exit: c }; } };
function __dirnameOf(p) { return p.replace(/\/[^\/]*$/, ''); }
var __path = {
  join: function () { return Array.prototype.join.call(arguments, '/').replace(/\/+/g, '/'); },
  dirname: __dirnameOf,
  resolve: function () {
    var parts = [], args = Array.prototype.slice.call(arguments);
    var full = args.reduce(function (acc, a) { return a.charAt(0) === '/' ? a : acc + '/' + a; }, '');
    full.split('/').forEach(function (s) { if (!s || s === '.') return; if (s === '..') parts.pop(); else parts.push(s); });
    return '/' + parts.join('/');
  }
};
var __fs = { readFileSync: function (p) { return readFile(p); }, existsSync: function (p) { try { readFile(p); return true; } catch (e) { return false; } } };
var __vm = {
  createContext: function (c) { return c; },
  runInContext: function (code, ctx) { var keys = Object.keys(ctx); return Function.apply(null, keys.concat([code])).apply(null, keys.map(function (k) { return ctx[k]; })); },
  runInNewContext: function (code) { return (0, eval)(code); }
};
var __modCache = {};
function __makeRequire(dir) {
  return function (name) {
    if (name === 'fs') return __fs; if (name === 'path') return __path; if (name === 'vm') return __vm;
    var file = __path.resolve(dir, name); if (!/\.js$/.test(file)) file += '.js';
    if (__modCache[file]) return __modCache[file].exports;
    var module = { exports: {} }; __modCache[file] = module;
    var src = readFile(file);
    (new Function('require', 'module', 'exports', '__dirname', '__filename', 'console', 'process', src))(__makeRequire(__dirnameOf(file)), module, module.exports, __dirnameOf(file), file, console, process);
    return module.exports;
  };
}
try { __makeRequire('/')(__path.resolve(__argv[0])); } catch (e) { if (!e || e.__exit === undefined) { print('UNCAUGHT ' + e + '\n' + (e && e.stack)); process.exitCode = 1; } }
