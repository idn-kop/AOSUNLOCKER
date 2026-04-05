import type {
  DownloadBrandCard,
  DownloadCategoryCard,
  DownloadListFile,
  DownloadModelFolder,
  FeatureCard,
  FirmwareCard,
  SimpleCard,
  SitePageKey,
  TickerItem,
} from './data-types'
import { loadHomepageTickers, warmRouteDataFromHref } from './live-data'
import { latestUploads as fallbackLatestUploads, topFiles as fallbackTopFiles } from './portal-data'

const repeatForTicker = <T>(items: T[], minimum = 12) => {
  if (!items.length) return []

  const copies = Math.max(2, Math.ceil(minimum / items.length))
  return Array.from({ length: copies }, () => items).flat()
}

type AssetImageOptions = {
  src: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
  decoding?: 'sync' | 'async' | 'auto'
  fetchPriority?: 'high' | 'low' | 'auto'
  width?: number
  height?: number
}

const renderAssetImage = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'low',
  width,
  height,
}: AssetImageOptions) => `
  <img
    src="${src}"
    alt="${alt}"
    class="${className}"
    loading="${loading}"
    decoding="${decoding}"
    fetchpriority="${fetchPriority}"
    ${width ? `width="${width}"` : ''}
    ${height ? `height="${height}"` : ''}
  />
`

const getBrandArtwork = (brandId?: string) => {
  if (brandId === 'huawei') {
    return {
      src: '/huawei-solutions.webp',
      alt: 'Huawei logo',
      className: 'download-brand-logo',
      width: 700,
      height: 700,
    }
  }

  if (brandId === 'honor') {
    return {
      src: '/honor-solutions.svg',
      alt: 'Honor logo',
      className: 'download-brand-logo',
      width: 100,
      height: 86,
    }
  }

  return {
    src: '/folder.svg',
    alt: 'Folder icon',
    className: 'download-brand-logo download-brand-logo-folder',
    width: 100,
    height: 86,
  }
}

type NavKey = SitePageKey | 'remote'

const navItems: Array<{ key: SitePageKey; label: string; href: string; icon: string }> = [
  { key: 'home', label: 'Home', href: '/index.html', icon: 'fa-house' },
  { key: 'huawei', label: 'Huawei', href: '/solution-files.html?brand=huawei', icon: 'fa-mobile-screen' },
  { key: 'honor', label: 'Honor', href: '/solution-files.html?brand=honor', icon: 'fa-shield-halved' },
]

const linkMap: Record<string, string> = {
  Huawei: '/solution-files.html?brand=huawei',
  Honor: '/solution-files.html?brand=honor',
  'Kirin Tools': '/downloads.html',
  'HarmonyOS Files': '/downloads.html',
}

const starMarkup = '&#9733;&#9733;&#9733;&#9733;&#9733;'

const whatsappSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2a10 10 0 0 0-8.7 14.94L2 22l5.21-1.29A10 10 0 1 0 12 2Zm0 18a8.01 8.01 0 0 1-4.08-1.12l-.29-.17-3.09.77.82-3.01-.19-.31A8 8 0 1 1 12 20Zm4.39-5.46c-.24-.12-1.41-.69-1.63-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.17-.7-.62-1.18-1.38-1.32-1.62-.14-.24-.01-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.43h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.39 1.38.5.58.18 1.11.15 1.53.09.47-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/>
  </svg>
`

const facebookSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M24 12a12 12 0 1 0-13.88 11.85v-8.39H7.08V12h3.04V9.36c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.46h-2.79v8.39A12 12 0 0 0 24 12Z"/>
  </svg>
`

const globeSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm6.93 9h-3.12a15.95 15.95 0 0 0-1.07-4.19A8.03 8.03 0 0 1 18.93 11ZM12 4.06c.83 1.01 1.94 3.02 2.53 6.94H9.47C10.06 7.08 11.17 5.07 12 4.06ZM4.26 13h3.12a15.95 15.95 0 0 0 1.07 4.19A8.03 8.03 0 0 1 4.26 13Zm3.12-2H4.26a8.03 8.03 0 0 1 4.19-4.19A15.95 15.95 0 0 0 7.38 11Zm4.62 8.94c-.83-1.01-1.94-3.02-2.53-6.94h5.06c-.59 3.92-1.7 5.93-2.53 6.94ZM15.55 17.19A15.95 15.95 0 0 0 16.62 13h3.12a8.03 8.03 0 0 1-4.19 4.19Z"/>
  </svg>
`

const primarySiteUrl = 'https://aosunlocker.com'

const renderMiniSocialLinks = (extraClass = '') => `
  <div class="mini-social-links ${extraClass}".trim() aria-label="AOSUNLOCKER social links">
    <a class="mini-social-link mini-social-link-whatsapp" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer" aria-label="WhatsApp admin" title="WhatsApp admin">
      ${whatsappSvg}
    </a>
    <a class="mini-social-link mini-social-link-facebook" href="https://www.facebook.com/anggaaosunlocker" target="_blank" rel="noreferrer" aria-label="Facebook" title="Facebook">
      ${facebookSvg}
    </a>
    <a class="mini-social-link mini-social-link-web" href="${primarySiteUrl}" target="_blank" rel="noreferrer" aria-label="Website" title="Website">
      ${globeSvg}
    </a>
  </div>
