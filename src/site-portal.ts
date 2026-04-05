import { downloadHomeCategories } from './download-data'
import { loadBrandFolders } from './live-data'
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

const renderBrandHomeGrid = (content = downloadHomeCategories) =>
  content.length
    ? `<div class="download-home-grid">${content.map((item) => renderDownloadHomeCard(item)).join('')}</div>`
    : renderDownloadEmptyState(
        'No brand folders available yet',
        'Published brand folders will appear here automatically as soon as they are available.',
      )

const renderRemoteServiceSection = () => {
  const groups = groupRemoteServiceEntries(remoteServiceQualcommEntries)

  return `
    <section class="remote-service-section py-5">
      <div class="container">
        <div class="remote-service-shell">
          <div class="remote-service-head">
            <div>
              <p class="eyebrow">Remote Service</p>
              <h2 class="section-title"><i class="fas fa-laptop-medical me-2 text-primary"></i>Qualcomm ID Instant Coverage</h2>
              <p class="remote-service-copy">Fast remote support for supported Huawei, Honor, and Qualcomm-based service jobs. Select the matching platform family below before confirming the job.</p>
            </div>
            <div class="remote-service-contact-row">
              <a class="remote-service-contact remote-service-contact-whatsapp" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer"><i class="fab fa-whatsapp"></i><span>WhatsApp</span></a>
              <a class="remote-service-contact remote-service-contact-facebook" href="https://www.facebook.com/anggaaosunlocker" target="_blank" rel="noreferrer"><i class="fab fa-facebook-f"></i><span>Facebook</span></a>
              <a class="remote-service-contact remote-service-contact-web" href="https://aosunlocker.com" target="_blank" rel="noreferrer"><i class="fas fa-globe"></i><span>Website</span></a>
            </div>
          </div>
          <div class="remote-service-highlight-row">
            <div class="remote-service-highlight-card">
              <span class="remote-service-highlight-label">Service Type</span>
              <strong>Qualcomm ID Instant</strong>
            </div>
            <div class="remote-service-highlight-card">
              <span class="remote-service-highlight-label">Coverage</span>
              <strong>${remoteServiceQualcommEntries.length} supported model groups</strong>
            </div>
            <div class="remote-service-highlight-card">
              <span class="remote-service-highlight-label">Delivery</span>
              <strong>Remote workflow with direct support response</strong>
            </div>
          </div>
          <div class="remote-service-grid">
            ${groups
              .map(
                ([platform, models]) => `
                  <article class="remote-platform-card searchable">
                    <div class="remote-platform-head">
                      <span class="remote-platform-badge">${platform.replaceAll('_', ' ')}</span>
                      <strong>${models.length} model groups</strong>
                    </div>
                    <div class="remote-model-chip-grid">
                      ${models.map((model) => `<span class="remote-model-chip">${model}</span>`).join('')}
                    </div>
                  </article>
                `,
              )
              .join('')}
          </div>
        </div>
      </div>
    </section>
  `
}

export const renderRemoteServicePage = () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  document.title = 'Remote Service | AOSUNLOCKER Huawei Lab'

  app.innerHTML = renderSiteChrome(
    `
      <main class="remote-service-page">
        <section class="remote-service-hero">
          <div class="container py-5">
            <div class="remote-service-hero-shell">
              <div class="remote-service-hero-copy">
                <p class="eyebrow">Remote Service</p>
                <h1 class="remote-service-hero-title">Qualcomm ID instant service coverage for supported Huawei and Honor platforms.</h1>
                <p class="remote-service-hero-text">A dedicated page for fast remote support, Qualcomm-based ID jobs, and direct service-side communication. Browse supported platform families below, then move straight into WhatsApp, Facebook, or website contact.</p>
                <div class="remote-service-hero-cta">
                  <a class="hero-cta-button hero-cta-button-amber" href="https://wa.me/6282234370999" target="_blank" rel="noreferrer">Start WhatsApp Order</a>
                  <a class="hero-cta-button hero-cta-button-light" href="https://www.facebook.com/anggaaosunlocker" target="_blank" rel="noreferrer">Open Facebook</a>
                  <a class="hero-cta-button hero-cta-button-ghost" href="https://aosunlocker.com" target="_blank" rel="noreferrer">Visit Website</a>
                </div>
              </div>
              <div class="remote-service-hero-side">
                <article class="remote-hero-stat-card">
                  <span class="remote-hero-stat-label">Coverage</span>
                  <strong>${remoteServiceQualcommEntries.length}</strong>
                  <p>supported model groups</p>
                </article>
                <article class="remote-hero-stat-card">
                  <span class="remote-hero-stat-label">Workflow</span>
                  <strong>Instant</strong>
                  <p>remote support handling</p>
                </article>
                <article class="remote-hero-stat-card">
                  <span class="remote-hero-stat-label">Scope</span>
                  <strong>Huawei / Honor</strong>
                  <p>Qualcomm-based device families</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        ${renderRemoteServiceSection()}

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
                <div class="downloads-home-head downloads-home-head-compact">
                  <p class="eyebrow">Huawei & Honor Files</p>
                  <h2 class="visually-hidden">Huawei & Honor Files</h2>
                </div>
                <div class="downloads-home-shell" id="homeBrandMount">${renderDownloadEmptyState(
                  'Loading folders',
                  'Preparing brand folders for this session.',
                )}</div>
              `
              : `
                <div class="section-head">
                  <div>
                    <p class="eyebrow">Portal Pages</p>
                    <h2 class="section-title"><i class="fas fa-compass me-2 text-primary"></i>Browse Focused Sections</h2>
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
    brandMount.innerHTML = renderBrandHomeGrid()
  }

  const brandPromise = loadBrandFolders()

  void brandPromise.then((brandResult) => {
    if (!brandMount?.isConnected) return

    const brandCards = brandResult.brands.length ? brandResult.brands : downloadHomeCategories
    brandMount.innerHTML = renderBrandHomeGrid(brandCards)
  })

  await brandPromise
}
