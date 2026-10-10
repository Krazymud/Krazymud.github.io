import { CarError, type Role, type RoleRule } from './carTypes.ts'

// With the g or y flag, RegExp.test() resumes from lastIndex, so the same pattern can match one mesh name and miss the next.
// Stripping y also drops its sticky anchoring: the pattern can then match anywhere in the name, not only at lastIndex.
function stateless(pattern: RegExp): RegExp {
  return pattern.global || pattern.sticky ? new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')) : pattern
}

export function assignRoles(meshNames: string[], rules: RoleRule[], remove: RegExp[]): Map<string, Role> {
  const removals = remove.map(stateless)
  const roleRules = rules.map((rule) => ({ ...rule, mesh: stateless(rule.mesh) }))
  const deadRemovals = removals.filter((pattern) => !meshNames.some((name) => pattern.test(name)))
  if (deadRemovals.length > 0) {
    throw new CarError(`car.config.ts 里这些删除规则没有匹配到任何网格：${deadRemovals.map((pattern) => pattern.source).join('、')}`)
  }
  const kept = meshNames.filter((name) => !removals.some((pattern) => pattern.test(name)))
  const deadRules = roleRules.filter((rule) => !kept.some((name) => rule.mesh.test(name)))
  if (deadRules.length > 0) {
    throw new CarError(`car.config.ts 里这些规则没有匹配到任何网格：${deadRules.map((rule) => rule.mesh.source).join('、')}`)
  }
  const roles = new Map<string, Role>()
  const uncovered: string[] = []
  for (const name of kept) {
    const rule = roleRules.find((candidate) => candidate.mesh.test(name))
    if (rule) roles.set(name, rule.role)
    else uncovered.push(name)
  }
  if (uncovered.length > 0) throw new CarError(`这些网格没有被 car.config.ts 的任何规则覆盖：${uncovered.join('、')}`)
  return roles
}
