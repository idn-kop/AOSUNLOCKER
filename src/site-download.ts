import {
  anaAn00Files,
  downloadHomeCategories,
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
  renderDownloadLoadingState,
  renderDownloadListRow,
  renderFirmware,
  renderFooterPayments,
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
  syncLiveCacheVersion,
  warmBrandCategoryData,
} from './live-data'
import type { BrandId, DownloadListFile, SolutionCategory } from './data-types'

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
    description: `Open ${label} firmware and support files.`,
  }
}

const getBrandHubSignature = (
  items: Array<{ brandId?: string; title?: string; description?: string; href?: string; kind?: string }>,
) =>
  JSON.stringify(items.map((item) => [item.brandId || '', item.kind || '', item.title || '', item.description || '', item.href || '']))

const getCategoryListSignature = (items: SolutionCategory[]) =>
  JSON.stringify(
    items.map((item) => [
      item.brandId,
      item.id,
      item.title,
      item.fullTitle || '',
      item.parentCategoryId || '',
      item.depth ?? 0,
      item.hasChildren ? '1' : '0',
      item.description,
    ]),
  )

const getCategoryViewSignature = (
  category: SolutionCategory | null | undefined,
  childCategories: SolutionCategory[],
  files: DownloadListFile[],
) =>
  JSON.stringify({
    category: category
      ? [
          category.brandId,
          category.id,
          category.title,
          category.fullTitle || '',
          category.parentCategoryId || '',
          category.hasChildren ? '1' : '0',
          category.description,
        ]
      : null,
    childCategories: childCategories.map((item) => [
      item.brandId,
      item.id,
      item.title,
      item.fullTitle || '',
      item.parentCategoryId || '',
      item.hasChildren ? '1' : '0',
      item.description,
    ]),
    files: files.map((file) => [
      file.id,
      file.brandId || '',
      file.title,
      file.subtitle,
      file.summary,
      file.date,
      file.size,
      file.visits,
      file.downloads,
      file.price || '',
      file.featured ? '1' : '0',
    ]),
  })

const sortSolutionCategories = (items: SolutionCategory[]) =>
  [...items].sort((left, right) =>
    String(left.fullTitle || left.title || left.id).localeCompare(String(right.fullTitle || right.title || right.id)),
  )

const findCategoryById = (items: SolutionCategory[], categoryId: string) =>
  items.find((item) => String(item.id || '').trim() === String(categoryId || '').trim()) || null

const getTopLevelCategories = (items: SolutionCategory[], brandId: BrandId) =>
  sortSolutionCategories(
    items.filter(
      (item) =>
        String(item.brandId || '').trim() === String(brandId || '').trim() &&
        !String(item.parentCategoryId || '').trim(),
    ),
  )

const getChildCategories = (items: SolutionCategory[], parentCategoryId: string) =>
  sortSolutionCategories(
    items.filter((item) => String(item.parentCategoryId || '').trim() === String(parentCategoryId || '').trim()),
  )

const getCategoryTrail = (items: SolutionCategory[], categoryId: string) => {
  const categoryMap = new Map(items.map((item) => [String(item.id || '').trim(), item]))
  const trail: SolutionCategory[] = []
  const seen = new Set<string>()
  let currentId = String(categoryId || '').trim()

  while (currentId && categoryMap.has(currentId) && !seen.has(currentId)) {
    seen.add(currentId)
    const current = categoryMap.get(currentId)!
    trail.unshift(current)
    currentId = String(current.parentCategoryId || '').trim()
  }

  return trail
}

const buildCategoryHref = (brandId: BrandId, categoryId: string) =>
  `/solution-files.html?brand=${encodeURIComponent(brandId)}&category=${encodeURIComponent(categoryId)}`

const getCategoryCardDescription = (item: SolutionCategory) => {
  if (item.hasChildren) {
    return `Open ${item.fullTitle || item.title} folders and download files.`
  }

  if (item.parentCategoryLabel) {
    return `Download firmware and files for ${item.fullTitle || item.title}.`
  }

  return item.description
}

