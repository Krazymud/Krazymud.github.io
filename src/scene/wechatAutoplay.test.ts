import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWeChatBrowser, nudgeWeChatMediaPlay } from './wechatAutoplay'

describe('wechatAutoplay', () => {
  afterEach(() => {
    delete window.WeixinJSBridge
    vi.restoreAllMocks()
  })

  it('detects WeChat user agents', () => {
    expect(isWeChatBrowser('Mozilla/5.0 MicroMessenger/8.0.0')).toBe(true)
    expect(isWeChatBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(false)
  })

  it('invokes getNetworkType when WeixinJSBridge is already present', () => {
    const play = vi.fn()
    const invoke = vi.fn((_api: string, _params: object, cb?: () => void) => {
      cb?.()
    })
    window.WeixinJSBridge = { invoke }
    const stop = nudgeWeChatMediaPlay(play)
    expect(invoke).toHaveBeenCalledWith('getNetworkType', {}, expect.any(Function))
    expect(play).toHaveBeenCalled()
    stop()
  })

  it('waits for WeixinJSBridgeReady when the bridge is not ready yet', () => {
    const play = vi.fn()
    const stop = nudgeWeChatMediaPlay(play)
    expect(play).not.toHaveBeenCalled()

    const invoke = vi.fn((_api: string, _params: object, cb?: () => void) => {
      cb?.()
    })
    window.WeixinJSBridge = { invoke }
    document.dispatchEvent(new Event('WeixinJSBridgeReady'))
    expect(invoke).toHaveBeenCalledWith('getNetworkType', {}, expect.any(Function))
    expect(play).toHaveBeenCalled()
    stop()
  })
})