`

export const renderTicker = (items: TickerItem[]) =>
  repeatForTicker(items)
    .map(
      (item) => `
        <a href="/downloads.html" class="ticker-item">
          <i class="fas ${item.icon} me-2 ${item.icon === 'fa-fire' ? 'text-danger' : ''}"></i>
          <span class="ticker-text">${item.title}</span>
          <span class="ticker-meta">${item.meta}</span>
        </a>
      `,
    )
    .join('')

const renderSiteTickerSections = (latestHtml: string, topHtml: string) => `
  ${latestHtml}
  ${topHtml}
`

const renderSiteTickerResult = (latest: string, top: string) =>
  renderSiteTickerSections(
    latest
      ? `
        <section class="ticker-wrapper ticker-latest">
          <span class="ticker-label"><i class="fas fa-clock me-2"></i>Latest</span>
          <div class="ticker-content"><div class="ticker-items">${latest}</div></div>
        </section>
      `
      : '',
    top
      ? `
        <section class="ticker-wrapper ticker-top">
          <span class="ticker-label"><i class="fas fa-fire me-2"></i>Popular</span>
          <div class="ticker-content"><div class="ticker-items ticker-reverse">${top}</div></div>
        </section>
      `
      : '',
  )

const renderSiteTickerFallback = () => {
  const latest = fallbackLatestUploads.length ? renderTicker(fallbackLatestUploads) : ''
  const top = fallbackTopFiles.length ? renderTicker(fallbackTopFiles) : ''

  if (!latest && !top) {
    return renderSiteTickerSections(
      `
        <section class="ticker-wrapper ticker-latest ticker-static">
          <span class="ticker-label"><i class="fas fa-clock me-2"></i>Latest</span>
          <div class="ticker-content">
            <div class="ticker-items ticker-items-static">
              <span class="ticker-item ticker-item-placeholder">Loading recent files...</span>
            </div>
          </div>
        </section>
      `,
      `
        <section class="ticker-wrapper ticker-top ticker-static">
          <span class="ticker-label"><i class="fas fa-fire me-2"></i>Popular</span>
          <div class="ticker-content">
            <div class="ticker-items ticker-items-static">
              <span class="ticker-item ticker-item-placeholder">Loading top files...</span>
            </div>
          </div>
        </section>
      `,
    )
  }

  return renderSiteTickerResult(latest, top)
}

let siteTickerRequest: Promise<{ latest: TickerItem[]; top: TickerItem[] }> | null = null

const hydrateSiteTicker = () => {
  const tickerMount = document.querySelector<HTMLDivElement>('#siteTickerMount')
  if (!tickerMount) return

  tickerMount.innerHTML = renderSiteTickerFallback()

  if (tickerMount.dataset.tickerMode === 'static') {
    return
  }

  siteTickerRequest ??= loadHomepageTickers()

  void siteTickerRequest.then((tickerResult) => {
    if (!tickerMount.isConnected) return

    const latest = tickerResult.latest.length ? renderTicker(tickerResult.latest) : renderTicker(fallbackLatestUploads)
    const top = tickerResult.top.length ? renderTicker(tickerResult.top) : renderTicker(fallbackTopFiles)
    tickerMount.innerHTML = renderSiteTickerResult(latest, top)
  })
}

export const renderSimpleCard = (item: SimpleCard) => `
  <div class="col-lg-3 col-md-4 col-sm-6">
    <article class="card tile-card border-0 shadow-lg rounded-4 overflow-hidden h-100 searchable">
      <div class="card-body p-4 text-center">
        <div class="icon-shell accent-${item.accent}">
          <i class="fas ${item.icon} text-white"></i>
        </div>
        <h3 class="h6 fw-bold mb-2 text-dark">${item.title}</h3>
        <p class="small text-muted mb-2">${item.subtitle}</p>
        ${item.badge ? `<span class="badge pill accent-${item.accent}">${item.badge}</span>` : ''}
      </div>
    </article>
  </div>
`

export const renderPageLinkCard = (item: SimpleCard) => `
  <div class="col-lg-3 col-md-6">
    <a class="hub-card ${item.title in linkMap ? '' : 'pointer-events-none'}" href="${linkMap[item.title] ?? '#'}">
      <div class="icon-shell accent-${item.accent}">
        <i class="fas ${item.icon} text-white"></i>
      </div>
      <h3 class="h6 fw-bold mb-2 text-dark">${item.title}</h3>
      <p class="small text-muted mb-3">${item.subtitle}</p>
      ${item.badge ? `<span class="badge pill accent-${item.accent}">${item.badge}</span>` : ''}
    </a>
  </div>
