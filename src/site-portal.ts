import { downloadHomeCategories } from './download-data'
import { loadBrandFolders, peekBrandFolders, syncLiveCacheVersion, warmBrandCategoryData } from './live-data'
import { pageLinks, pages, remoteServiceQualcommEntries, stats } from './portal-data'
import {
  renderDownloadHomeCard,
  renderDownloadEmptyState,
  renderFeature,
  renderPageLinkCard,
  renderContactAdminPanel,
  renderSimpleCard,
  renderSiteChrome,
  setupSearchAndScroll,
} from './site-shared'
import type { RemoteServiceEntry, SitePageKey } from './data-types'

const groupRemoteServiceEntries = (entries: RemoteServiceEntry[]) =>
  Object.entries(
    entries.reduce<Record<string, string[]>>((acc, entry) => {
      if (!acc[entry.platform]) acc[entry.platform] = []
      acc[entry.platform].push(entry.model)
      return acc
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right))

const formatRemotePlatformLabel = (platform: string) => platform.replaceAll('_', ' ')

const buildRemoteServiceMessageUrl = (
  intent: 'job' | 'buy',
  platform: string,
  models: string[],
) => {
  const platformLabel = formatRemotePlatformLabel(platform)
  const preview = models.slice(0, 3).join(', ')
  const message =
    intent === 'job'
      ? `Hello bro, I want do job for ${platformLabel}. Model groups: ${preview || platformLabel}.`
      : `Hello bro, I want buy access for ${platformLabel}. Model groups: ${preview || platformLabel}.`

  return `https://wa.me/6282234370999?text=${encodeURIComponent(message)}`
}

const buildRemoteModelPreview = (models: string[], limit = 4) => {
  const visible = models.slice(0, limit)
  const extra = Math.max(0, models.length - visible.length)
  if (!visible.length) return 'Supported Huawei and Honor model groups are available for this platform.'
  return `${visible.join(', ')}${extra ? ` +${extra} more` : ''}`
}

const renderRemoteServiceRow = ([platform, models]: [string, string[]]) => {
  const platformLabel = formatRemotePlatformLabel(platform)
  const visibleModels = models.slice(0, 6)
  const extraModels = Math.max(0, models.length - visibleModels.length)

  return `
    <article class="remote-service-item searchable">
      <div class="remote-service-item-main">
        <div class="remote-service-item-top">
          <span class="remote-platform-badge">${platformLabel}</span>
          <span class="remote-service-count">${models.length} model groups</span>
        </div>
        <h3>${platformLabel}</h3>
        <p class="remote-service-item-copy">${buildRemoteModelPreview(models)}</p>
        <div class="remote-model-strip">
          ${visibleModels.map((model) => `<span class="remote-model-chip">${model}</span>`).join('')}
          ${extraModels ? `<span class="remote-model-chip remote-model-chip-more">+${extraModels} more</span>` : ''}
        </div>
      </div>
      <div class="remote-service-item-actions">
        <a class="remote-service-action remote-service-action-primary" href="${buildRemoteServiceMessageUrl('job', platform, models)}" target="_blank" rel="noreferrer">Do Job</a>
        <a class="remote-service-action remote-service-action-secondary" href="${buildRemoteServiceMessageUrl('buy', platform, models)}" target="_blank" rel="noreferrer">Buy</a>
      </div>
    </article>
  `
}

const renderBrandHomeGrid = (content = downloadHomeCategories) =>
  content.length
    ? `<div class="download-home-grid">${content.map((item) => renderDownloadHomeCard(item)).join('')}</div>`
    : renderDownloadEmptyState(
        'No brand folders available yet',
        'Published brand folders will appear here automatically as soon as they are available.',
      )

const getOrderedHomeBrands = <T extends { brandId?: string }>(items: T[]) => {
  const preferred = ['huawei', 'honor', 'aos-firmware', 'solution']
  const seen = new Set<string>()
  const normalized = items.filter((item): item is T & { brandId: string } => Boolean(String(item.brandId || '').trim()))

  const leadItems = preferred
    .map((brandId) => normalized.find((item) => item.brandId === brandId))
    .filter((item): item is T & { brandId: string } => Boolean(item))
    .filter((item) => {
      if (seen.has(item.brandId)) return false
      seen.add(item.brandId)
      return true
    })

  const extraItems = normalized.filter((item) => {
    if (seen.has(item.brandId)) return false
    seen.add(item.brandId)
    return true
  })

  return [...leadItems, ...extraItems]
}

const renderRemoteServiceSection = (groups: Array<[string, string[]]>) => {
  const platformFamilies = groups.length

  return `
    <section class="remote-service-section py-4">
      <div class="container">
        <div class="remote-service-shell">
          <div class="remote-service-list-head">
            <div>
              <p class="eyebrow">Service List</p>
              <h2 class="section-title"><i class="fas fa-laptop-medical me-2 text-primary"></i>Choose platform and start service</h2>
              <p class="remote-service-copy">Setiap platform sekarang tampil sebagai list yang lebih ringan. Pilih platform Qualcomm yang cocok, lalu langsung tekan Do Job atau Buy.</p>
            </div>
            <div class="remote-service-list-summary">
              <strong>${platformFamilies}</strong>
              <span>platform families</span>
              <small>${remoteServiceQualcommEntries.length} supported model groups</small>
            </div>
          </div>
          <div class="remote-service-list">
            ${groups.map((group) => renderRemoteServiceRow(group)).join('')}
          </div>
        </div>
      </div>
    </section>
  `
}

export const renderRemoteServicePage = () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const groups = groupRemoteServiceEntries(remoteServiceQualcommEntries)

  document.title = 'Remote Service | AOSUNLOCKER Huawei Lab'

  app.innerHTML = renderSiteChrome(
    `
      <main class="remote-service-page">
        <section class="remote-service-hero">
          <div class="container py-4">
            <div class="remote-service-hero-shell">
              <div class="remote-service-hero-copy">
                <p class="eyebrow">Remote Service</p>
                <h1 class="remote-service-hero-title">Qualcomm ID remote service for Huawei and Honor devices.</h1>
                <p class="remote-service-hero-text">Halaman ini saya ringkas supaya lebih enak dibaca. Tidak pakai tabel padat lagi. Cukup pilih platform Qualcomm di bawah, lalu langsung tekan Do Job atau Buy.</p>
                <div class="remote-service-hero-cta">
                  <a class="hero-cta-button hero-cta-button-amber" href="https://wa.me/6282234370999?text=Hello%20bro%2C%20I%20want%20Qualcomm%20ID%20remote%20service." target="_blank" rel="noreferrer">Do Job</a>
                  <a class="hero-cta-button hero-cta-button-light" href="https://wa.me/6282234370999?text=Hello%20bro%2C%20I%20want%20to%20buy%20Qualcomm%20ID%20remote%20service." target="_blank" rel="noreferrer">Buy</a>
                  <a class="hero-cta-button hero-cta-button-ghost" href="https://www.facebook.com/anggaaosunlocker" target="_blank" rel="noreferrer">Open Facebook</a>
                </div>
              </div>
              <div class="remote-service-hero-side">
                <article class="remote-hero-stat-card">
                  <span class="remote-hero-stat-label">Coverage</span>
                  <strong>${remoteServiceQualcommEntries.length}</strong>
                  <p>supported model groups</p>
                </article>
                <article class="remote-hero-stat-card">
                  <span class="remote-hero-stat-label">Platforms</span>
                  <strong>${groups.length}</strong>
                  <p>Qualcomm families ready</p>
                </article>
                <article class="remote-hero-stat-card">
                  <span class="remote-hero-stat-label">Flow</span>
                  <strong>Fast</strong>
                  <p>Do Job or Buy directly</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        ${renderRemoteServiceSection(groups)}

        <section class="py-5">
          <div class="container">
            ${renderContactAdminPanel()}
          </div>
        </section>
      </main>
    `,
    'remote',
  )

  setupSearchAndScroll()
}

