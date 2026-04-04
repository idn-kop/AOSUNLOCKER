import {
  anaAn00Files,
  firmwareHuaweiCards,
  huaweiUpdateFolders,
} from './download-data'
import { fileMap } from './portal-data'
import {
  renderDownloadHomeCard,
  renderBrandDownloadCard,
  renderContactAdminPanel,
  renderDownloadBreadcrumbs,
  renderDownloadDetailSkeleton,
  renderDownloadEmptyState,
  renderDownloadGridCard,
  renderDownloadHeaderBar,
  renderDownloadListRow,
  renderDownloadResultsSkeleton,
  renderDownloadHomeSkeleton,
  renderFirmware,
  renderModelFolderCard,
  renderSiteChrome,
  renderStars,
  setupSearchAndScroll,
} from './site-shared'
import {
  hasLiveApi,
  incrementDownloadCount,
  loadBrandFolders,
  loadCategoriesByBrand,
  loadFileById,
  loadFilesByCategory,
  peekBrandFolders,
  peekCategoriesByBrand,
  peekFilesByCategory,
} from './live-data'
import type { BrandId } from './data-types'

type ToolbarSortField = 'date' | 'title'
type ToolbarSortOrder = 'desc' | 'asc'
type ToolbarView = 'list' | 'grid'

const getBrandMeta = (brandId: BrandId) => {
  const normalized = String(brandId || '').trim() || 'brand'
  const label = normalized
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

  return {
    label,
    description: `Open ${label}-focused solution folders, repair categories, and service packages.`,
  }
}

type DownloadCurrent = {
  title: string
  subtitle: string
  date: string
  size: string
  visits: string
  downloads: string
  price?: string
  featured?: boolean
  backLabel: string
  backHref: string
}

const buildGoogleDriveDownloadUrl = (url: string) => {
  const raw = String(url || '').trim()
  if (!raw) return ''

  const fileMatch = raw.match(/\/file\/d\/([^/]+)/i)
  if (fileMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`
  }

  try {
    const parsed = new URL(raw)
    const id = parsed.searchParams.get('id')
    if (id) {
      return `https://drive.google.com/uc?export=download&id=${id}`
    }
  } catch {
    return raw
  }

  return raw
}

const renderDownloadToolbar = (
  sortField: ToolbarSortField = 'date',
  sortOrder: ToolbarSortOrder = 'desc',
  view: ToolbarView = 'list',
) => `
  <div class="download-toolbar">
    <div class="download-toolbar-left">
      <button class="download-filter ${sortField === 'date' ? 'download-filter-active' : ''}" type="button" data-sort-field="date">Date</button>
      <button class="download-filter ${sortField === 'title' ? 'download-filter-active' : ''}" type="button" data-sort-field="title">Title</button>
      <button class="download-filter ${sortOrder === 'desc' ? 'download-filter-active' : ''}" type="button" data-sort-order="desc">Descending</button>
      <button class="download-filter ${sortOrder === 'asc' ? 'download-filter-active' : ''}" type="button" data-sort-order="asc">Ascending</button>
    </div>
    <div class="download-toolbar-right">
      <button class="download-view-toggle ${view === 'grid' ? 'download-view-toggle-active' : ''}" type="button" data-view-mode="grid"><i class="fas fa-grip me-2"></i>Grid</button>
      <button class="download-view-toggle ${view === 'list' ? 'download-view-toggle-active' : ''}" type="button" data-view-mode="list"><i class="fas fa-list me-2"></i>List</button>
    </div>
  </div>
`

const normalizeSortField = (value: string | null): ToolbarSortField => (value === 'title' ? 'title' : 'date')
const normalizeSortOrder = (value: string | null): ToolbarSortOrder => (value === 'asc' ? 'asc' : 'desc')
const normalizeViewMode = (value: string | null): ToolbarView => (value === 'grid' ? 'grid' : 'list')

