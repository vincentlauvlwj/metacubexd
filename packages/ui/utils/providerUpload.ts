const PROVIDER_UPLOAD_BASE = 'http://clash.home.liuwj.me/proxy/provider/'

export function toProviderUploadUrl(name: string): string {
  // A provider is one file, never a subdirectory (nginx decodes URL paths).
  const hasControlCharacter = [...name].some((char) => {
    const code = char.charCodeAt(0)
    return code < 32 || code === 127
  })
  if (!name.trim() || /[/\\]/u.test(name) || hasControlCharacter) {
    throw new Error(
      'Provider name must be a valid filename without path separators',
    )
  }
  return `${PROVIDER_UPLOAD_BASE}${encodeURIComponent(`${name}.yaml`)}`
}
