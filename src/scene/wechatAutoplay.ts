/** Minimal WeChat JSBridge surface used for muted media unlock. */
type WeixinJSBridgeLike = {
  invoke: (api: string, params: object, callback?: () => void) => void
}

declare global {
  interface Window {
    WeixinJSBridge?: WeixinJSBridgeLike
  }
}

export function isWeChatBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /MicroMessenger/i.test(ua)
}

/**
 * WeChat WKWebView often paints the first frame then pauses until a "bridge"
 * call or user gesture. `getNetworkType` is the usual muted-autoplay unlock.
 */
export function nudgeWeChatMediaPlay(play: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const run = () => {
    const bridge = window.WeixinJSBridge
    if (bridge && typeof bridge.invoke === 'function') {
      try {
        bridge.invoke('getNetworkType', {}, () => play())
        return
      } catch {
        // Fall through to a plain play() attempt.
      }
    }
    play()
  }

  if (window.WeixinJSBridge) {
    run()
    return () => {}
  }

  document.addEventListener('WeixinJSBridgeReady', run, false)
  return () => document.removeEventListener('WeixinJSBridgeReady', run, false)
}