const parseDateScore = (value: string) => {
  const raw = String(value || '').trim()
  if (!raw) return 0

  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (match) {
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime()
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const sortDownloadFiles = (files: typeof anaAn00Files, sortField: ToolbarSortField, sortOrder: ToolbarSortOrder) => {
  const factor = sortOrder === 'asc' ? 1 : -1

  return [...files].sort((a, b) => {
    if (sortField === 'title') {
      return a.title.localeCompare(b.title) * factor
    }

    const scoreA = parseDateScore(a.date)
    const scoreB = parseDateScore(b.date)

    if (scoreA !== scoreB) {
      return (scoreA - scoreB) * factor
    }

    return a.title.localeCompare(b.title)
  })
}

const renderSolutionFileResults = (files: typeof anaAn00Files, view: ToolbarView, categoryTitle: string) => {
  if (!files.length) {
    return renderDownloadEmptyState(
      `No ${categoryTitle} files yet`,
      'No published files are available in this category yet.',
    )
  }

  if (view === 'grid') {
    return `<div class="download-grid-wrap">${files.map((item) => renderDownloadGridCard(item)).join('')}</div>`
  }

  return `<div class="download-list-wrap">${files.map((item) => renderDownloadListRow(item)).join('')}</div>`
}

const renderDownloadsHubStage = (content: string) => `
  <main class="download-flow-page">
    <div class="container py-4">
      ${renderDownloadBreadcrumbs([{ label: 'Home', href: '/index.html' }, { label: 'Downloads' }])}
      <section class="download-stage-card">
        <div class="download-stage-head">
          <h1>Choose a Brand</h1>
          <p>Select the brand first, then open the right solution folder for that device family.</p>
        </div>
        ${content}
      </section>
    </div>
  </main>
`

const renderSolutionBrandStage = (brandLabel: string, brandDescription: string, content: string) => `
  <main class="download-flow-page">
    <div class="container py-4">
      ${renderDownloadBreadcrumbs([
        { label: 'Home', href: '/index.html' },
        { label: 'Downloads', href: '/downloads.html' },
        { label: brandLabel },
      ])}
      <section class="download-stage-card">
        ${renderDownloadHeaderBar('Downloads', '/downloads.html')}
        <div class="download-stage-head">
          <h1>${brandLabel}</h1>
          <p>${brandDescription}</p>
        </div>
        ${content}
      </section>
    </div>
  </main>
`

const renderSolutionCategoryStage = (brandId: BrandId, brandLabel: string, categoryTitle: string, body: string) => `
  <main class="download-flow-page">
    <div class="container py-4">
      ${renderDownloadBreadcrumbs([
        { label: 'Home', href: '/index.html' },
        { label: 'Downloads', href: '/downloads.html' },
        { label: brandLabel, href: `/solution-files.html?brand=${brandId}` },
        { label: categoryTitle },
      ])}
      <section class="download-stage-card">
        ${renderDownloadHeaderBar(brandLabel, `/solution-files.html?brand=${brandId}`)}
        ${body}
      </section>
    </div>
  </main>
`

export const renderDownloadPage = () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const params = new URLSearchParams(window.location.search)
  const fileId = params.get('file') ?? 'huawei-nova-11i-board-software'
  const file = fileMap[fileId] ?? fileMap['huawei-nova-11i-board-software']

  if (!file) return

  document.title = `${file.title} | AOSUNLOCKER Huawei Lab`

  const related = Object.values(fileMap)
    .filter((item) => item.brand === file.brand || item.id !== file.id)
    .slice(0, 3)

  app.innerHTML = `
    <div class="top-bar">
      <div class="container d-flex justify-content-between align-items-center flex-wrap">
        <div class="d-flex flex-wrap">
          <a href="/index.html"><i class="fas fa-house me-1"></i>Home</a>
          <a href="/solution-files.html?brand=huawei"><i class="fas fa-mobile-alt me-1"></i>Huawei</a>
          <a href="/solution-files.html?brand=honor"><i class="fas fa-download me-1"></i>Honor</a>
        </div>
        <div class="d-flex flex-wrap">
          <a href="#related"><i class="fas fa-shield-alt me-1"></i>Related Files</a>
          <a href="#footer"><i class="fas fa-headset me-1"></i>Support</a>
        </div>
      </div>
    </div>

    <header class="middle-header">
      <div class="container">
        <div class="logo-block">
          <div class="logo-icon-wrap">
            <i class="fas fa-download logo-icon"></i>
          </div>
          <div>
            <p class="eyebrow">Download Page</p>
            <h1 class="logo-title">${file.title}</h1>
            <div class="logo-note"><i class="fas fa-circle-check"></i>Focused download detail for Huawei and Honor service files</div>
          </div>
        </div>
        <a class="download-link" href="/index.html">Back Home</a>
      </div>
    </header>

    <main class="py-5">
      <div class="container">
        <section class="section-card">
          <div class="breadcrumb-row">
            <a href="/index.html">Home</a>
            <span>/</span>
            <a href="/download.html?file=${file.id}">Download</a>
            <span>/</span>
            <span>${file.title}</span>
          </div>
          <div class="detail-card">
            <div class="detail-head">
              <div class="detail-copy">
                <div class="file-badge-row">
                  ${file.status.map((status) => `<span class="badge status-chip">${status}</span>`).join('')}
                </div>
                <h2>${file.title}</h2>
                <p>${file.description}</p>
              </div>
            </div>

            <div class="detail-meta-grid">
              <div><strong>Date</strong><span>${file.date}</span></div>
              <div><strong>Filesize</strong><span>${file.size}</span></div>
              <div><strong>Visits</strong><span>${file.visits}</span></div>
              <div><strong>Downloads</strong><span>${file.downloads}</span></div>
            </div>

            <div class="detail-actions">
              <a class="download-button" href="#">Download File</a>
              <span class="file-category">${file.brand}</span>
            </div>
          </div>
        </section>

        <section id="related" class="section-card mt-4">
          <div class="section-head">
            <div>
              <p class="eyebrow">Related Files</p>
              <h2 class="section-title"><i class="fas fa-link me-2 text-primary"></i>More Downloads</h2>
            </div>
          </div>
          <div class="row g-4">${related.map((item) => renderFirmware(item)).join('')}</div>
        </section>
      </div>
    </main>

    <footer id="footer" class="footer-shell">
      <div class="container py-5">
        <div class="footer-bottom">
          <span>&copy; 2026 AOSUNLOCKER Huawei Lab. All rights reserved.</span>
          <span>Huawei, Honor, Kirin, HarmonyOS, and Qualcomm only</span>
        </div>
      </div>
    </footer>
  `
}

export const renderDownloadsHubPage = async () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  document.title = 'Downloads | AOSUNLOCKER Huawei Lab'

  const cachedBrandResult = peekBrandFolders()

  if (cachedBrandResult) {
    const brandCards = cachedBrandResult.brands
    app.innerHTML = renderSiteChrome(
      renderDownloadsHubStage(
        brandCards.length
          ? `<div class="download-home-grid">${brandCards.map((item) => renderDownloadHomeCard(item)).join('')}</div>`
          : renderDownloadEmptyState(
              'No brand folders available yet',
              'Published brand folders will appear here automatically as soon as they are available.',
            ),
      ),
      undefined,
      true,
    )
  } else {
    app.innerHTML = renderSiteChrome(renderDownloadsHubStage(renderDownloadHomeSkeleton(3)), undefined, true)
  }

  const brandResult = await loadBrandFolders()
  const brandCards = brandResult.brands

  app.innerHTML = renderSiteChrome(
    renderDownloadsHubStage(
      brandCards.length
        ? `<div class="download-home-grid">${brandCards.map((item) => renderDownloadHomeCard(item)).join('')}</div>`
        : renderDownloadEmptyState(
            'No brand folders available yet',
            'Published brand folders will appear here automatically as soon as they are available.',
          ),
    ),
    undefined,
    true,
  )
  setupSearchAndScroll()
}

