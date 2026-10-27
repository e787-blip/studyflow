/* sf-owner.js - accounts that are always VIP.

   The plan a learner is on is `tier` inside `studyflow_user` in localStorage;
   nothing on the server decides it for the pages. So this is a list in code,
   not a security check: it is for the owner's own accounts, and anyone who can
   edit their localStorage can already give themselves a tier.

   Loaded by the pages that read the tier (before their own script), and by
   login.html, which calls SFOwner.is() when it saves the signed-in user so a
   fresh device or a cleared browser comes back as VIP. */
(function () {
  var OWNERS = ['ethanhwang787@gmail.com'];

  function is(email) {
    var e = String(email == null ? '' : email).toLowerCase().replace(/^\s+|\s+$/g, '');
    for (var i = 0; i < OWNERS.length; i++) if (OWNERS[i] === e) return true;
    return false;
  }

  /* Already signed in on this device: lift the stored user now, before the
     page's own script reads the tier. */
  try {
    var raw = window.localStorage.getItem('studyflow_user');
    var u = raw ? JSON.parse(raw) : null;
    if (u && is(u.email) && u.tier !== 'vip') {
      u.tier = 'vip';
      window.localStorage.setItem('studyflow_user', JSON.stringify(u));
    }
  } catch (e) {}

  window.SFOwner = { is: is };
})();
