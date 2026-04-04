import { faAndroid, faFacebookF, faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import {
  faAddressCard,
  faArrowUp,
  faArrowUpRightFromSquare,
  faArrowsRotate,
  faBars,
  faBolt,
  faBookOpen,
  faBoxOpen,
  faBullseye,
  faCaretLeft,
  faChevronDown,
  faCircleCheck,
  faCircleInfo,
  faClock,
  faCloudArrowDown,
  faCodeBranch,
  faCompass,
  faDiagramProject,
  faDownload,
  faFileArchive,
  faFire,
  faFolder,
  faFolderOpen,
  faFolderTree,
  faGaugeHigh,
  faGear,
  faGlobe,
  faGrip,
  faHardDrive,
  faHeadset,
  faHouse,
  faKey,
  faLaptopMedical,
  faLayerGroup,
  faLifeRing,
  faLink,
  faList,
  faLockOpen,
  faMagnifyingGlass,
  faMicrochip,
  faMobileAlt,
  faMobileScreen,
  faMobileScreenButton,
  faNotesMedical,
  faPlug,
  faRocket,
  faRotate,
  faRotateLeft,
  faRoute,
  faScrewdriver,
  faScrewdriverWrench,
  faShieldAlt,
  faShieldHalved,
  faSignal,
  faSitemap,
  faToolbox,
  faUnlockAlt,
  faUnlockKeyhole,
  faUserLock,
  faUserShield,
  faWrench,
} from '@fortawesome/free-solid-svg-icons'

type FaIconDefinition = {
  icon: [number, number, string[], string, string | string[]]
}

const ICONS: Record<string, FaIconDefinition> = {
  fallback: faCircleInfo,
  addressCard: faAddressCard,
  android: faAndroid,
  arrowUp: faArrowUp,
  bars: faBars,
  book: faBookOpen,
  bolt: faBolt,
  box: faBoxOpen,
  bullseye: faBullseye,
  caretLeft: faCaretLeft,
  chevronDown: faChevronDown,
  circleCheck: faCircleCheck,
  clock: faClock,
  cloudDownload: faCloudArrowDown,
  compass: faCompass,
  codeBranch: faCodeBranch,
  diagram: faDiagramProject,
  download: faDownload,
  externalLink: faArrowUpRightFromSquare,
  facebook: faFacebookF,
  file: faFileArchive,
  fire: faFire,
  folder: faFolder,
  folderOpen: faFolderOpen,
  folderTree: faFolderTree,
  gauge: faGaugeHigh,
  gear: faGear,
  globe: faGlobe,
  grid: faGrip,
  hardDrive: faHardDrive,
  house: faHouse,
  key: faKey,
  laptopMedical: faLaptopMedical,
  layers: faLayerGroup,
  lifeRing: faLifeRing,
  link: faLink,
  list: faList,
  lockOpen: faLockOpen,
  microchip: faMicrochip,
  mobileAlt: faMobileAlt,
  notesMedical: faNotesMedical,
  phone: faMobileScreen,
  phoneButton: faMobileScreenButton,
  plug: faPlug,
  rocket: faRocket,
  rotate: faRotate,
  rotateAlt: faArrowsRotate,
  rotateLeft: faRotateLeft,
  route: faRoute,
  search: faMagnifyingGlass,
  screwdriver: faScrewdriver,
  shieldAlt: faShieldAlt,
  shield: faShieldHalved,
  signal: faSignal,
  sitemap: faSitemap,
  support: faHeadset,
  toolbox: faToolbox,
  unlockAlt: faUnlockAlt,
  unlockKeyhole: faUnlockKeyhole,
  userLock: faUserLock,
  userShield: faUserShield,
  whatsapp: faWhatsapp,
  wrenchPlain: faWrench,
  wrench: faScrewdriverWrench,
}

const ICON_ALIASES: Record<string, string> = {
  'fa-address-card': 'addressCard',
  'fa-android': 'android',
  'fa-arrows-rotate': 'rotate',
  'fa-arrow-up': 'arrowUp',
  'fa-arrow-up-right': 'externalLink',
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
  'fa-cloud-arrow-down': 'cloudDownload',
  'fa-code-branch': 'codeBranch',
  'fa-compass': 'compass',
  'fa-diagram-project': 'diagram',
  'fa-download': 'download',
  'fa-facebook-f': 'facebook',
  'fa-file-archive': 'file',
  'fa-file-download': 'file',
  'fa-fire': 'fire',
  'fa-folder': 'folder',
  'fa-folder-open': 'folderOpen',
  'fa-folder-tree': 'folderTree',
  'fa-gauge-high': 'gauge',
  'fa-gear': 'gear',
  'fa-globe': 'globe',
  'fa-grip': 'grid',
  'fa-hard-drive': 'hardDrive',
  'fa-headset': 'support',
  'fa-home': 'house',
  'fa-house': 'house',
  'fa-key': 'key',
  'fa-laptop-medical': 'laptopMedical',
  'fa-layer-group': 'layers',
  'fa-life-ring': 'lifeRing',
  'fa-link': 'link',
  'fa-list': 'list',
  'fa-lock-open': 'lockOpen',
  'fa-magnifying-glass': 'search',
  'fa-microchip': 'microchip',
  'fa-mobile-alt': 'mobileAlt',
  'fa-mobile-screen': 'phone',
  'fa-mobile-screen-button': 'phoneButton',
  'fa-notes-medical': 'notesMedical',
  'fa-plug': 'plug',
  'fa-rocket': 'rocket',
  'fa-rotate': 'rotate',
  'fa-rotate-left': 'rotateLeft',
  'fa-route': 'route',
  'fa-screwdriver': 'screwdriver',
  'fa-screwdriver-wrench': 'wrench',
  'fa-shield-alt': 'shieldAlt',
  'fa-shield-halved': 'shield',
  'fa-signal': 'signal',
  'fa-sitemap': 'sitemap',
  'fa-toolbox': 'toolbox',
  'fa-unlock-alt': 'unlockAlt',
  'fa-unlock-keyhole': 'unlockKeyhole',
  'fa-user-lock': 'userLock',
  'fa-user-shield': 'userShield',
  'fa-whatsapp': 'whatsapp',
  'fa-wrench': 'wrenchPlain',
}

const findIconClass = (classList: DOMTokenList) =>
  Array.from(classList).find((token) => token.startsWith('fa-') && token.length > 3) || null

const renderFaSvg = (definition: FaIconDefinition) => {
  const [width, height, , , pathData] = definition.icon
  const paths = Array.isArray(pathData)
    ? pathData.map((path) => `<path fill="currentColor" d="${path}"></path>`).join('')
    : `<path fill="currentColor" d="${pathData}"></path>`

  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${paths}</svg>`
}

const renderIconSvg = (iconClass: string | null) => {
  const iconName = iconClass ? ICON_ALIASES[iconClass] : null
  const iconDefinition = iconName ? ICONS[iconName] : null
  return renderFaSvg(iconDefinition || ICONS.fallback)
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