export const renderSolutionFilesPage = async () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const params = new URLSearchParams(window.location.search)
  const brandId = (params.get('brand') || 'huawei') as BrandId
  const categoryId = params.get('category')
  const initialSortField = normalizeSortField(params.get('sort'))
  const initialSortOrder = normalizeSortOrder(params.get('order'))
  const initialView = normalizeViewMode(params.get('view'))
  const brand = getBrandMeta(brandId)
  const cachedCategoryResult = !categoryId ? peekCategoriesByBrand(brandId) : null
  const cachedFileResult = categoryId ? peekFilesByCategory(categoryId, brandId) : null

  document.title = `${brand.label} Solution Files | Huawei - Honor Downloads`

  if (!categoryId) {
    if (cachedCategoryResult) {
      const categories = cachedCategoryResult.categories
      app.innerHTML = renderSiteChrome(
        renderSolutionBrandStage(
          brand.label,
          brand.description,
          categories.length
            ? `<div class="download-home-grid">${categories
                .map(
                  (item) =>
                    renderDownloadHomeCard({
                      title: item.title,
                      description: item.description,
                      href: `/solution-files.html?brand=${brandId}&category=${item.id}`,
                      kind: 'folder',
                    }),
                )
                .join('')}</div>`
            : renderDownloadEmptyState(
                `No ${brand.label} folders yet`,
                `There are no ${brand.label} solution folders connected yet.`,
              ),
        ),
        undefined,
        true,
      )
    } else {
      app.innerHTML = renderSiteChrome(renderSolutionBrandStage(brand.label, brand.description, renderDownloadHomeSkeleton(6)), undefined, true)
    }
  } else {
    if (cachedFileResult) {
      app.innerHTML = renderSiteChrome(
        renderSolutionCategoryStage(
          brandId,
          brand.label,
          cachedFileResult.category.title,
          `
            <div class="download-stage-head">
              <h1>${cachedFileResult.category.title}</h1>
              <p>${brand.label} ${cachedFileResult.category.description}</p>
            </div>
            <div id="solutionToolbar"></div>
            <div id="solutionResults"></div>
          `,
        ),
        undefined,
        true,
      )
    } else {
      app.innerHTML = renderSiteChrome(
        renderSolutionCategoryStage(
          brandId,
          brand.label,
          'Loading...',
          `
            <div class="download-stage-head">
              <h1>Loading folder</h1>
              <p>Preparing files for ${brand.label}.</p>
            </div>
            ${renderDownloadResultsSkeleton(3)}
          `,
        ),
        undefined,
        true,
      )
    }
  }

  if (!categoryId) {
    const categoryResult = await loadCategoriesByBrand(brandId)
    const categories = categoryResult.categories

    app.innerHTML = renderSiteChrome(
      renderSolutionBrandStage(
        brand.label,
        brand.description,
        categories.length
          ? `<div class="download-home-grid">${categories
              .map(
                (item) =>
                  renderDownloadHomeCard({
                    title: item.title,
                    description: item.description,
                    href: `/solution-files.html?brand=${brandId}&category=${item.id}`,
                    kind: 'folder',
                  }),
              )
              .join('')}</div>`
          : renderDownloadEmptyState(
              `No ${brand.label} folders yet`,
              `There are no ${brand.label} solution folders connected yet.`,
            ),
      ),
      undefined,
      true,
    )

    setupSearchAndScroll()
    return
  }

  const result = await loadFilesByCategory(categoryId, brandId)
  const category = result.category
  const files = result.files

  document.title = `${brand.label} ${category.title} | Downloads`

  app.innerHTML = renderSiteChrome(
    renderSolutionCategoryStage(
      brandId,
      brand.label,
      category.title,
      `
        <div class="download-stage-head">
          <h1>${category.title}</h1>
          <p>${brand.label} ${category.description}</p>
        </div>
        <div id="solutionToolbar"></div>
        <div id="solutionResults"></div>
      `,
    ),
    undefined,
    true,
  )

  const toolbarMount = document.querySelector<HTMLDivElement>('#solutionToolbar')
  const resultsMount = document.querySelector<HTMLDivElement>('#solutionResults')
  const state = {
    sortField: initialSortField,
    sortOrder: initialSortOrder,
    view: initialView,
  }

  const syncUrl = () => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set('brand', brandId)
    nextParams.set('category', categoryId)
    nextParams.set('sort', state.sortField)
    nextParams.set('order', state.sortOrder)
    nextParams.set('view', state.view)
    const nextUrl = `${window.location.pathname}?${nextParams.toString()}`
    window.history.replaceState({}, '', nextUrl)
  }

  const bindToolbar = () => {
    toolbarMount?.querySelectorAll<HTMLElement>('[data-sort-field]').forEach((button) => {
      button.addEventListener('click', () => {
        state.sortField = normalizeSortField(button.dataset.sortField ?? null)
        renderInteractiveSection()
      })
    })

    toolbarMount?.querySelectorAll<HTMLElement>('[data-sort-order]').forEach((button) => {
      button.addEventListener('click', () => {
        state.sortOrder = normalizeSortOrder(button.dataset.sortOrder ?? null)
        renderInteractiveSection()
      })
    })

    toolbarMount?.querySelectorAll<HTMLElement>('[data-view-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        state.view = normalizeViewMode(button.dataset.viewMode ?? null)
        renderInteractiveSection()
      })
    })
  }

  const renderInteractiveSection = () => {
    const sortedFiles = sortDownloadFiles(files, state.sortField, state.sortOrder)
    if (toolbarMount) {
      toolbarMount.innerHTML = renderDownloadToolbar(state.sortField, state.sortOrder, state.view)
    }
    if (resultsMount) {
      resultsMount.innerHTML = renderSolutionFileResults(sortedFiles, state.view, category.title)
    }
    bindToolbar()
    syncUrl()
  }

  renderInteractiveSection()
  setupSearchAndScroll()
}