const renderCategoryFolderGrid = (brandId: BrandId, categories: SolutionCategory[]) =>
  categories.length
    ? `<div class="download-home-grid">${categories
        .map((item) =>
          renderDownloadHomeCard({
            title: item.title,
            description: getCategoryCardDescription(item),
            href: buildCategoryHref(brandId, item.id),
            kind: 'folder',
          }),
        )
        .join('')}</div>`
    : ''

const getBrandLandingCategories = (items: SolutionCategory[], brandId: BrandId) => {
  const brandCategories = sortSolutionCategories(
    items.filter((item) => String(item.brandId || '').trim() === String(brandId || '').trim()),
  )
  const topLevelCategories = getTopLevelCategories(items, brandId)
  return topLevelCategories.length ? topLevelCategories : brandCategories
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

const renderBrandHubGrid = (content = downloadHomeCategories) =>
  content.length
    ? `<div class="download-home-grid">${content.map((item: (typeof downloadHomeCategories)[number]) => renderDownloadHomeCard(item)).join('')}</div>`
    : renderDownloadEmptyState(
        'No brand folders available yet',
        'Published brand folders will appear here automatically as soon as they are available.',
      )

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

const warmCategoryFileCache = (brandId: BrandId, categoryIds: string[]) => {
  const uniqueIds = Array.from(
    new Set(
      categoryIds
        .map((categoryId) => String(categoryId || '').trim())
        .filter(Boolean),
    ),
  ).slice(0, 8)

  uniqueIds.forEach((categoryId, index) => {
    window.setTimeout(() => {
      void loadFilesByCategory(categoryId, brandId)
    }, 80 + index * 120)
  })
}

const renderSolutionCategoryStage = (
  breadcrumbs: Array<{ label: string; href?: string }>,
  backLabel: string,
  backHref: string,
  body: string,
) => `
  <main class="download-flow-page">
    <div class="container py-4">
      ${renderDownloadBreadcrumbs(breadcrumbs)}
      <section class="download-stage-card">
        ${renderDownloadHeaderBar(backLabel, backHref)}
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
            <div class="logo-note"><i class="fas fa-circle-check"></i>Download detail for Huawei and Honor service files</div>
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
              <a class="download-button" href="#">
                <i class="fas fa-download" aria-hidden="true"></i>
                <span class="download-button-label">Download File</span>
              </a>
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
          ${renderFooterPayments()}
        </div>
      </div>
    </footer>
  `
}

export const renderDownloadsHubPage = async () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const versionSyncPromise = syncLiveCacheVersion()

  document.title = 'Downloads | AOSUNLOCKER Huawei Lab'

  const cachedBrandResult = peekBrandFolders()
  const cachedBrandCards = cachedBrandResult?.brands ?? []
  const cachedBrandSignature = getBrandHubSignature(cachedBrandCards)
  warmBrandCategoryData(cachedBrandCards.map((item) => item.brandId))

  if (cachedBrandResult) {
    app.innerHTML = renderSiteChrome(
      renderDownloadsHubStage(renderBrandHubGrid(cachedBrandCards)),
      undefined,
      true,
    )
  } else {
    app.innerHTML = renderSiteChrome(
      renderDownloadsHubStage(renderBrandHubGrid()),
      undefined,
      true,
    )
  }

  setupSearchAndScroll()

  await versionSyncPromise
  const brandResult = await loadBrandFolders()
  const brandCards = brandResult.brands
  const liveBrandSignature = getBrandHubSignature(brandCards)
  warmBrandCategoryData(brandCards.map((item) => item.brandId))

  if (liveBrandSignature !== cachedBrandSignature) {
    app.innerHTML = renderSiteChrome(
      renderDownloadsHubStage(renderBrandHubGrid(brandCards)),
      undefined,
      true,
    )
    setupSearchAndScroll()
  }
}

