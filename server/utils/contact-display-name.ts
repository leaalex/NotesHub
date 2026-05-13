export function computeContactDisplayName(input: {
  type: string
  firstName?: string | null
  lastName?: string | null
  orgName?: string | null
}): string {
  if (input.type === 'organization') {
    const o = (input.orgName ?? '').trim()
    return o || 'Organization'
  }
  const fn = (input.firstName ?? '').trim()
  const ln = (input.lastName ?? '').trim()
  const joined = `${fn} ${ln}`.trim()
  return joined || 'Untitled contact'
}
