/* Inherit vault CONTENT before content.js.
 * Scene iframes each load content.js; they must reuse top.CONTENT / sessionStorage
 * so photos, notes, and lists from the Darkroom host actually appear. */
(function () {
  function fromTop() {
    try {
      if (window.top && window.top !== window && window.top.CONTENT) {
        window.CONTENT = window.top.CONTENT
        return true
      }
    } catch (e) {}
    return false
  }
  function fromParent() {
    try {
      if (window.parent && window.parent !== window && window.parent.CONTENT) {
        window.CONTENT = window.parent.CONTENT
        return true
      }
    } catch (e) {}
    return false
  }
  function fromStorage() {
    try {
      var raw = sessionStorage.getItem('reel-vault-content')
      if (!raw) return false
      var data = JSON.parse(raw)
      if (!data || typeof data !== 'object') return false
      window.CONTENT = data
      return true
    } catch (e) {
      return false
    }
  }
  if (!window.CONTENT) {
    fromTop() || fromParent() || fromStorage()
  }
  try {
    if (window.CONTENT && window.CONTENT.__lang) {
      window.ROLL_LANG = window.CONTENT.__lang
    }
  } catch (e) {}
})()
