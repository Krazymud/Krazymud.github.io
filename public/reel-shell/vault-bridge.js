/* Injected before content.js: vault host may stash JSON in sessionStorage. */
(function () {
  try {
    var raw = sessionStorage.getItem('reel-vault-content')
    if (!raw) return
    var data = JSON.parse(raw)
    if (data && typeof data === 'object') {
      window.CONTENT = data
      window.ROLL_LANG = data.__lang || window.ROLL_LANG || 'zh'
    }
  } catch (e) {}
})()