`

export const renderFirmware = (item: FirmwareCard) => `
  <div class="col-lg-4 col-md-6">
    <article class="card tile-card border-0 shadow-lg rounded-4 overflow-hidden h-100 searchable">
      <div class="card-body p-4 d-flex flex-column">
        <div class="d-flex gap-2 mb-3 flex-wrap">
          ${item.status.map((status) => `<span class="badge status-chip">${status}</span>`).join('')}
        </div>
        <h3 class="h5 fw-semibold text-dark mb-3">${item.title}</h3>
        <p class="small text-muted mb-3"><i class="fas fa-folder me-1 text-primary"></i>${item.brand}</p>
        <div class="mt-auto d-flex justify-content-between align-items-end gap-3 flex-wrap">
          <small class="text-muted fw-bold"><i class="fas fa-download me-1 text-info"></i>${item.downloads}</small>
          <small class="text-muted soft-pill"><i class="fas fa-clock me-1 text-warning"></i>${item.age}</small>
        </div>
        <a class="download-link mt-4" href="/download.html?file=${item.id}">Download</a>
      </div>
    </article>
  </div>
`

export const renderFeature = (item: FeatureCard) => `
  <div class="feature-item">
    <article class="feature-card text-center p-5 bg-white rounded-4 shadow-lg border-${item.tone} border-2 h-100 searchable">
      <div class="feature-icon-circle bg-${item.tone}-subtle text-${item.tone}">
        <i class="fas ${item.icon}"></i>
      </div>
      <h3 class="h5 fw-bold mb-3 text-dark">${item.title}</h3>
      <p class="text-muted mb-0">${item.description}</p>
    </article>
  </div>
`

export const renderDownloadBreadcrumbs = (items: Array<{ label: string; href?: string }>) => `
  <div class="download-breadcrumbs">
    ${items
      .map((item) =>
        item.href
          ? `<a href="${item.href}"><i class="fas fa-folder me-2"></i>${item.label}</a>`
          : `<span><i class="fas fa-folder-open me-2"></i>${item.label}</span>`,
      )
      .join('')}
  </div>
`

const renderBackBlock = (title: string, href: string) => `
  <a class="download-back" href="${href}">
    <span class="download-back-icon"><i class="fas fa-caret-left"></i></span>
    <span>
      <strong>${title}</strong>
      <small>Go Back</small>
    </span>
  </a>
`

const renderLogoWordmark = () => `
  <span class="logo-wordmark-picture">
    ${renderAssetImage({
      src: '/aosunlocker%20(1).png',
      alt: 'AOSUNLOCKER',
      className: 'logo-wordmark',
      loading: 'eager',
      decoding: 'async',
      fetchPriority: 'high',
      width: 960,
      height: 540,
    })}
  </span>
`

const getDownloadHomeKicker = (item: DownloadCategoryCard) => {
  if (item.kind === 'brand') {
    return item.brandId === 'honor' ? 'Honor Portal' : item.brandId === 'huawei' ? 'Huawei Portal' : 'Service Folder'
  }

  if (item.kind === 'android') {
    return 'Android Access'
  }

  return 'Folder Access'
}

export const renderDownloadHomeCard = (item: DownloadCategoryCard) => `
  <a class="download-home-card" href="${item.href}">
    <div class="download-home-icon ${item.kind === 'android' ? 'download-home-icon-android' : ''} ${item.kind === 'brand' ? `download-home-icon-brand download-home-icon-brand-${item.brandId}` : ''}">
      ${
        item.kind === 'android'
          ? '<i class="fab fa-android"></i>'
          : item.kind === 'brand'
            ? `
              <div class="download-brand-artwork">
                ${renderAssetImage({
                  ...getBrandArtwork(item.brandId),
                  loading: 'lazy',
                  decoding: 'async',
                  fetchPriority: 'low',
                })}
              </div>
            `
            : renderAssetImage({
                src: '/folder.svg',
                alt: 'Folder icon',
                loading: 'lazy',
                decoding: 'async',
                fetchPriority: 'low',
                width: 100,
                height: 86,
              })
      }
    </div>
    <div class="download-home-copy">
      <span class="download-home-kicker">${getDownloadHomeKicker(item)}</span>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
    </div>
    <span class="download-home-arrow" aria-hidden="true"><i class="fas fa-arrow-up-right"></i></span>
  </a>
`

export const renderBrandDownloadCard = (item: DownloadBrandCard) => `
  <a class="brand-download-card" href="${item.href}">
    <div class="brand-download-art ${item.kind === 'tool' ? 'brand-download-art-tool' : ''}">
      ${
        item.kind === 'tool'
          ? '<i class="fas fa-gear"></i>'
          : `<span class="brand-download-chip">${item.badge ?? 'HUAWEI'}</span><strong>HUAWEI</strong>`
      }
    </div>
    <div class="brand-download-copy">
      <span class="brand-download-kicker">${item.kind === 'tool' ? 'Tool Access' : item.badge ? 'Premium Folder' : 'Service Folder'}</span>
      <h3>${item.title}</h3>
      <p>${item.subtitle}</p>
    </div>
    <span class="brand-download-arrow" aria-hidden="true"><i class="fas fa-arrow-up-right"></i></span>
  </a>