export const renderSolutionFilesPage = async () => {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const versionSyncPromise = syncLiveCacheVersion()

  const params = new URLSearchParams(window.location.search)
  const brandId = (params.get('brand') || 'huawei') as BrandId
  const categoryId = params.get('category')
  const initialSortField = normalizeSortField(params.get('sort'))
  const initialSortOrder = normalizeSortOrder(params.get('order'))
  const initialView = normalizeViewMode(params.get('view'))
  const brand = getBrandMeta(brandId)
  const cachedCategoryResult = peekCategoriesByBrand(brandId)
  const cachedCategories = cachedCategoryResult?.categories ?? []
  const cachedFileResult = categoryId ? peekFilesByCategory(categoryId, brandId) : null
  const cachedActiveCategory = categoryId
    ? findCategoryById(cachedCategories, categoryId) ?? cachedFileResult?.category ?? null
    : null
  const cachedChildCategories = cachedActiveCategory ? getChildCategories(cachedCategories, cachedActiveCategory.id) : []
  const cachedCategorySignature = getCategoryListSignature(cachedCategories)
  const cachedViewSignature = getCategoryViewSignature(
    cachedActiveCategory,
    cachedChildCategories,
    cachedFileResult?.files ?? [],
  )
  let lastCategorySignature = cachedCategorySignature
  let lastViewSignature = cachedViewSignature
  let brandScreenPending = !categoryId && !cachedCategories.length
  let categoryScreenPending = Boolean(categoryId) && !(cachedActiveCategory || cachedFileResult)

  document.title = `${brand.label} Solution Files | Huawei - Honor Downloads`

  const renderBrandScreen = (categories: SolutionCategory[]) => {
    const visibleCategories = getBrandLandingCategories(categories, brandId)
    lastCategorySignature = getCategoryListSignature(categories)
    brandScreenPending = false
    warmCategoryFileCache(
      brandId,
      visibleCategories.map((item) => item.id),
    )

    app.innerHTML = renderSiteChrome(
      renderSolutionBrandStage(
        brand.label,
        brand.description,
        visibleCategories.length
          ? renderCategoryFolderGrid(brandId, visibleCategories)
          : renderDownloadEmptyState(
              `No ${brand.label} folders yet`,
              `There are no ${brand.label} solution folders connected yet.`,
            ),
      ),
      undefined,
      true,
    )

    setupSearchAndScroll()
  }

  const state = {
    sortField: initialSortField,
    sortOrder: initialSortOrder,
    view: initialView,
  }

  const syncUrl = () => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set('brand', brandId)
    if (categoryId) {
      nextParams.set('category', categoryId)
      nextParams.set('sort', state.sortField)
      nextParams.set('order', state.sortOrder)
      nextParams.set('view', state.view)
    }
    const nextUrl = `${window.location.pathname}?${nextParams.toString()}`
    window.history.replaceState({}, '', nextUrl)
  }

  const renderCategoryScreen = (
    allCategories: SolutionCategory[],
    activeCategory: SolutionCategory | null,
    activeFiles: DownloadListFile[],
  ) => {
    categoryScreenPending = false
    if (!activeCategory) {
      lastViewSignature = getCategoryViewSignature(null, [], [])
      app.innerHTML = renderSiteChrome(
        renderSolutionCategoryStage(
          [
            { label: 'Home', href: '/index.html' },
            { label: 'Downloads', href: '/downloads.html' },
            { label: brand.label, href: `/solution-files.html?brand=${brandId}` },
            { label: 'Folder' },
          ],
          brand.label,
          `/solution-files.html?brand=${encodeURIComponent(brandId)}`,
          renderDownloadEmptyState(
            'Folder not found',
            `The selected ${brand.label} folder is not available right now.`,
          ),
        ),
        undefined,
        true,
      )
      setupSearchAndScroll()
      return
    }

    const childCategories = getChildCategories(allCategories, activeCategory.id)
    lastViewSignature = getCategoryViewSignature(activeCategory, childCategories, activeFiles)
    const trail = getCategoryTrail(allCategories, activeCategory.id)
    const breadcrumbTrail = [
      { label: 'Home', href: '/index.html' },
      { label: 'Downloads', href: '/downloads.html' },
      { label: brand.label, href: `/solution-files.html?brand=${encodeURIComponent(brandId)}` },
      ...trail.map((item, index) =>
        index === trail.length - 1
          ? { label: item.title }
          : { label: item.title, href: buildCategoryHref(brandId, item.id) },
      ),
    ]
    const parentCategory = trail.length > 1 ? trail[trail.length - 2] : null
    const backLabel = parentCategory ? parentCategory.title : brand.label
    const backHref = parentCategory
      ? buildCategoryHref(brandId, parentCategory.id)
      : `/solution-files.html?brand=${encodeURIComponent(brandId)}`

    if (childCategories.length) {
      warmCategoryFileCache(
        brandId,
        childCategories.map((item) => item.id),
      )
    }

    document.title = `${brand.label} ${activeCategory.fullTitle || activeCategory.title} | Downloads`

    app.innerHTML = renderSiteChrome(
      renderSolutionCategoryStage(
        breadcrumbTrail,
        backLabel,
        backHref,
        `
          <div class="download-stage-head">
            <h1>${activeCategory.fullTitle || activeCategory.title}</h1>
            ${
              activeCategory.description
                ? `<p>${activeCategory.description}</p>`
                : ''
            }
          </div>
          ${
            childCategories.length
              ? `
                <div class="download-stage-section">
                  <div class="download-stage-subhead">
                    <h2>Download Firmware</h2>
                  </div>
                  ${renderCategoryFolderGrid(brandId, childCategories)}
                </div>
              `
              : ''
          }
          ${
            activeFiles.length
              ? `
                <div class="download-stage-section">
                  ${
                    childCategories.length
                      ? `
                        <div class="download-stage-subhead">
                          <h2>Files</h2>
                        </div>
                      `
                      : ''
                  }
                  <div id="solutionToolbar"></div>
                  <div id="solutionResults"></div>
                </div>
              `
              : !childCategories.length
                ? renderDownloadEmptyState(
                    `No ${activeCategory.title} files yet`,
                    'No published files are available in this folder yet.',
                  )
                : ''
          }
        `,
      ),
      undefined,
      true,
    )

    const toolbarMount = document.querySelector<HTMLDivElement>('#solutionToolbar')
    const resultsMount = document.querySelector<HTMLDivElement>('#solutionResults')

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
      if (!toolbarMount || !resultsMount) {
        syncUrl()
        return
      }

      const sortedFiles = sortDownloadFiles(activeFiles, state.sortField, state.sortOrder)
      toolbarMount.innerHTML = renderDownloadToolbar(state.sortField, state.sortOrder, state.view)
      resultsMount.innerHTML = renderSolutionFileResults(sortedFiles, state.view, activeCategory.title)
      bindToolbar()
      syncUrl()
    }

    renderInteractiveSection()
    setupSearchAndScroll()
  }

  let routeRefreshTimer: number | null = null
  let routeRefreshInFlight = false

  const refreshRouteFromLive = async () => {
    if (routeRefreshInFlight) return
    routeRefreshInFlight = true

    try {
      const changed = await syncLiveCacheVersion()
      if (!changed) return

      if (!categoryId) {
        const categoryResult = await loadCategoriesByBrand(brandId)
        const nextSignature = getCategoryListSignature(categoryResult.categories)
        if (brandScreenPending || nextSignature !== lastCategorySignature) {
          renderBrandScreen(categoryResult.categories)
        }
        return
      }

      const [categoryResult, fileResult] = await Promise.all([
        loadCategoriesByBrand(brandId),
        loadFilesByCategory(categoryId, brandId),
      ])
      const nextActiveCategory = findCategoryById(categoryResult.categories, categoryId) ?? fileResult.category
      const nextChildCategories = nextActiveCategory ? getChildCategories(categoryResult.categories, nextActiveCategory.id) : []
      const nextSignature = getCategoryViewSignature(nextActiveCategory, nextChildCategories, fileResult.files)

      if (categoryScreenPending || nextSignature !== lastViewSignature) {
        renderCategoryScreen(categoryResult.categories, nextActiveCategory, fileResult.files)
      }
    } finally {
      routeRefreshInFlight = false
    }
  }

  const scheduleRouteRefresh = (delay = 90) => {
    if (typeof window === 'undefined') return

    if (routeRefreshTimer !== null) {
      window.clearTimeout(routeRefreshTimer)
    }

    routeRefreshTimer = window.setTimeout(() => {
      routeRefreshTimer = null
      void refreshRouteFromLive()
    }, delay)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      scheduleRouteRefresh(40)
    })

    window.addEventListener('pageshow', () => {
      scheduleRouteRefresh(20)
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        scheduleRouteRefresh(40)
      }
    })
  }

  if (!categoryId) {
    if (cachedCategories.length) {
      renderBrandScreen(cachedCategories)
    } else {
      app.innerHTML = renderSiteChrome(
        renderSolutionBrandStage(
          brand.label,
          brand.description,
          renderDownloadLoadingState(
            `Loading ${brand.label} folders`,
            `Preparing ${brand.label} solution folders and categories.`,
          ),
        ),
        undefined,
        true,
      )
      setupSearchAndScroll()
    }
  } else if (cachedActiveCategory || cachedFileResult) {
    renderCategoryScreen(cachedCategories, cachedActiveCategory ?? cachedFileResult?.category ?? null, cachedFileResult?.files ?? [])
  } else {
    app.innerHTML = renderSiteChrome(
      renderSolutionCategoryStage(
        [
          { label: 'Home', href: '/index.html' },
          { label: 'Downloads', href: '/downloads.html' },
          { label: brand.label, href: `/solution-files.html?brand=${encodeURIComponent(brandId)}` },
          { label: 'Loading...' },
        ],
        brand.label,
        `/solution-files.html?brand=${encodeURIComponent(brandId)}`,
        `
          <div class="download-stage-head">
            <h1>Loading folder</h1>
            <p>Preparing folders and files for ${brand.label}.</p>
          </div>
          ${renderDownloadLoadingState(
            'Loading folder',
            `Preparing folders and files for ${brand.label}.`,
          )}
        `,
      ),
      undefined,
      true,
    )
    setupSearchAndScroll()
  }

  await versionSyncPromise

  if (!categoryId) {
    const categoryResult = await loadCategoriesByBrand(brandId)
    const categories = categoryResult.categories
    const liveCategorySignature = getCategoryListSignature(categories)

    if (brandScreenPending || liveCategorySignature !== lastCategorySignature) {
      renderBrandScreen(categories)
    }
    return
  }

  const [categoryResult, fileResult] = await Promise.all([
    loadCategoriesByBrand(brandId),
    loadFilesByCategory(categoryId, brandId),
  ])
  const liveCategories = categoryResult.categories
  const liveActiveCategory = findCategoryById(liveCategories, categoryId) ?? fileResult.category
  const liveChildCategories = liveActiveCategory ? getChildCategories(liveCategories, liveActiveCategory.id) : []
  const liveViewSignature = getCategoryViewSignature(liveActiveCategory, liveChildCategories, fileResult.files)

  if (categoryScreenPending || liveViewSignature !== lastViewSignature) {
    renderCategoryScreen(liveCategories, liveActiveCategory, fileResult.files)
  }
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

  const versionSyncPromise = syncLiveCacheVersion()

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

  await versionSyncPromise
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
    backLabel: activeSolutionCategory?.fullTitle ?? activeSolutionCategory?.title ?? 'Solution Files',
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
            <a class="download-big-button" id="downloadActionButton" data-file-id="${id}" href="${downloadHref || '#'}" ${downloadHref ? 'target="_blank" rel="noreferrer"' : ''}>
              <i class="fas fa-download" aria-hidden="true"></i>
              <span class="download-button-label">${downloadLabel}</span>
            </a>
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
