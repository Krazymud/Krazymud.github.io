export const CAR_PATH = 'models/car.glb'

export const TEXTURE_PATHS = {
  floor: ['textures/garage_floor_diff.webp', 'textures/garage_floor_rough.webp', 'textures/garage_floor_nor.webp'],
  wall: ['textures/wall_metal_diff.webp', 'textures/wall_metal_rough.webp', 'textures/wall_metal_nor.webp'],
} satisfies Record<string, [string, string, string]>

export const STAGE_ASSET_PATHS = [CAR_PATH, ...TEXTURE_PATHS.floor, ...TEXTURE_PATHS.wall]

export const EARLY_FETCHES = '__stageFetches'

interface EarlyFetchOptions {
  prefsKey: string
  urls: readonly string[]
  stageScript?: string
  mainScript?: string
}

// 写进 index.html 的 <head>：主代码一下载完就开始拉 3D 代码和素材，趁主代码执行、页面渲染的空当先跑起来。
// 不和主代码同时下载，是因为慢网络下带宽是固定的，抢带宽只会让页面本身更晚出来。
// 用 fetch 而不是 <link rel="preload">，这样 prefetch.ts 能直接接手同一个请求，不会重复下载；
// 如果 prefetch.ts 已经先开始了，这里就什么也不做。
export function earlyFetchScript({ prefsKey, urls, stageScript, mainScript }: EarlyFetchOptions): string {
  const preload = stageScript
    ? `var l=document.createElement('link');l.rel='modulepreload';l.href=${JSON.stringify(stageScript)};document.head.appendChild(l);`
    : ''
  const go =
    `function go(){if(window.${EARLY_FETCHES})return;` +
    preload +
    `var f=window.${EARLY_FETCHES}={};` +
    `${JSON.stringify(urls)}.forEach(function(u){f[u]=fetch(u);f[u].catch(function(){})})}`
  const afterMain = mainScript
    ? `if(window.PerformanceObserver){var o=new PerformanceObserver(function(list){list.getEntries().forEach(function(e){` +
      `if(o&&e.name.indexOf(${JSON.stringify(mainScript)})>=0){o.disconnect();o=null;go()}})});` +
      `o.observe({type:'resource',buffered:true});return}`
    : ''
  return (
    `(function(){try{` +
    `var p=JSON.parse(localStorage.getItem(${JSON.stringify(prefsKey)})||'{}');` +
    `if(p.scene3d===false||typeof WebGL2RenderingContext==='undefined'||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;` +
    go +
    afterMain +
    `go()` +
    `}catch(e){}})()`
  )
}