`

export const renderModelFolderCard = (item: DownloadModelFolder) => `
  <a class="model-folder-card" href="${item.href}">
    <div class="model-folder-art">
      ${renderAssetImage({
        src: '/folder.svg',
        alt: item.title,
        loading: 'lazy',
        decoding: 'async',
        fetchPriority: 'low',
        width: 100,
        height: 86,
      })}
    </div>
    <div class="model-folder-copy">
      <span class="model-folder-kicker">Model Folder</span>
      <h3>${item.title}</h3>
      <p>${item.subtitle}</p>
    </div>
    <span class="model-folder-arrow" aria-hidden="true"><i class="fas fa-arrow-up-right"></i></span>
  </a>
`

export const renderDownloadListRow = (item: DownloadListFile) => `
  <article class="download-list-row">
    <div class="download-list-icon">
      ${renderAssetImage({
        src: '/folder.svg',
        alt: item.title,
        loading: 'lazy',
        decoding: 'async',
        fetchPriority: 'low',
        width: 100,
        height: 86,
      })}
    </div>
    <div class="download-list-copy">
      <div class="file-badge-row">
        ${item.featured ? '<span class="file-badge file-badge-featured">Featured</span>' : ''}
      </div>
      <h3>${item.title}</h3>
      <div class="download-stars">${starMarkup}</div>
      <p>${item.subtitle}</p>
      <div class="download-list-meta">
        ${item.date ? `<span>Date: ${item.date}</span>` : ''}
        <span>Size: ${item.size}</span>
        ${item.price ? `<span>Access: ${item.price.toLowerCase() === 'free' ? 'Available' : item.price}</span>` : ''}
      </div>
    </div>
    <div class="download-list-action">
      <a class="download-small-button" href="/download.html?file=${item.id}"><i class="fas fa-download me-2"></i>Download</a>
    </div>
  </article>
`

export const renderDownloadGridCard = (item: DownloadListFile) => `
  <article class="download-grid-card">
    <div class="download-grid-icon">
      ${renderAssetImage({
        src: '/folder.svg',
        alt: item.title,
        loading: 'lazy',
        decoding: 'async',
        fetchPriority: 'low',
        width: 100,
        height: 86,
      })}
    </div>
    <div class="file-badge-row">
      ${item.featured ? '<span class="file-badge file-badge-featured">Featured</span>' : ''}
      ${
        item.price
          ? item.price.toLowerCase() === 'free'
            ? '<span class="file-badge file-badge-free">Available</span>'
            : '<span class="file-badge file-badge-premium">Access</span><span class="file-badge file-badge-price">' + item.price + '</span>'
          : ''
      }
    </div>
    <h3>${item.title}</h3>
    <p>${item.subtitle}</p>
    <div class="download-list-meta">
      ${item.date ? `<span>Date: ${item.date}</span>` : ''}
      <span>Size: ${item.size}</span>
    </div>
    <a class="download-small-button" href="/download.html?file=${item.id}"><i class="fas fa-download me-2"></i>Open</a>
  </article>
`

export const renderDownloadEmptyState = (title: string, copy: string) => `
  <div class="download-empty-state">
    <div class="download-empty-icon"><i class="fas fa-folder-open"></i></div>
    <h3>${title}</h3>
    <p>${copy}</p>
  </div>
`

export const renderDownloadLoadingState = (title: string, copy: string) => `
  <div class="download-loading-state" aria-live="polite">
    <div class="download-loading-spinner" aria-hidden="true"></div>
    <h3>${title}</h3>
    <p>${copy}</p>
  </div>
`

export const renderDownloadHomeSkeleton = (count = 3) => `
  <div class="download-home-grid download-home-grid-skeleton">
    ${Array.from({ length: count })
      .map(
        () => `
          <div class="download-home-card download-skeleton-card">
            <div class="download-home-icon download-skeleton-box"></div>
            <div class="download-skeleton-copy">
              <span class="download-skeleton-line download-skeleton-line-title"></span>
              <span class="download-skeleton-line"></span>
              <span class="download-skeleton-line download-skeleton-line-short"></span>
            </div>
          </div>
        `,
      )
      .join('')}
  </div>
`

export const renderDownloadResultsSkeleton = (count = 3) => `
  <div class="download-list-wrap download-list-wrap-skeleton">
    ${Array.from({ length: count })
      .map(
        () => `
          <article class="download-list-row download-skeleton-row">
            <div class="download-list-icon download-skeleton-box"></div>
            <div class="download-skeleton-copy">
              <span class="download-skeleton-line download-skeleton-line-title"></span>
              <span class="download-skeleton-line"></span>
              <span class="download-skeleton-line download-skeleton-line-short"></span>
            </div>
            <div class="download-skeleton-button"></div>
          </article>
        `,
      )
      .join('')}
  </div>
