export const copy = {
  siteName: '青庐',
  nav: {
    home: '青庐',
    trial: '日课',
    vault: '锦匣',
    settings: '案头',
  },
  home: {
    eyebrow: '又见',
    hello: (nickname: string) => `${nickname}，安`,
    together: (n: number) => `相伴第 ${n} 天`,
    trialToday: '今日日课',
    trialTodayDue: (due: number) => `今日日课 · 到期 ${due}`,
    vaultLink: '锦匣',
  },
  trial: {
    nav: '日课',
    preparing: '正在准备日课…',
    completeEyebrow: '日课完成',
    activeTime: '用时',
    combo: (n: number) => `连击 ×${n}`,
    backHome: '回青庐',
  },
  settings: {
    title: '案头',
  },
  layout: {
    progressSaveFailed: '进度暂时无法保存到这台设备，建议去「案头」导出进度。',
  },
  vault: {
    title: '锦匣',
    opening: '正在打开锦匣…',
    empty: '锦匣还是空的。',
    broken: '锦匣暂时打不开',
    unseal: '启封',
    unsealing: '正在启封…',
    holdHint: '按住启封',
    tapHint: '点一下启封',
  },
} as const
