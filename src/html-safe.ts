const SAFE_ABSOLUTE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_RELATIVE_URL_PATTERN = /^(?:\/(?!\/)|#|\?|\.{1,2}\/)/

const toStringValue = (value: unknown) => String(value ?? '')

export const escapeHtml = (value: unknown) =>
  toStringValue(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

export const escapeAttribute = (value: unknown) => escapeHtml(value).replaceAll('`', '&#96;')

export const sanitizeUrl = (value: unknown, fallback = '#') => {
  const raw = toStringValue(value).trim()
  if (!raw) return fallback

  if (SAFE_RELATIVE_URL_PATTERN.test(raw)) {
    return escapeAttribute(raw)
  }

  try {
    const url = new URL(raw)
    if (!SAFE_ABSOLUTE_PROTOCOLS.has(url.protocol)) {
      return fallback
    }

    return escapeAttribute(url.toString())
  } catch {
    return fallback
  }
}