`

export const renderDownloadDetailSkeleton = () => `
  <div class="download-detail-panel">
    <div class="download-skeleton-center">
      <span class="download-skeleton-line download-skeleton-line-hero"></span>
      <span class="download-skeleton-line download-skeleton-line-medium"></span>
    </div>
    <div class="download-detail-table download-detail-table-skeleton">
      ${Array.from({ length: 4 })
        .map(
          () => `
            <div>
              <span class="download-skeleton-line download-skeleton-line-short"></span>
              <span class="download-skeleton-line download-skeleton-line-medium"></span>
            </div>
          `,
        )
        .join('')}
    </div>
    <div class="download-skeleton-big-button"></div>
  </div>
`

export const renderSiteChrome = (mainContent: string, activeKey?: NavKey, downloadsActive = false) => `
  <div class="top-bar">
    <div class="container d-flex justify-content-between align-items-center flex-wrap">
      <div class="d-flex flex-wrap">
        <a href="/index.html"><i class="fas fa-house me-1"></i>Home</a>
        <a href="/downloads.html"><i class="fas fa-folder-tree me-1"></i>Downloads</a>
        <a href="/solution-files.html?brand=huawei"><i class="fas fa-mobile-alt me-1"></i>Huawei</a>
        <a href="/solution-files.html?brand=honor"><i class="fas fa-download me-1"></i>Honor</a>
      </div>
      <div class="top-bar-actions">
        <a class="support-link" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer"><i class="fas fa-headset me-1"></i>WhatsApp Support</a>
        ${renderMiniSocialLinks('mini-social-links-topbar')}
      </div>
    </div>
  </div>

  <header class="middle-header">
    <div class="container">
      <div class="middle-header-panel">
        <div class="logo-block">
          <div class="logo-wordmark-wrap">
            ${renderLogoWordmark()}
            <div class="logo-meta-row">
              <div class="logo-note">Huawei, Honor, Kirin, HarmonyOS, Qualcomm</div>
              <div class="logo-capability-row" aria-label="Portal capabilities">
                <span class="logo-capability-chip"><i class="fas fa-circle-check"></i>Verified files</span>
                <span class="logo-capability-chip"><i class="fas fa-headset"></i>Fast support</span>
              </div>
            </div>
          </div>
        </div>
        <form class="search-form" id="searchForm">
          <div class="search-shell">
            <i class="fas fa-magnifying-glass search-shell-icon"></i>
            <div class="search-copy">
              <span class="search-shell-label">Search</span>
              <input type="text" id="searchInput" aria-label="Search downloads" placeholder="Search files, models, or solutions..." />
            </div>
            <button type="submit" aria-label="Search"><i class="fas fa-arrow-up-right-from-square"></i></button>
          </div>
          <div class="search-dropdown" id="searchDropdown" hidden></div>
        </form>
      </div>
    </div>
  </header>

  <section class="mobile-menu-shell">
    <div class="container">
      <details class="mobile-menu" id="mobileMenu">
        <summary class="mobile-menu-summary">
          <span class="mobile-menu-summary-copy">
            <span class="mobile-menu-summary-label">Quick Access</span>
            <strong>Main Menu</strong>
            <span class="mobile-menu-summary-meta">Direct folders, support, and fast download access.</span>
          </span>
          <span class="mobile-menu-summary-side">
            <span class="mobile-menu-summary-status"><i class="fas fa-signal"></i>Live</span>
            <i class="fas fa-chevron-down mobile-menu-summary-caret"></i>
          </span>
        </summary>
        <div class="mobile-menu-panel">
          <a class="mobile-menu-link ${activeKey === 'home' ? 'active' : ''}" href="/index.html">
            <i class="fas fa-house"></i>
            <span>Home</span>
          </a>
          <a class="mobile-menu-link ${downloadsActive ? 'active' : ''}" href="/downloads.html">
            <i class="fas fa-folder-tree"></i>
            <span>Downloads</span>
          </a>
          <a class="mobile-menu-link ${activeKey === 'huawei' ? 'active' : ''}" href="/solution-files.html?brand=huawei">
            <i class="fas fa-mobile-screen"></i>
            <span>Huawei</span>
          </a>
          <a class="mobile-menu-link ${activeKey === 'honor' ? 'active' : ''}" href="/solution-files.html?brand=honor">
            <i class="fas fa-shield-halved"></i>
            <span>Honor</span>
          </a>
          <a class="mobile-menu-link ${activeKey === 'remote' ? 'active' : ''}" href="/remote-service.html">
            <i class="fas fa-laptop-medical"></i>
            <span>Remote Service</span>
          </a>
          <a class="mobile-menu-link mobile-menu-link-support" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer">
            <i class="fas fa-headset"></i>
            <span>WhatsApp Support</span>
          </a>
          <div class="mobile-menu-contact-row">
            <a class="mobile-menu-contact-link mobile-menu-contact-link-whatsapp" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer" aria-label="WhatsApp">
              ${whatsappSvg}
            </a>
            <a class="mobile-menu-contact-link mobile-menu-contact-link-facebook" href="https://www.facebook.com/anggaaosunlocker" target="_blank" rel="noreferrer" aria-label="Facebook">
              ${facebookSvg}
            </a>
            <a class="mobile-menu-contact-link mobile-menu-contact-link-web" href="${primarySiteUrl}" target="_blank" rel="noreferrer" aria-label="Website">
              ${globeSvg}
            </a>
          </div>
        </div>
      </details>
    </div>
  </section>

  <nav class="main-nav">
    <div class="container nav-grid">
      ${navItems
        .map(
          (item) => `
            <a class="nav-link ${activeKey === item.key ? 'active' : ''}" href="${item.href}">
              <i class="fas ${item.icon} me-1"></i>${item.label}
            </a>
          `,
        )
        .join('')}
      <a class="nav-link ${downloadsActive ? 'active' : ''}" href="/downloads.html"><i class="fas fa-folder-tree me-1"></i>Downloads</a>
      <a class="nav-link nav-link-remote ${activeKey === 'remote' ? 'active' : ''}" href="/remote-service.html"><i class="fas fa-laptop-medical me-1"></i>Remote Service</a>
      <details class="nav-contact-menu">
        <summary class="nav-link nav-link-contact nav-link-contact-toggle" aria-label="Open contact links">
          <i class="fas fa-address-card me-1"></i>Contact
          <i class="fas fa-chevron-down nav-contact-caret"></i>
        </summary>
        <div class="nav-contact-dropdown">
          <a class="nav-contact-item nav-contact-item-whatsapp" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer">
            <span class="nav-contact-item-icon">${whatsappSvg}</span>
            <span>WhatsApp</span>
          </a>
          <a class="nav-contact-item nav-contact-item-facebook" href="https://www.facebook.com/anggaaosunlocker" target="_blank" rel="noreferrer">
            <span class="nav-contact-item-icon">${facebookSvg}</span>
            <span>Facebook</span>
          </a>
          <a class="nav-contact-item nav-contact-item-web" href="${primarySiteUrl}" target="_blank" rel="noreferrer">
            <span class="nav-contact-item-icon">${globeSvg}</span>
            <span>Website</span>
          </a>
        </div>
      </details>
    </div>
  </nav>

  <div id="siteTickerMount" data-ticker-mode="static"></div>

  ${mainContent}

  <footer id="footer" class="footer-shell">
    <div class="container py-5">
      <div class="footer-grid">
        <div>
          <p class="eyebrow">AOSUNLOCKER</p>
          <h3 class="text-white h4 mb-3">Huawei and Honor service portal</h3>
          <p class="text-white-50 mb-0">Focused on Kirin repair work, HarmonyOS recovery packages, Qualcomm rescue access, and Huawei-specific service flows.</p>
        </div>
        <div>
          <h4 class="footer-title">Pages</h4>
          <a href="/index.html">Home</a>
          <a href="/downloads.html">Downloads</a>
          <a href="/solution-files.html?brand=huawei">Huawei</a>
        </div>
        <div>
          <h4 class="footer-title">Downloads</h4>
          <a href="/solution-files.html?brand=huawei">Huawei Folders</a>
          <a href="/solution-files.html?brand=honor">Honor Folders</a>
          <a href="/downloads.html">Open Downloads</a>
          <a href="/remote-service.html">Remote Service</a>
        </div>
        <div>
          <h4 class="footer-title">Core Lines</h4>
          <a href="/solution-files.html?brand=huawei">Huawei Nova</a>
          <a href="/solution-files.html?brand=huawei">Huawei Mate</a>
          <a href="/solution-files.html?brand=honor">Honor X Series</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 AOSUNLOCKER Huawei Lab. All rights reserved.</span>
        <div class="footer-bottom-meta">
          <span>Huawei, Honor, Kirin, HarmonyOS, and Qualcomm only</span>
        </div>
      </div>
    </div>
  </footer>

  <nav class="mobile-bottom-nav" aria-label="Mobile quick navigation">
    <a class="mobile-bottom-nav-item ${activeKey === 'home' ? 'active' : ''}" href="/index.html">
      <i class="fas fa-house"></i>
      <span>Home</span>
    </a>
    <a class="mobile-bottom-nav-item ${downloadsActive ? 'active' : ''}" href="/downloads.html">
      <i class="fas fa-folder-tree"></i>
      <span>Downloads</span>
    </a>
    <a class="mobile-bottom-nav-item mobile-bottom-nav-item-support" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer">
      <i class="fas fa-headset"></i>
      <span>Support</span>
    </a>
    <a class="mobile-bottom-nav-item ${activeKey === 'remote' ? 'active' : ''}" href="/remote-service.html">
      <i class="fas fa-laptop-medical"></i>
      <span>Services</span>
    </a>
    <button class="mobile-bottom-nav-item mobile-bottom-nav-item-menu" type="button" data-mobile-menu-toggle>
      <i class="fas fa-bars"></i>
      <span>Menu</span>
    </button>
  </nav>

  <button id="scrollTopBtn" class="btn btn-primary rounded-circle shadow scroll-top" aria-label="Scroll to top">
    <i class="fas fa-arrow-up"></i>
  </button>
