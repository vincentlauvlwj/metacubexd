import { codeToFlag, parseNodeRegion } from '~/utils'

/** Keep subscription names intact unless a recognized region needs its flag. */
export function prefixNodeRegionFlag(name: string): string {
  const code = parseNodeRegion(name)
  if (!code) return name
  const flag = codeToFlag(code)
  return name.startsWith(flag) ? name : `${flag} ${name}`
}
