export const homeCopy = {
  eyebrow: '又见',
  hello: (nickname: string) => `${nickname}，安`,
  together: (n: number) => `相伴第 ${n} 天`,
  trialToday: '今日日课',
  trialTodayDue: (due: number) => `今日日课 · 到期 ${due}`,
  vaultLink: '锦匣',
} as const