export const renderFirmwareHuaweiPage = () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  document.title = 'Firmware | Huawei Downloads'

  app.innerHTML = renderSiteChrome(
    `
    <main class="download-flow-page">
      <div class="container py-4">
        ${renderDownloadBreadcrumbs([
          { label: 'Home', href: '/index.html' },
          { label: 'Downloads', href: '/downloads.html' },
          { label: 'FIRMWARE', href: '/firmware.html' },
          { label: 'HUAWEI' },
        ])}
        <section class="download-stage-card">
          ${renderDownloadHeaderBar('FIRMWARE', '/downloads.html')}
          <div class="download-stage-head">
            <h1>HUAWEI</h1>
            <p>Download Firmware</p>
          </div>
          <div class="brand-download-grid">
            ${firmwareHuaweiCards.map((item) => renderBrandDownloadCard(item)).join('')}
          </div>
        </section>
      </div>
    </main>
  `,
    undefined,
    true,
  )
  setupSearchAndScroll()
}

export const renderHuaweiUpdateFoldersPage = () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  document.title = '3.Huawei Firmware Update | Huawei Downloads'

  app.innerHTML = renderSiteChrome(
    `
    <main class="download-flow-page">
      <div class="container py-4">
        ${renderDownloadBreadcrumbs([
          { label: 'Home', href: '/index.html' },
          { label: 'Downloads', href: '/downloads.html' },
          { label: 'FIRMWARE', href: '/firmware.html' },
          { label: 'HUAWEI', href: '/firmware.html' },
          { label: '3.Huawei Firmware Update' },
        ])}
        <section class="download-stage-card">
          ${renderDownloadHeaderBar('HUAWEI', '/firmware.html')}
          <div class="download-stage-head">
            <h1>3.Huawei Firmware Update</h1>
            <p>Download Firmware</p>
          </div>
          <div class="model-folder-grid">
            ${huaweiUpdateFolders.map((item) => renderModelFolderCard(item)).join('')}
          </div>
        </section>
      </div>
    </main>
  `,
    undefined,
    true,
  )
  setupSearchAndScroll()
}