export const renderPage = async (pageKey: SitePageKey) => {
  const page = pages[pageKey]
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app || !page) return

  const versionSyncPromise = page.key === 'home' ? syncLiveCacheVersion() : Promise.resolve(false)

  if (page.key === 'home') {
    // keep rendering immediate from cache/local content while version sync runs in the background
  }

  document.title = page.title
  const heroHasEyebrow = Boolean(page.eyebrow && page.eyebrow.trim())
  const heroHasCopy = Boolean(page.heroCopy && page.heroCopy.trim())
  const heroHeading =
    page.key === 'home'
      ? `<h2 class="hero-title-home">${page.heroTitle}</h2>`
      : `<h2><i class="fas fa-mobile-alt me-2 text-primary"></i>${page.heroTitle}</h2>`
  const heroSection =
    page.key === 'home'
      ? ''
      : `
      <section class="hero-section">
        <div class="container py-5">
          <div class="hero-panel hero-panel-clean">
            <div class="hero-center">
              ${heroHasEyebrow ? `<p class="eyebrow">${page.eyebrow}</p>` : ''}
              ${heroHeading}
              ${heroHasCopy ? `<p class="lead-copy">${page.heroCopy}</p>` : ''}
            </div>
            <div class="stats-strip">
              <div class="stats-row">
                ${stats
                  .map(
                    (item) => `
                      <div class="stats-item">
                        <article class="stat-card text-center p-4 bg-white rounded-4 border-${item.tone} border-2 searchable">
                          <i class="fas ${item.icon} text-${item.tone} mb-3"></i>
                          <h3 class="fw-bold mb-1 text-${item.tone}">${item.value}</h3>
                          <p class="text-muted mb-0">${item.label}</p>
                        </article>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </section>
    `

  app.innerHTML = renderSiteChrome(
    `
      <main id="overview">
      ${heroSection}

      <section class="py-4 section-soft ${page.key === 'home' ? 'section-soft-home' : ''}">
        <div class="container">
          ${
            page.key === 'home'
              ? `
                <div class="downloads-home-head">
                  <p class="eyebrow">Download Firmware</p>
                </div>
                <div class="downloads-home-shell" id="homeBrandMount">${renderBrandHomeGrid(getOrderedHomeBrands(downloadHomeCategories))}</div>
              `
              : `
                <div class="section-head">
                  <div>
                    <p class="eyebrow">Portal Pages</p>
                    <h2 class="section-title"><i class="fas fa-compass me-2 text-primary"></i>Browse Main Sections</h2>
                  </div>
                </div>
                <div class="row g-4">
                  ${pageLinks.map((item) => renderPageLinkCard(item)).join('')}
                </div>
              `
          }
        </div>
      </section>

      <section id="focus" class="py-5 deferred-section">
        <div class="container">
          <div class="section-head">
            <div>
              <p class="eyebrow">${page.primaryEyebrow}</p>
              <h2 class="section-title"><i class="fas fa-bullseye me-2 text-primary"></i>${page.primaryTitle}</h2>
            </div>
          </div>
          <div class="row g-4">${page.primaryItems.map((item) => renderSimpleCard(item)).join('')}</div>
        </div>
      </section>

      <section id="features" class="py-5 deferred-section">
        <div class="container">
          <div class="text-center mb-4">
            <p class="eyebrow">${page.featureEyebrow}</p>
            <h2 class="section-title justify-content-center"><i class="fas fa-rocket me-2 text-primary"></i>${page.featureTitle}</h2>
          </div>
          <div class="feature-strip">
            <div class="feature-row">${page.featureItems.map((item) => renderFeature(item)).join('')}</div>
          </div>
        </div>
      </section>

      <section class="cta-band py-5">
        <div class="container text-center">
          <p class="eyebrow text-white-50">${page.ctaEyebrow}</p>
          <h2 class="text-white mb-3">${page.ctaTitle}</h2>
          <p class="lead-copy text-white-50 mb-4">${page.ctaCopy}</p>
          <div class="hero-cta justify-content-center">
            <a class="hero-cta-button hero-cta-button-primary" href="/downloads.html">Open Download Center</a>
            <a class="hero-cta-button hero-cta-button-light" href="/solution-files.html?brand=huawei">Huawei</a>
            <a class="hero-cta-button hero-cta-button-success" href="/solution-files.html?brand=honor">Honor</a>
            <a class="hero-cta-button hero-cta-button-amber" href="/remote-service.html">Remote Service</a>
            <a class="hero-cta-button hero-cta-button-ghost" href="#footer">Contact</a>
          </div>
        </div>
      </section>
      </main>
    `,
    page.key,
  )

  setupSearchAndScroll()

  if (page.key !== 'home') return

  const brandMount = document.querySelector<HTMLDivElement>('#homeBrandMount')

  if (brandMount) {
    const cachedBrandCards = getOrderedHomeBrands(peekBrandFolders()?.brands ?? downloadHomeCategories)
    brandMount.innerHTML = renderBrandHomeGrid(cachedBrandCards.length ? cachedBrandCards : getOrderedHomeBrands(downloadHomeCategories))
    warmBrandCategoryData(cachedBrandCards.map((item) => item.brandId).filter(Boolean))
  }

  await versionSyncPromise
  const brandPromise = loadBrandFolders()

  void brandPromise.then((brandResult) => {
    if (!brandMount?.isConnected) return

    const brandCards = getOrderedHomeBrands(brandResult.brands.length ? brandResult.brands : downloadHomeCategories)
    brandMount.innerHTML = renderBrandHomeGrid(brandCards)
    warmBrandCategoryData(brandCards.map((item) => item.brandId).filter(Boolean))
  })

  await brandPromise
}
