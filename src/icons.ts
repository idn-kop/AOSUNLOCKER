const strokeIcon = (strokeWidth: number, ...content: string[]) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content.join('')}</svg>`

const regularStrokeIcon = (...content: string[]) => strokeIcon(2.05, ...content)

const strongStrokeIcon = (...content: string[]) => strokeIcon(2.3, ...content)

const fillIcon = (...content: string[]) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${content.join('')}</svg>`

const duoIcon = (fillContent: string, ...strokeContent: string[]) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g fill="currentColor" fill-opacity="0.14" stroke="none">${fillContent}</g>${strokeContent.join('')}</svg>`

const ICONS: Record<string, string> = {
  fallback: regularStrokeIcon('<circle cx="12" cy="12" r="8" />', '<path d="M12 8v4" />', '<path d="M12 16h.01" />'),
  addressCard: duoIcon(
    '<rect x="4" y="5.25" width="16" height="13.5" rx="2.5" />',
    '<rect x="3.5" y="5" width="17" height="14" rx="2.5" />',
    '<circle cx="8.25" cy="11" r="1.75" />',
    '<path d="M6 15c.8-1.1 2-1.75 3.25-1.75S11.7 13.9 12.5 15" />',
    '<path d="M13.5 10h4.5" />',
    '<path d="M13.5 14h3.5" />',
  ),
  android: strongStrokeIcon(
    '<rect x="6.5" y="7" width="11" height="10" rx="2.5" />',
    '<path d="M8.5 7 7.25 4.75" />',
    '<path d="M15.5 7l1.25-2.25" />',
    '<path d="M9.5 11h.01" />',
    '<path d="M14.5 11h.01" />',
    '<path d="M9 17v2.5" />',
    '<path d="M15 17v2.5" />',
    '<path d="M6.5 10H5v4h1.5" />',
    '<path d="M19 10h-1.5v4H19" />',
  ),
  arrowUp: strongStrokeIcon('<path d="M12 19V5" />', '<path d="m7 10 5-5 5 5" />'),
  bars: strongStrokeIcon('<path d="M4 7h16" />', '<path d="M4 12h16" />', '<path d="M4 17h16" />'),
  book: regularStrokeIcon(
    '<path d="M5 5.75A2.75 2.75 0 0 1 7.75 3H19v17H7.75A2.75 2.75 0 0 0 5 22" />',
    '<path d="M5 5.75V22" />',
    '<path d="M8.5 7.5H16" />',
    '<path d="M8.5 11H16" />',
  ),
  bolt: fillIcon('<path d="M13.5 2 5 13h5.1L9.5 22 19 10.5h-5.1L13.5 2Z" />'),
  box: regularStrokeIcon(
    '<path d="m3.5 8.5 8.5-4 8.5 4" />',
    '<path d="M3.5 8.5 12 13l8.5-4.5" />',
    '<path d="M12 13v7.5" />',
    '<path d="M3.5 8.5v7.25L12 20.5l8.5-4.75V8.5" />',
  ),
  bullseye: strongStrokeIcon(
    '<circle cx="12" cy="12" r="8" />',
    '<circle cx="12" cy="12" r="4" />',
    '<circle cx="12" cy="12" r="1" />',
  ),
  caretLeft: strongStrokeIcon('<path d="m14.5 6.5-5 5 5 5" />'),
  chevronDown: strongStrokeIcon('<path d="m6 9 6 6 6-6" />'),
  chip: regularStrokeIcon(
    '<rect x="7" y="7" width="10" height="10" rx="2" />',
    '<path d="M9.5 2.75v2.5M14.5 2.75v2.5M9.5 18.75v2.5M14.5 18.75v2.5" />',
    '<path d="M2.75 9.5h2.5M18.75 9.5h2.5M2.75 14.5h2.5M18.75 14.5h2.5" />',
  ),
  circleCheck: duoIcon(
    '<circle cx="12" cy="12" r="8.3" />',
    '<circle cx="12" cy="12" r="8.5" />',
    '<path d="m8.4 12.45 2.35 2.35L15.8 9.9" />',
  ),
  clock: strongStrokeIcon('<circle cx="12" cy="12" r="8.5" />', '<path d="M12 7.5v5l3 1.75" />'),
  compass: duoIcon('<circle cx="12" cy="12" r="8.15" />', '<circle cx="12" cy="12" r="8.5" />', '<path d="m14.9 9.1-5.8 5.8 7.15-2.05-1.35-3.75Z" />'),
  diagram: regularStrokeIcon(
    '<circle cx="6" cy="6" r="2" />',
    '<circle cx="18" cy="8" r="2" />',
    '<circle cx="8" cy="18" r="2" />',
    '<circle cx="18" cy="18" r="2" />',
    '<path d="M7.7 7.3 16.2 6.8" />',
    '<path d="M7.2 7.8 8 16" />',
    '<path d="M10 18h6" />',
    '<path d="M16.8 10 18 16" />',
  ),
  download: strongStrokeIcon('<path d="M12 4.25v10.25" />', '<path d="m8.25 11.25 3.75 3.75 3.75-3.75" />', '<path d="M4.75 19.5h14.5" />'),
  externalLink: strongStrokeIcon(
    '<path d="M14 4h6v6" />',
    '<path d="m10 14 10-10" />',
    '<path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />',
  ),
  facebook: fillIcon('<path d="M13.5 22v-8.2h2.77l.41-3.2H13.5V8.56c0-.93.26-1.56 1.6-1.56h1.71V4.14c-.3-.04-1.32-.14-2.51-.14-2.48 0-4.18 1.51-4.18 4.29v2.31H7.3v3.2h2.82V22h3.38Z" />'),
  file: duoIcon(
    '<path d="M8.25 3.75h5.5L18.5 8.5v10A2.25 2.25 0 0 1 16.25 20.75h-8A2.25 2.25 0 0 1 6 18.5v-12A2.75 2.75 0 0 1 8.75 3.75Z" />',
    '<path d="M14 3.5H8.25A2.75 2.75 0 0 0 5.5 6.25V18a2.5 2.5 0 0 0 2.5 2.5h8A2.5 2.5 0 0 0 18.5 18V8Z" />',
    '<path d="M14 3v5h5" />',
    '<path d="M12 11v5" />',
    '<path d="m9.75 13.75 2.25 2.25 2.25-2.25" />',
  ),
  fire: fillIcon('<path d="M12 2.5c1.4 2.8 4 4.2 4 7.4 0 2.2-1.7 4-4 4s-4-1.8-4-4c0-1.4.4-2.7 1.4-4.1-2.4 1.4-4.4 4-4.4 7A6.99 6.99 0 0 0 12 20a7 7 0 0 0 7-7.1c0-4.1-2.5-7.4-7-10.4Z" />'),
  folder: duoIcon(
    '<path d="M4.75 7.25A2.25 2.25 0 0 1 7 5h3.1c.6 0 1.17.24 1.6.66l1.19 1.19H18A2.25 2.25 0 0 1 20.25 9.1v7.15A2.75 2.75 0 0 1 17.5 19H6.5a2.75 2.75 0 0 1-2.75-2.75Z" />',
    '<path d="M3.75 8a2.5 2.5 0 0 1 2.5-2.5H10l2 2h5.75A2.5 2.5 0 0 1 20.25 10v7.25A2.75 2.75 0 0 1 17.5 20H6.5A2.75 2.75 0 0 1 3.75 17.25Z" />',
    '<path d="M3.75 9.5h16.5" />',
  ),
  gauge: strongStrokeIcon('<path d="M4.5 16a7.5 7.5 0 1 1 15 0" />', '<path d="m12 12 4-3" />', '<path d="M12 12h.01" />'),
  gear: regularStrokeIcon(
    '<circle cx="12" cy="12" r="3.25" />',
    '<path d="M12 2.75v2.1M12 19.15v2.1M4.86 4.86l1.49 1.49M17.65 17.65l1.49 1.49M2.75 12h2.1M19.15 12h2.1M4.86 19.14l1.49-1.49M17.65 6.35l1.49-1.49" />',
  ),
  globe: regularStrokeIcon(
    '<circle cx="12" cy="12" r="9" />',
    '<path d="M3 12h18" />',
    '<path d="M12 3c2.8 3 4.2 6 4.2 9S14.8 18 12 21c-2.8-3-4.2-6-4.2-9S9.2 6 12 3Z" />',
  ),
  grid: strongStrokeIcon(
    '<rect x="4" y="4" width="6" height="6" rx="1.5" />',
    '<rect x="14" y="4" width="6" height="6" rx="1.5" />',
    '<rect x="4" y="14" width="6" height="6" rx="1.5" />',
    '<rect x="14" y="14" width="6" height="6" rx="1.5" />',
  ),
  house: fillIcon('<path d="M12 3.15 3.5 9.95v9.1A1.95 1.95 0 0 0 5.45 21h4.35v-6.25h4.4V21h4.35a1.95 1.95 0 0 0 1.95-1.95v-9.1L12 3.15Z" />'),
  key: strongStrokeIcon(
    '<circle cx="7.75" cy="12" r="3.75" />',
    '<path d="M11.5 12h8.5" />',
    '<path d="M16 12v2.8" />',
    '<path d="M18.5 12v1.8" />',
  ),
  laptopMedical: duoIcon(
    '<rect x="4.75" y="5.25" width="14.5" height="9" rx="2" />',
    '<rect x="4" y="4.5" width="16" height="10.5" rx="2" />',
    '<path d="M2.5 18.5h19" />',
    '<path d="M12 7.25v5" />',
    '<path d="M9.5 9.75h5" />',
  ),
  layers: regularStrokeIcon('<path d="m12 4-8 4 8 4 8-4-8-4Z" />', '<path d="m4 12 8 4 8-4" />', '<path d="m4 16 8 4 8-4" />'),
  link: strongStrokeIcon('<path d="M10 14 8 16a3 3 0 1 1-4.25-4.25l2-2A3 3 0 0 1 10 9" />', '<path d="M14 10l2-2a3 3 0 1 1 4.25 4.25l-2 2A3 3 0 0 1 14 15" />', '<path d="M9 15h6" />'),
  list: strongStrokeIcon('<path d="M9 7h11" />', '<path d="M9 12h11" />', '<path d="M9 17h11" />', '<circle cx="5" cy="7" r="1.1" />', '<circle cx="5" cy="12" r="1.1" />', '<circle cx="5" cy="17" r="1.1" />'),
  lockOpen: duoIcon('<rect x="5.75" y="10.75" width="12.5" height="8.5" rx="2" />', '<rect x="5" y="10" width="14" height="10" rx="2" />', '<path d="M9 10V7.5a3 3 0 0 1 5.8-1.2" />'),
  notesMedical: regularStrokeIcon(
    '<rect x="5.5" y="4.5" width="13" height="16" rx="2" />',
    '<path d="M9 4.5h6" />',
    '<path d="M12 9v4" />',
    '<path d="M10 11h4" />',
    '<path d="M8.5 16h7" />',
  ),
  phone: duoIcon(
    '<rect x="7.35" y="3.35" width="9.3" height="17.3" rx="2.2" />',
    '<rect x="7" y="2.75" width="10" height="18.5" rx="2.5" />',
    '<path d="M10 5.5h4" />',
    '<path d="M11.25 18.25h1.5" />',
  ),
  plug: strongStrokeIcon('<path d="M9 3.5v5" />', '<path d="M15 3.5v5" />', '<path d="M7 8.5h10v2a5 5 0 0 1-5 5 5 5 0 0 1-5-5Z" />', '<path d="M12 15.5v5" />'),
  rocket: strongStrokeIcon(
    '<path d="M13.5 4.5c2.8.3 5.7 3.2 6 6-.8 1.7-2 3.5-3.5 5L9 18.5l3-7 1.5-1.5Z" />',
    '<path d="M9 18.5 5.5 20l1.5-3.5" />',
    '<circle cx="15.25" cy="8.75" r="1.25" />',
  ),
  route: regularStrokeIcon('<circle cx="5.5" cy="17.5" r="1.5" />', '<circle cx="10" cy="8" r="1.5" />', '<circle cx="18.5" cy="6.5" r="1.5" />', '<path d="M6.8 16.8c1.8-3 2.3-6.2 2.2-7.3" />', '<path d="M11.5 8h5.5" />'),
  rotate: strongStrokeIcon('<path d="M20 6v5h-5" />', '<path d="M4 18v-5h5" />', '<path d="M19 11A7 7 0 0 0 6.5 6.5L5 8" />', '<path d="M5 13a7 7 0 0 0 12.5 4.5L19 16" />'),
  search: fillIcon('<path d="M10.75 3.5a7.25 7.25 0 1 1 0 14.5 7.25 7.25 0 0 1 0-14.5Zm5.67 10.85 4.08 4.08-1.42 1.42L15 15.77l1.42-1.42Z" />'),
  shield: duoIcon(
    '<path d="M12 3.5 6.15 5.8v5.2c0 3.62 2.1 6.98 5.85 8.57 3.75-1.59 5.85-4.95 5.85-8.57V5.8Z" />',
    '<path d="M12 3 5.5 5.5V11c0 4.2 2.45 8.06 6.5 10 4.05-1.94 6.5-5.8 6.5-10V5.5L12 3Z" />',
    '<path d="M12 7v8.5" />',
  ),
  signal: strongStrokeIcon('<path d="M5 18h1.5" />', '<path d="M9 15h1.5" />', '<path d="M13 12h1.5" />', '<path d="M17 9h1.5" />'),
  support: duoIcon(
    '<path d="M6 11.85a6 6 0 0 1 12 0V17h-2.75v-5.2H8.75V17H6Z" />',
    '<path d="M5 12a7 7 0 0 1 14 0" />',
    '<rect x="4" y="11.5" width="3.5" height="6" rx="1.5" />',
    '<rect x="16.5" y="11.5" width="3.5" height="6" rx="1.5" />',
    '<path d="M18 18.5A3.5 3.5 0 0 1 14.5 22H12" />',
  ),
  toolbox: duoIcon('<rect x="4.25" y="8.25" width="15.5" height="9.5" rx="2" />', '<rect x="3.5" y="7.5" width="17" height="11" rx="2" />', '<path d="M9 7.5v-1A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5v1" />', '<path d="M3.5 12h17" />'),
  userLock: regularStrokeIcon('<circle cx="9" cy="8" r="3" />', '<path d="M4.5 18c1.2-2.2 3-3.5 4.5-3.5S12.3 15.8 13.5 18" />', '<rect x="14.5" y="12.5" width="5.5" height="5.5" rx="1" />', '<path d="M16 12.5v-1a1.75 1.75 0 0 1 3.5 0v1" />'),
  whatsapp: fillIcon('<path d="M12 2a10 10 0 0 0-8.7 14.94L2 22l5.21-1.29A10 10 0 1 0 12 2Zm0 18a8.01 8.01 0 0 1-4.08-1.12l-.29-.17-3.09.77.82-3.01-.19-.31A8 8 0 1 1 12 20Zm4.39-5.46c-.24-.12-1.41-.69-1.63-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.17-.7-.62-1.18-1.38-1.32-1.62-.14-.24-.01-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.43h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.39 1.38.5.58.18 1.11.15 1.53.09.47-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />'),
  wrench: strongStrokeIcon('<path d="M14.5 5.5a3.5 3.5 0 0 0 4.2 4.2l-7.9 7.9a2.5 2.5 0 1 1-3.5-3.5l7.9-7.9a3.5 3.5 0 0 0-4.2-4.2l2.3 2.3-1.8 1.8-2.3-2.3a3.5 3.5 0 0 0 5.3 1.7Z" />'),
}

const ICON_ALIASES: Record<string, string> = {
  'fa-address-card': 'addressCard',
  'fa-android': 'android',
  'fa-arrows-rotate': 'rotate',
  'fa-arrow-up': 'arrowUp',
  'fa-arrow-up-right-from-square': 'externalLink',
  'fa-bars': 'bars',
  'fa-bolt': 'bolt',
  'fa-book-open': 'book',
  'fa-box-open': 'box',
  'fa-bullseye': 'bullseye',
  'fa-caret-left': 'caretLeft',
  'fa-chevron-down': 'chevronDown',
  'fa-circle-check': 'circleCheck',
  'fa-clock': 'clock',
  'fa-clock-rotate-left': 'rotate',
  'fa-cloud-arrow-down': 'download',
  'fa-code-branch': 'diagram',
  'fa-compass': 'compass',
  'fa-diagram-project': 'diagram',
  'fa-download': 'download',
  'fa-facebook-f': 'facebook',
  'fa-file-archive': 'file',
  'fa-file-download': 'file',
  'fa-fire': 'fire',
  'fa-folder': 'folder',
  'fa-folder-open': 'folder',
  'fa-folder-tree': 'folder',
  'fa-gauge-high': 'gauge',
  'fa-gear': 'gear',
  'fa-globe': 'globe',
  'fa-grip': 'grid',
  'fa-hard-drive': 'toolbox',
  'fa-headset': 'support',
  'fa-house': 'house',
  'fa-key': 'key',
  'fa-laptop-medical': 'laptopMedical',
  'fa-layer-group': 'layers',
  'fa-life-ring': 'support',
  'fa-link': 'link',
  'fa-list': 'list',
  'fa-lock-open': 'lockOpen',
  'fa-magnifying-glass': 'search',
  'fa-microchip': 'chip',
  'fa-mobile-alt': 'phone',
  'fa-mobile-screen': 'phone',
  'fa-mobile-screen-button': 'phone',
  'fa-notes-medical': 'notesMedical',
  'fa-plug': 'plug',
  'fa-rocket': 'rocket',
  'fa-rotate': 'rotate',
  'fa-rotate-left': 'rotate',
  'fa-route': 'route',
  'fa-screwdriver': 'wrench',
  'fa-screwdriver-wrench': 'wrench',
  'fa-shield-alt': 'shield',
  'fa-shield-halved': 'shield',
  'fa-signal': 'signal',
  'fa-sitemap': 'diagram',
  'fa-toolbox': 'toolbox',
  'fa-unlock-alt': 'lockOpen',
  'fa-user-lock': 'userLock',
  'fa-user-shield': 'shield',
  'fa-whatsapp': 'whatsapp',
  'fa-wrench': 'wrench',
}

const findIconClass = (classList: DOMTokenList) =>
  Array.from(classList).find((token) => token.startsWith('fa-') && token.length > 3) || null

const renderIconSvg = (iconClass: string | null) => {
  const iconName = iconClass ? ICON_ALIASES[iconClass] : null
  if (!iconName) return ICONS.fallback
  return ICONS[iconName] || ICONS.fallback
}

const hydrateIconElement = (element: HTMLElement) => {
  const iconClass = findIconClass(element.classList)
  const nextMarkup = renderIconSvg(iconClass)

  if (element.dataset.iconHydrated === nextMarkup) return

  element.classList.add('site-icon')
  if (!element.hasAttribute('aria-hidden')) {
    element.setAttribute('aria-hidden', 'true')
  }

  element.innerHTML = nextMarkup
  element.dataset.iconHydrated = nextMarkup
}

export const hydrateIcons = (root: ParentNode | Element | Document = document) => {
  if (typeof document === 'undefined') return

  const scope = root as ParentNode & { querySelectorAll?: typeof document.querySelectorAll }
  const queue: HTMLElement[] = []

  if (root instanceof HTMLElement && root.matches('i[class*="fa-"]')) {
    queue.push(root)
  }

  if (scope.querySelectorAll) {
    queue.push(...Array.from(scope.querySelectorAll<HTMLElement>('i[class*="fa-"]')))
  }

  queue.forEach(hydrateIconElement)
}

let observerStarted = false

const startObserver = () => {
  if (observerStarted || typeof document === 'undefined' || !document.body) return

  observerStarted = true
  hydrateIcons(document)

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          hydrateIcons(node)
        }
      })
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

export const startIconHydration = () => {
  if (typeof document === 'undefined') return

  if (document.body) {
    startObserver()
    return
  }

  window.addEventListener('DOMContentLoaded', startObserver, { once: true })
}