`

export const renderContactAdminPanel = () => `
  <section class="contact-admin-panel">
    <div class="contact-admin-head">
      <p class="eyebrow">Contact</p>
      <h3>Need help with access or ordering?</h3>
      <p>Reach AOSUNLOCKER directly for purchase confirmation, file access help, and service questions.</p>
    </div>
    <div class="contact-admin-grid">
      <a class="contact-card contact-card-whatsapp" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer">
        <span class="contact-card-icon">${whatsappSvg}</span>
        <span class="contact-card-copy">
          <strong>WhatsApp</strong>
          <span>+62 822-3437-0999</span>
        </span>
      </a>
      <a class="contact-card contact-card-facebook" href="https://www.facebook.com/anggaaosunlocker" target="_blank" rel="noreferrer">
        <span class="contact-card-icon">${facebookSvg}</span>
        <span class="contact-card-copy">
          <strong>Facebook</strong>
          <span>anggaaosunlocker</span>
        </span>
      </a>
      <a class="contact-card contact-card-web" href="${primarySiteUrl}" target="_blank" rel="noreferrer">
        <span class="contact-card-icon">${globeSvg}</span>
        <span class="contact-card-copy">
          <strong>Website</strong>
          <span>aosunlocker.com</span>
        </span>
      </a>
    </div>
  </section>