export const renderAnaAn00ListPage = () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  document.title = 'ANA-AN00 | Huawei Downloads'

  app.innerHTML = renderSiteChrome(
    `
    <main class="download-flow-page">
      <div class="container py-4">
        ${renderDownloadBreadcrumbs([
          { label: 'Home', href: '/index.html' },
          { label: 'Downloads', href: '/downloads.html' },
          { label: 'FIRMWARE', href: '/firmware.html' },
          { label: 'HUAWEI', href: '/firmware.html' },
          { label: '3.Huawei Firmware Update', href: '/huawei-update.html' },
          { label: 'ANA-AN00' },
        ])}
        <section class="download-stage-card">
          ${renderDownloadHeaderBar('3.Huawei Firmware Update', '/huawei-update.html')}
          <div class="download-stage-head">
            <h1>ANA-AN00</h1>
            <p>ANA-AN00</p>
          </div>
          ${renderDownloadToolbar()}
          <div class="download-list-wrap">
            ${anaAn00Files.map((item) => renderDownloadListRow(item)).join('')}
          </div>
        </section>
      </div>
    </main>
  `,
    undefined,
    true,
  )
  setupSearchAndScroll()
}

export const renderDownloadFlowDetailPage = async () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const params = new URLSearchParams(window.location.search)
  const id = params.get('file') ?? 'ana-an00-harmony3-remove-id'

  document.title = 'Download | Huawei Downloads'

  app.innerHTML = renderSiteChrome(
    `
    <main class="download-flow-page">
      <div class="container py-4">
        ${renderDownloadBreadcrumbs([
          { label: 'Downloads', href: '/downloads.html' },
          { label: 'HUAWEI - HONOR', href: '/downloads.html' },
          { label: 'Loading...' },
        ])}
        <section class="download-stage-card">
          ${renderDownloadHeaderBar('Downloads', '/downloads.html')}
          ${renderDownloadDetailSkeleton()}
        </section>
      </div>
    </main>
  `,
    undefined,
    true,
  )

  const liveResult = await loadFileById(id)
  const liveCurrent = liveResult.file
  const isMissingLiveFile = liveResult.source === 'live' && !liveCurrent
  const liveApiEnabled = hasLiveApi()

  if (isMissingLiveFile || (liveApiEnabled && liveResult.source === 'live-error')) {
    app.innerHTML = renderSiteChrome(
      `
      <main class="download-flow-page">
        <div class="container py-4">
          ${renderDownloadBreadcrumbs([
            { label: 'Downloads', href: '/downloads.html' },
            { label: 'HUAWEI - HONOR', href: '/downloads.html' },
            { label: 'Solution Files', href: '/downloads.html' },
          ])}
          <section class="download-stage-card">
            ${renderDownloadHeaderBar('Solution Files', '/downloads.html')}
            ${renderDownloadEmptyState(
              isMissingLiveFile ? 'This file is not available yet' : 'This file is temporarily unavailable',
              isMissingLiveFile
                ? 'A matching file is not available yet. It will appear here automatically once published.'
                : 'The file source could not be reached right now. Please try again in a moment.',
            )}
          </section>
        </div>
      </main>
    `,
      undefined,
      true,
    )

    setupSearchAndScroll()
    return
  }

  const activeSolutionCategory = liveCurrent ? liveResult.category : null

  if (!liveCurrent) {
    app.innerHTML = renderSiteChrome(
      `
      <main class="download-flow-page">
        <div class="container py-4">
          ${renderDownloadBreadcrumbs([
            { label: 'Downloads', href: '/downloads.html' },
            { label: 'HUAWEI - HONOR', href: '/downloads.html' },
            { label: 'Solution Files', href: '/downloads.html' },
          ])}
          <section class="download-stage-card">
            ${renderDownloadHeaderBar('Solution Files', '/downloads.html')}
            ${renderDownloadEmptyState(
              'This file is not available',
              'A matching published file could not be found right now.',
            )}
          </section>
        </div>
      </main>
    `,
      undefined,
      true,
    )

    setupSearchAndScroll()
    return
  }

  const current: DownloadCurrent = {
    title: liveCurrent.title,
    subtitle: liveCurrent.subtitle,
    date: liveCurrent.date,
    size: liveCurrent.size,
    visits: liveCurrent.visits,
    downloads: liveCurrent.downloads,
    price: liveResult.price,
    featured: liveCurrent.featured,
    backLabel: activeSolutionCategory?.title ?? 'Solution Files',
    backHref: `/solution-files.html?brand=${activeSolutionCategory?.brandId ?? 'huawei'}&category=${activeSolutionCategory?.id ?? 'fix-reboot'}`,
  }

  document.title = `${current.title} | Huawei Downloads`
  const downloadHref = buildGoogleDriveDownloadUrl(liveResult.driveUrl || '')
  const downloadLabel = current.price && current.price.toLowerCase() !== 'free' ? `Download (${current.price})` : 'Download'

  const breadcrumbs = [
    { label: 'Downloads', href: '/downloads.html' },
    { label: 'HUAWEI - HONOR', href: '/downloads.html' },
    { label: 'Solution Files', href: '/downloads.html' },
    { label: current.backLabel, href: current.backHref },
  ]

  app.innerHTML = renderSiteChrome(
    `
    <main class="download-flow-page">
      <div class="container py-4">
        ${renderDownloadBreadcrumbs(breadcrumbs)}
        <section class="download-stage-card">
          ${renderDownloadHeaderBar(current.backLabel, current.backHref)}
          <div class="download-detail-panel">
            <h1>${current.title}</h1>
              <div class="file-badge-row justify-content-center">
                ${current.featured ? '<span class="file-badge file-badge-featured">Featured</span>' : ''}
                ${
                  current.price
                    ? current.price.toLowerCase() === 'free'
                      ? '<span class="file-badge file-badge-free">Available</span>'
                      : `<span class="file-badge file-badge-premium">Access</span><span class="file-badge file-badge-price">${current.price}</span>`
                    : ''
                }
                <span class="download-stars">${renderStars()}</span>
              </div>
            <p class="download-detail-subtitle">${current.subtitle}</p>
            <div class="download-detail-table">
              ${current.date ? `<div><strong>Date</strong><span>${current.date}</span></div>` : ''}
              <div><strong>Filesize</strong><span>${current.size}</span></div>
              <div><strong>Visits</strong><span>${current.visits}</span></div>
              <div><strong>Downloads</strong><span id="downloadCountValue">${current.downloads}</span></div>
                ${current.price ? `<div><strong>Access</strong><span>${current.price.toLowerCase() === 'free' ? 'Available' : current.price}</span></div>` : ''}
              </div>
            <div class="download-cta-strip">
              <span class="download-cta-pill"><i class="fas fa-circle-check"></i>Verified package</span>
              <span class="download-cta-pill"><i class="fas fa-gauge-high"></i>Download counter enabled</span>
              <span class="download-cta-pill"><i class="fas fa-headset"></i>Support available</span>
            </div>
            <a class="download-big-button" id="downloadActionButton" data-file-id="${id}" href="${downloadHref || '#'}" ${downloadHref ? 'target="_blank" rel="noreferrer"' : ''}><i class="fas fa-download me-2"></i>${downloadLabel}</a>
            <p class="download-cta-note">Direct access opens the linked file instantly. For paid access or manual assistance, use the support options below.</p>
            ${renderContactAdminPanel()}
          </div>
        </section>
      </div>
    </main>
  `,
    undefined,
    true,
  )

  const downloadButton = document.querySelector<HTMLAnchorElement>('#downloadActionButton')
  const downloadCountValue = document.querySelector<HTMLSpanElement>('#downloadCountValue')

  downloadButton?.addEventListener('click', () => {
    const targetFileId = downloadButton.dataset.fileId
    if (!targetFileId) return

    void incrementDownloadCount(targetFileId).then((nextValue) => {
      if (nextValue && downloadCountValue) {
        downloadCountValue.textContent = nextValue
      }
    })
  })

  setupSearchAndScroll()
}
