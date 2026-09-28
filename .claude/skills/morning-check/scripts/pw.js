// Playwright from wherever this machine has it: the project's node_modules,
// or the cloud image's global install.
module.exports = (function () {
  try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
})();