`

export const renderDownloadHeaderBar = (title: string, href: string) => `
  <div class="download-nav-row">
    ${renderBackBlock(title, href)}
    <a class="download-home-button" href="/index.html"><i class="fas fa-house me-2"></i>Home</a>
  </div>
`

export const setupSearchAndScroll = () => {
  hydrateSiteTicker()

  const searchForm = document.querySelector<HTMLFormElement>('#searchForm')
  const searchInput = document.querySelector<HTMLInputElement>('#searchInput')
  const searchDropdown = document.querySelector<HTMLDivElement>('#searchDropdown')
  const contactMenu = document.querySelector<HTMLDetailsElement>('.nav-contact-menu')
  const contactToggle = contactMenu?.querySelector<HTMLElement>('.nav-link-contact-toggle')
  const mobileMenu = document.querySelector<HTMLDetailsElement>('#mobileMenu')
  const mobileMenuToggleButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-mobile-menu-toggle]'))
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.searchable'))
  const warmedHrefs = new Set<string>()
  const warmedElements = new WeakSet<HTMLAnchorElement>()
  const canHover = window.matchMedia('(hover: hover)').matches
  let searchRenderFrame = 0

  const getCardLabel = (card: HTMLElement) => {
    const heading = card.querySelector<HTMLElement>('h1, h2, h3, h4, strong')
    const paragraph = card.querySelector<HTMLElement>('p')
    const title = heading?.textContent?.trim() || card.dataset.searchTitle || 'Result'
    const meta = paragraph?.textContent?.trim() || ''
    return {
      title,
      meta: meta.length > 88 ? `${meta.slice(0, 88).trim()}...` : meta,
    }
  }

  const closeDropdown = () => {
    if (!searchDropdown) return
    searchDropdown.hidden = true
    searchDropdown.innerHTML = ''
  }

  const scheduleDropdownRender = (value: string) => {
    if (searchRenderFrame) {
      window.cancelAnimationFrame(searchRenderFrame)
    }

    searchRenderFrame = window.requestAnimationFrame(() => {
      searchRenderFrame = 0
      renderDropdown(value)
    })
  }

  const focusCard = (card: HTMLElement) => {
    cards.forEach((item) => item.classList.remove('is-highlighted'))
    card.classList.add('is-highlighted')
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    closeDropdown()
  }

  const renderDropdown = (value: string) => {
    if (!searchDropdown) return

    const query = value.trim().toLowerCase()
    if (!query) {
      closeDropdown()
      return
    }

    const matches = cards
      .filter((card) => card.textContent?.toLowerCase().includes(query))
      .slice(0, 5)

    if (!matches.length) {
      searchDropdown.hidden = false
      searchDropdown.innerHTML = `
        <div class="search-dropdown-empty">
          <i class="fas fa-magnifying-glass"></i>
          <span>No matching results for "${value.trim()}"</span>
        </div>
      `
      return
    }

    searchDropdown.hidden = false
    searchDropdown.innerHTML = matches
      .map((card, index) => {
        const { title, meta } = getCardLabel(card)
        return `
          <button class="search-result-item" type="button" data-search-index="${index}">
            <span class="search-result-icon"><i class="fas fa-bolt"></i></span>
            <span class="search-result-copy">
              <strong>${title}</strong>
              ${meta ? `<span>${meta}</span>` : ''}
            </span>
          </button>
        `
      })
      .join('')

    searchDropdown.querySelectorAll<HTMLButtonElement>('[data-search-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.searchIndex)
        const target = matches[index]
        if (target) {
          focusCard(target)
        }
      })
    })
  }

  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault()
    const value = searchInput?.value.trim().toLowerCase() ?? ''

    cards.forEach((card) => card.classList.remove('is-highlighted'))
    if (!value) {
      closeDropdown()
      return
    }

    const found = cards.find((card) => card.textContent?.toLowerCase().includes(value))
    if (found) {
      focusCard(found)
    } else {
      renderDropdown(value)
      window.alert('No matching result was found in this Huawei-focused catalog.')
    }
  })

  searchInput?.addEventListener('input', () => {
    scheduleDropdownRender(searchInput.value)
  })

  searchInput?.addEventListener('focus', () => {
    scheduleDropdownRender(searchInput.value)
  })

  document.addEventListener('click', (event) => {
    const target = event.target as Node | null
    if (!target) return
    if (!searchForm?.contains(target)) {
      closeDropdown()
    }

    if (contactMenu?.open && !contactMenu.contains(target)) {
      contactMenu.open = false
    }

    if (mobileMenu?.open && !mobileMenu.contains(target)) {
      mobileMenu.open = false
    }
  })

  contactMenu?.querySelectorAll<HTMLAnchorElement>('.nav-contact-item').forEach((link) => {
    link.addEventListener('click', () => {
      contactMenu.open = false
    })
  })

  mobileMenuToggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!mobileMenu) return
      mobileMenu.open = !mobileMenu.open
      if (mobileMenu.open) {
        mobileMenu.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  })

  mobileMenu?.querySelectorAll<HTMLAnchorElement>('.mobile-menu-link, .mobile-menu-contact-link').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.open = false
    })
  })

  if (contactMenu && contactToggle && canHover) {
    let hoverCloseTimer: number | undefined

    const openContactMenu = () => {
      if (hoverCloseTimer) {
        window.clearTimeout(hoverCloseTimer)
      }
      contactMenu.open = true
    }

    const closeContactMenu = () => {
      hoverCloseTimer = window.setTimeout(() => {
        contactMenu.open = false
      }, 70)
    }

    contactToggle.addEventListener('click', (event) => {
      event.preventDefault()
      contactMenu.open = !contactMenu.open
    })

    contactMenu.addEventListener('mouseenter', openContactMenu)
    contactMenu.addEventListener('mouseleave', closeContactMenu)
    contactMenu.addEventListener('focusout', (event) => {
      const nextTarget = event.relatedTarget as Node | null
      if (!nextTarget || !contactMenu.contains(nextTarget)) {
        contactMenu.open = false
      }
    })
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDropdown()
      if (contactMenu?.open) {
        contactMenu.open = false
      }
      if (mobileMenu?.open) {
        mobileMenu.open = false
      }
    }
  })

  const scrollTopBtn = document.querySelector<HTMLButtonElement>('#scrollTopBtn')
  if (scrollTopBtn) {
    let scrollTopVisible = false
    const syncScrollTopButton = () => {
      const nextVisible = window.scrollY > 320
      if (nextVisible === scrollTopVisible) return
      scrollTopVisible = nextVisible
      scrollTopBtn.style.display = nextVisible ? 'inline-flex' : 'none'
    }

    syncScrollTopButton()
    window.addEventListener('scroll', syncScrollTopButton, { passive: true })
  }

  scrollTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  const warmLink = (target: EventTarget | null, intent: 'hover' | 'navigation') => {
    const element = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null
    if (!element) return
    if (warmedElements.has(element)) return

    const href = element.getAttribute('href')?.trim() || ''
    if (!href || href.startsWith('#') || href.startsWith('http')) return
    if (warmedHrefs.has(href)) return

    const warmed = warmRouteDataFromHref(href, intent)
    if (!warmed) return

    warmedElements.add(element)
    warmedHrefs.add(href)
  }

  if (canHover) {
    document.addEventListener(
      'mouseover',
      (event) => {
        warmLink(event.target, 'hover')
      },
      { passive: true },
    )
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      warmLink(event.target, 'navigation')
    },
    { passive: true },
  )

  document.addEventListener(
    'touchstart',
    (event) => {
      warmLink(event.target, 'navigation')
    },
    { passive: true },
  )

  document.addEventListener('focusin', (event) => {
    warmLink(event.target, 'navigation')
  })
}

export const renderStars = () => starMarkup
