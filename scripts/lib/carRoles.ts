import { CarError, type Role, type RoleRule } from './carTypes.ts'

export function assignRoles(meshNames: string[], rules: RoleRule[], remove: RegExp[]): Map<string, Role> {
  const deadRules = rules.filter((rule) => !meshNames.some((name) => rule.mesh.test(name)))
  if (deadRules.length > 0) {
    throw new CarError(`car.config.ts 里这些规则没有匹配到任何网格：${deadRules.map((rule) => rule.mesh.source).join('、')}`)
  }
  const deadRemovals = remove.filter((pattern) => !meshNames.some((name) => pattern.test(name)))
  if (deadRemovals.length > 0) {
    throw new CarError(`car.config.ts 里这些删除规则没有匹配到任何网格：${deadRemovals.map((pattern) => pattern.source).join('、')}`)
  }
  const roles = new Map<string, Role>()
  const uncovered: string[] = []
  for (const name of meshNames) {
    if (remove.some((pattern) => pattern.test(name))) continue
    const rule = rules.find((candidate) => candidate.mesh.test(name))
    if (rule) roles.set(name, rule.role)
    else uncovered.push(name)
  }
  if (uncovered.length > 0) throw new CarError(`这些网格没有被 car.config.ts 的任何规则覆盖：${uncovered.join('、')}`)
  return roles
}
