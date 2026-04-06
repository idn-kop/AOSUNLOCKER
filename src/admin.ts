import './admin.css'

declare global {
  interface Window {
    AOSUNLOCKER_CONFIG?: {
      apiBaseUrl?: string
      adminApiBaseUrl?: string
    }
  }
}

type AdminBrand = {
  id: string
  label: string
}

type AdminCategory = {
  id: string
  label: string
  brandId: string
  brandLabel: string
  parentCategoryId: string
  parentCategoryLabel?: string
  fullLabel?: string
  depth?: number
  hasChildren?: boolean
}

type AdminFile = {
  id: string
  brandId: string
  brandLabel: string
  categoryId: string
  categoryLabel: string
  title: string
  subtitle: string
  summary: string
  date: string
  size: string
  visits: string
  downloads: string
  price: string
  driveUrl: string
  featured: boolean
  status: 'published' | 'draft'
  createdAt: string
  updatedAt: string
}

type BootstrapResponse = {
  ok: boolean
  brands: AdminBrand[]
  categories: AdminCategory[]
  recentFiles: AdminFile[]
  totals?: {
    brands?: number
    categories?: number
    files?: number
  }
  cacheVersion?: string
  sheetName?: string
  lastPublicRefresh?: string
}

type FilesResponse = {
  ok: boolean
  files: AdminFile[]
}

type SearchResponse = {
  ok: boolean
  query: string
  total: number
  results: AdminFile[]
}

type IntegrityResponse = {
  ok: boolean
  checkedAt: string
  status: 'clean' | 'warning' | 'critical'
  summary: {
    brands: number
    categories: number
    files: number
    critical: number
    warning: number
    fixableCategoryRows: number
    totalIssues: number
  }
  issues: Array<{
    level: 'critical' | 'warning'
    title: string
    detail: string
  }>
}

type ComposerMode = 'brand' | 'category' | 'file'
type WorkspaceMode = 'dashboard' | 'catalog' | 'files' | 'tools'
type BannerTone = 'neutral' | 'success' | 'warning' | 'error'

const TOKEN_STORAGE_KEY = 'aosunlocker-admin-token'
const API_STORAGE_KEY = 'aosunlocker-admin-api-base'

const app = document.querySelector<HTMLDivElement>('#admin-app')

if (!app) {
  throw new Error('Admin root was not found.')
}

const state = {
  apiBaseUrl: '',
  token: '',
  bannerTone: 'neutral' as BannerTone,
  bannerMessage: 'Paste your admin token, then connect this panel to Cloudflare Pages Functions.',
  bootstrap: null as BootstrapResponse | null,
  fileIndex: [] as AdminFile[],
  files: [] as AdminFile[],
  filesLoading: false,
  searchResults: [] as AdminFile[],
  searchSummary: '',
  integrity: null as IntegrityResponse | null,
  editingBrandId: '',
  editingCategoryId: '',
  editingFileId: '',
  focusBrandId: '',
  focusCategoryId: '',
  activeComposer: 'category' as ComposerMode,
  activeWorkspace: 'catalog' as WorkspaceMode,
  fileAdvancedOpen: false,
  editorOpen: false,
}

let confirmResolver: ((value: boolean) => void) | null = null

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null

const escapeHtml = (value: string) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const toText = (value: unknown) => String(value || '').trim()

const normalizeApiBaseUrl = (value: string) => {
  const trimmed = toText(value)
  if (!trimmed) return ''
  return trimmed.replace(/\/+$/, '')
}

const getConfigAdminBaseUrl = () => {
  const config = window.AOSUNLOCKER_CONFIG || {}
  const explicitAdmin = normalizeApiBaseUrl(config.adminApiBaseUrl || '')
  if (explicitAdmin) return explicitAdmin

  const publicApi = normalizeApiBaseUrl(config.apiBaseUrl || '')
  if (publicApi) return `${publicApi}/admin`

  return '/api/admin'
}

const getCurrentAdminBaseUrl = () => normalizeApiBaseUrl(state.apiBaseUrl || getConfigAdminBaseUrl())

const formatTimestamp = (value: string) => {
  const raw = toText(value)
  if (!raw) return '-'

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw

  return parsed.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const sortBrands = (brands: AdminBrand[]) =>
  [...brands].sort((left, right) => left.label.localeCompare(right.label))

const sortCategories = (categories: AdminCategory[]) =>
  [...categories].sort((left, right) =>
    String(left.fullLabel || left.label || left.id).localeCompare(String(right.fullLabel || right.label || right.id)),
  )

const getBootstrapBrands = () => sortBrands(state.bootstrap?.brands ?? [])
const getBootstrapCategories = () => sortCategories(state.bootstrap?.categories ?? [])

const getCategoryById = (categoryId: string) =>
  getBootstrapCategories().find((category) => category.id === toText(categoryId)) || null

const getBrandById = (brandId: string) =>
  getBootstrapBrands().find((brand) => brand.id === toText(brandId)) || null

const getCategoriesForBrand = (brandId: string) =>
  getBootstrapCategories().filter((category) => category.brandId === toText(brandId))

const getKnownFiles = () => {
  const registry = new Map<string, AdminFile>()

  ;[...(state.bootstrap?.recentFiles ?? []), ...state.fileIndex, ...state.files, ...state.searchResults].forEach((file) => {
    if (!file?.id) return
    registry.set(file.id, file)
  })

  return Array.from(registry.values())
}

const getRootCategoriesForBrand = (brandId: string) =>
  getCategoriesForBrand(brandId).filter((category) => !toText(category.parentCategoryId))

const getChildCategories = (parentCategoryId: string) =>
  getBootstrapCategories().filter((category) => category.parentCategoryId === toText(parentCategoryId))

const getDescendantCategoryIds = (categoryId: string): string[] => {
  const descendants = new Set<string>()
  const queue = [toText(categoryId)]

  while (queue.length) {
    const currentId = queue.shift()
    if (!currentId) continue

    getChildCategories(currentId).forEach((child) => {
      if (descendants.has(child.id)) return
      descendants.add(child.id)
      queue.push(child.id)
    })
  }

  return Array.from(descendants)
}

const countIndexedFilesForBrand = (brandId: string) =>
  state.fileIndex.filter((file) => file.brandId === toText(brandId)).length

const countIndexedFilesForCategory = (categoryId: string) => {
  const acceptedIds = new Set([toText(categoryId), ...getDescendantCategoryIds(categoryId)])
  return state.fileIndex.filter((file) => acceptedIds.has(file.categoryId)).length
}

const sortFilesByRecent = (files: AdminFile[]) =>
  [...files].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime()
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime()
    return rightTime - leftTime
  })

const getActiveBrand = () => {
  const brands = getBootstrapBrands()
  return getBrandById(state.focusBrandId) || brands[0] || null
}

const getInspectorFiles = () => {
  const registry = sortFilesByRecent(getKnownFiles())

  if (state.focusCategoryId) {
    const acceptedIds = new Set([state.focusCategoryId, ...getDescendantCategoryIds(state.focusCategoryId)])
    return registry.filter((file) => acceptedIds.has(file.categoryId))
  }

  const brand = getActiveBrand()
  if (!brand) return []

  return registry.filter((file) => file.brandId === brand.id)
}

const isUnfilteredFileView = () =>
  !getInputValue('filterBrand') && !getInputValue('filterCategory') && !getInputValue('filterStatus')

const setFocus = ({ brandId = '', categoryId = '' }: { brandId?: string; categoryId?: string }) => {
  if (categoryId) {
    const category = getCategoryById(categoryId)
    state.focusCategoryId = category?.id || ''
    state.focusBrandId = category?.brandId || ''
  } else {
    const brand = getBrandById(brandId)
    state.focusBrandId = brand?.id || ''
    state.focusCategoryId = ''
  }

  renderWorkspaceHeader()
  renderCatalogExplorer()
  renderCatalogInspector()
  renderDashboardBrands()
}

const syncViewModes = () => {
  document.querySelectorAll<HTMLElement>('[data-composer-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.composerPanel !== state.activeComposer
  })

  document.querySelectorAll<HTMLElement>('[data-workspace-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.workspacePanel !== state.activeWorkspace
  })

  document.querySelectorAll<HTMLButtonElement>('[data-composer-mode]').forEach((button) => {
    const isActive = button.dataset.composerMode === state.activeComposer
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })

  document.querySelectorAll<HTMLButtonElement>('[data-workspace-mode]').forEach((button) => {
    const isActive = button.dataset.workspaceMode === state.activeWorkspace
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })

  const details = byId<HTMLDetailsElement>('fileAdvancedDetails')
  if (details) {
    details.open = state.fileAdvancedOpen
  }

  const overlay = byId<HTMLDivElement>('adminEditorOverlay')
  if (overlay) {
    overlay.hidden = !state.editorOpen
    overlay.classList.toggle('is-open', state.editorOpen)
  }

  document.body.classList.toggle('admin-lock-scroll', state.editorOpen)

  renderWorkspaceHeader()
}

const revealComposer = (
  mode: ComposerMode,
  options: {
    scroll?: boolean
    fileAdvancedOpen?: boolean
  } = {},
) => {
  state.activeComposer = mode
  state.editorOpen = true
  if (typeof options.fileAdvancedOpen === 'boolean') {
    state.fileAdvancedOpen = options.fileAdvancedOpen
  }
  syncViewModes()

  if (options.scroll && window.innerWidth < 1080) {
    byId<HTMLElement>('adminComposerCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const closeComposer = () => {
  state.editorOpen = false
  syncViewModes()
}

const openConfirmDialog = (title: string, message: string, confirmLabel = 'Delete') =>
  new Promise<boolean>((resolve) => {
    confirmResolver = resolve

    const overlay = byId<HTMLDivElement>('adminConfirmOverlay')
    const titleMount = byId<HTMLHeadingElement>('confirmDialogTitle')
    const messageMount = byId<HTMLParagraphElement>('confirmDialogMessage')
    const acceptButton = byId<HTMLButtonElement>('confirmDialogAccept')

    if (!overlay || !titleMount || !messageMount || !acceptButton) {
      resolve(window.confirm(message))
      return
    }

    titleMount.textContent = title
    messageMount.textContent = message
    acceptButton.textContent = confirmLabel
    overlay.hidden = false
    document.body.classList.add('admin-lock-scroll')
  })

const closeConfirmDialog = (value: boolean) => {
  const overlay = byId<HTMLDivElement>('adminConfirmOverlay')
  if (overlay) {
    overlay.hidden = true
  }

  if (!state.editorOpen) {
    document.body.classList.remove('admin-lock-scroll')
  }

  const resolver = confirmResolver
  confirmResolver = null
  resolver?.(value)
}

const slugifyId = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const deriveFileLabelFromUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl)
    const queryHints = ['filename', 'file', 'name', 'title']

    for (const key of queryHints) {
      const candidate = toText(url.searchParams.get(key) || '')
      if (candidate) {
        return candidate.replace(/\.[a-z0-9]{1,8}$/i, '')
      }
    }

    const segments = url.pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .filter(Boolean)

    const lastSegment = segments[segments.length - 1] || ''
    if (lastSegment && !['view', 'download', 'file'].includes(lastSegment.toLowerCase())) {
      return lastSegment.replace(/\.[a-z0-9]{1,8}$/i, '')
    }
  } catch {
    return ''
  }

  return ''
}

const autofillFileFieldsFromLink = () => {
  const driveUrl = getInputValue('fileDriveUrl')
  if (!driveUrl) {
    setBanner('Paste link dulu, baru klik Autofill.', 'warning')
    return
  }

  const guessedRaw = deriveFileLabelFromUrl(driveUrl)
  const guessed = guessedRaw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!guessed) {
    setBanner('Nama file tidak bisa dibaca otomatis dari link ini. Isi title manual ya.', 'warning')
    return
  }

  if (!getInputValue('fileTitle')) {
    setInputValue('fileTitle', guessed)
  }

  if (!getInputValue('fileSubtitle')) {
    setInputValue('fileSubtitle', guessed)
  }

  if (!getInputValue('fileSummary')) {
    setInputValue('fileSummary', guessed)
  }

  if (!state.editingFileId && !getInputValue('fileId')) {
    const category = getCategoryById(getInputValue('fileCategory'))
    const prefix = category?.id || getInputValue('fileBrand') || 'file'
    setInputValue('fileId', `${prefix}-${slugifyId(guessed)}`)
  }

  state.fileAdvancedOpen = true
  syncViewModes()
  setBanner(`Autofill selesai untuk "${guessed}".`, 'success')
}

const revealWorkspace = (mode: WorkspaceMode, options: { scroll?: boolean } = {}) => {
  state.activeWorkspace = mode
  syncViewModes()

  if (options.scroll) {
    byId<HTMLElement>('adminMainHeader')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const setBanner = (message: string, tone: BannerTone = 'neutral') => {
  state.bannerMessage = message
  state.bannerTone = tone
  renderBanner()
}

const requireToken = () => {
  const token = toText(state.token)
  if (!token) {
    throw new Error('Admin token is still empty.')
  }
  return token
}

const buildAdminUrl = (path = '', params?: URLSearchParams) => {
  const base = getCurrentAdminBaseUrl()
  const url = new URL(path ? `${base}/${path}` : base, window.location.origin)

  if (params) {
    params.forEach((value, key) => {
      if (value) {
        url.searchParams.set(key, value)
      }
    })
  }

  return url
}

const requestAdmin = async <T>(path = '', init: RequestInit = {}, params?: URLSearchParams): Promise<T> => {
  const token = requireToken()
  const url = buildAdminUrl(path, params)
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)

  const body = init.body
  if (body && !(body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8')
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers,
  })

  const payload = (await response.json().catch(() => null)) as { message?: string } | null
  if (!response.ok) {
    throw new Error(toText(payload?.message) || `Request failed with status ${response.status}.`)
  }

  return payload as T
}

const setButtonBusy = (button: HTMLButtonElement | null, busyLabel: string) => {
  if (!button) {
    return () => undefined
  }

  const previousLabel = button.textContent || ''
  button.disabled = true
  button.textContent = busyLabel

  return () => {
    button.disabled = false
    button.textContent = previousLabel
  }
}

const setInputValue = (id: string, value: string) => {
  const input = byId<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id)
  if (input) {
    input.value = value
  }
}

const getInputValue = (id: string) => toText(byId<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id)?.value || '')

const setSelectOptions = (
  select: HTMLSelectElement | null,
  options: Array<{ value: string; label: string }>,
  nextValue = '',
) => {
  if (!select) return

  select.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join('')

  const hasExactValue = options.some((option) => option.value === nextValue)
  select.value = hasExactValue ? nextValue : options[0]?.value || ''
}

const renderSidebarMarkup = () => `
  <aside class="admin-sidebar admin-card">
    <div class="admin-sidebar-brand">
      <p class="admin-eyebrow">AOSUNLOCKER</p>
      <h1 class="admin-sidebar-title">Admin Panel</h1>
      <p class="admin-copy">Kelola brand, folder, subfolder, file, link, dan price dari panel yang lebih ringkas dan lebih enak dipakai dari HP.</p>
    </div>

    <nav class="admin-sidebar-nav" aria-label="Admin sections">
      <button class="admin-nav-button" type="button" data-workspace-mode="catalog">Catalog</button>
      <button class="admin-nav-button" type="button" data-workspace-mode="files">Files</button>
      <button class="admin-nav-button" type="button" data-workspace-mode="tools">Tools</button>
    </nav>

    <section class="admin-sidebar-section">
      <div class="admin-card-head">
        <div>
          <p class="admin-eyebrow">Tambah Cepat</p>
          <h2 class="admin-section-title admin-section-title-sm">Aksi Ringkas</h2>
        </div>
      </div>
      <div class="admin-sidebar-actions">
        <button class="admin-button admin-button-primary" type="button" data-composer-mode="category" data-composer-reset="true" data-open-workspace="catalog">Tambah Folder</button>
        <button class="admin-button admin-button-secondary" type="button" data-composer-mode="file" data-composer-reset="true" data-open-workspace="catalog">Tambah File</button>
      </div>
    </section>

    <section class="admin-sidebar-section">
      <div id="adminBanner" class="admin-status" data-tone="neutral"></div>
      <p class="admin-footer-note">Current target: <span class="admin-kbd" id="currentApiTarget">/api/admin</span></p>
    </section>

    <details class="admin-disclosure admin-side-toggle"${state.token ? '' : ' open'}>
      <summary class="admin-disclosure-summary">Connection & token</summary>
      <div class="admin-disclosure-content">
        <form id="connectionForm" class="admin-form-grid" data-columns="1">
          <label class="admin-field">
            <span class="admin-label">Admin API base</span>
            <input id="adminApiBase" class="admin-input" type="text" placeholder="/api/admin" />
          </label>
          <label class="admin-field">
            <span class="admin-label">Admin token</span>
            <input id="adminToken" class="admin-input" type="password" placeholder="Paste ADMIN_TOKEN" />
          </label>
          <div class="admin-action-row">
            <button id="saveConnectionButton" class="admin-button admin-button-primary" type="submit">Connect</button>
            <button id="refreshBootstrapButton" class="admin-button admin-button-secondary" type="button">Reload</button>
            <button id="clearTokenButton" class="admin-button admin-button-ghost" type="button">Clear</button>
          </div>
        </form>
      </div>
    </details>
  </aside>
`

const renderEditorMarkup = () => `
  <div id="adminEditorOverlay" class="admin-editor-overlay" hidden>
    <button class="admin-editor-backdrop" type="button" data-close-editor="true" aria-label="Close editor"></button>
    <article id="adminComposerCard" class="admin-card admin-panel-card admin-editor-card" role="dialog" aria-modal="true">
      <div class="admin-card-head">
        <div>
          <p class="admin-eyebrow">Quick Editor</p>
          <h2 class="admin-section-title admin-section-title-sm">Tambah atau edit tanpa bikin layar penuh</h2>
          <p class="admin-section-copy">Editor hanya muncul saat Anda butuh. Pilih aksi dari browser utama, lalu simpan dan kembali ke daftar.</p>
        </div>
        <div class="admin-overlay-actions">
          <div class="admin-tab-row">
            <button class="admin-tab-button" type="button" data-composer-mode="brand">Brand</button>
            <button class="admin-tab-button" type="button" data-composer-mode="category">Folder</button>
            <button class="admin-tab-button" type="button" data-composer-mode="file">File</button>
          </div>
          <button id="closeComposerButton" class="admin-button admin-button-ghost" type="button">Close</button>
        </div>
      </div>

      <section class="admin-composer-panel" data-composer-panel="brand">
        <p class="admin-eyebrow">Brand</p>
        <h2 class="admin-section-title" id="brandFormTitle">Create Brand</h2>
        <p class="admin-section-copy">Gunakan untuk brand utama seperti Huawei, Honor, atau Solution.</p>
        <form id="brandForm" class="admin-form-grid" data-columns="1">
          <label class="admin-field">
            <span class="admin-label">Brand ID</span>
            <input id="brandId" class="admin-input" type="text" placeholder="huawei" />
          </label>
          <label class="admin-field">
            <span class="admin-label">Brand label</span>
            <input id="brandLabel" class="admin-input" type="text" placeholder="Huawei" />
          </label>
          <div class="admin-action-row">
            <button id="brandSubmitButton" class="admin-button admin-button-primary" type="submit">Save Brand</button>
            <button id="brandResetButton" class="admin-button admin-button-secondary" type="button">Reset</button>
          </div>
        </form>
      </section>

      <section class="admin-composer-panel" data-composer-panel="category" hidden>
        <p class="admin-eyebrow">Folder</p>
        <h2 class="admin-section-title" id="categoryFormTitle">Create Folder / Subfolder</h2>
        <p class="admin-section-copy">Pilih brand dulu, lalu isi parent folder kalau item ini memang subfolder.</p>
        <form id="categoryForm" class="admin-form-grid">
          <label class="admin-field">
            <span class="admin-label">Folder ID</span>
            <input id="categoryId" class="admin-input" type="text" placeholder="auto-generated if blank" />
          </label>
          <label class="admin-field">
            <span class="admin-label">Folder label</span>
            <input id="categoryLabel" class="admin-input" type="text" placeholder="Removed ID" />
          </label>
          <label class="admin-field">
            <span class="admin-label">Brand</span>
            <select id="categoryBrand" class="admin-select"></select>
          </label>
          <label class="admin-field">
            <span class="admin-label">Parent folder</span>
            <select id="parentCategory" class="admin-select"></select>
          </label>
          <div class="admin-action-row admin-span-2">
            <button id="categorySubmitButton" class="admin-button admin-button-primary" type="submit">Save Folder</button>
            <button id="categoryResetButton" class="admin-button admin-button-secondary" type="button">Reset</button>
          </div>
        </form>
      </section>

      <section class="admin-composer-panel" data-composer-panel="file" hidden>
        <p class="admin-eyebrow">File</p>
        <h2 class="admin-section-title" id="fileFormTitle">Create File</h2>
        <p class="admin-section-copy">Field penting dibuat singkat supaya tambah file dari HP lebih cepat. Detail lain tetap ada di bagian advanced.</p>
        <form id="fileForm" class="admin-form-grid">
          <label class="admin-field admin-span-2">
            <span class="admin-label">Title</span>
            <input id="fileTitle" class="admin-input" type="text" placeholder="Huawei Mate50..." />
          </label>
          <label class="admin-field admin-span-2">
            <span class="admin-label">Drive URL</span>
            <input id="fileDriveUrl" class="admin-input" type="url" placeholder="https://drive.google.com/file/d/..." />
          </label>
          <div class="admin-action-row admin-span-2 admin-inline-helper-row">
            <button id="fileAutofillButton" class="admin-button admin-button-secondary" type="button">Autofill dari Link</button>
            <span class="admin-subtle">Tempel link dulu, lalu klik tombol ini untuk bantu isi title dan ID kalau URL mendukung.</span>
          </div>
          <label class="admin-field">
            <span class="admin-label">Brand</span>
            <select id="fileBrand" class="admin-select"></select>
          </label>
          <label class="admin-field">
            <span class="admin-label">Folder</span>
            <select id="fileCategory" class="admin-select"></select>
          </label>
          <label class="admin-field">
            <span class="admin-label">Status</span>
            <select id="fileStatus" class="admin-select">
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </label>
          <details id="fileAdvancedDetails" class="admin-disclosure admin-span-2">
            <summary class="admin-disclosure-summary">Advanced file details</summary>
            <div class="admin-disclosure-content admin-form-grid">
              <label class="admin-field admin-span-2">
                <span class="admin-label">File ID</span>
                <input id="fileId" class="admin-input" type="text" placeholder="auto-generated if blank" />
              </label>
              <label class="admin-field admin-span-2">
                <span class="admin-label">Subtitle</span>
                <input id="fileSubtitle" class="admin-input" type="text" placeholder="Short subtitle for the download list" />
              </label>
              <label class="admin-field admin-span-2">
                <span class="admin-label">Summary</span>
                <textarea id="fileSummary" class="admin-textarea" placeholder="Short summary, notes, or package context"></textarea>
              </label>
              <label class="admin-field">
                <span class="admin-label">Date label</span>
                <input id="fileDate" class="admin-input" type="text" placeholder="07-04-2026" />
              </label>
              <label class="admin-field">
                <span class="admin-label">Size label</span>
                <input id="fileSize" class="admin-input" type="text" placeholder="7.91 GB" />
              </label>
              <label class="admin-field">
                <span class="admin-label">Price</span>
                <input id="filePrice" class="admin-input" type="text" placeholder="free" />
              </label>
              <label class="admin-field">
                <span class="admin-label">Featured</span>
                <select id="fileFeaturedSelect" class="admin-select">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              <label class="admin-field">
                <span class="admin-label">Visits</span>
                <input id="fileVisits" class="admin-input" type="number" min="0" step="1" placeholder="0" />
              </label>
              <label class="admin-field">
                <span class="admin-label">Downloads</span>
                <input id="fileDownloads" class="admin-input" type="number" min="0" step="1" placeholder="0" />
              </label>
            </div>
          </details>
          <div class="admin-action-row admin-span-2">
            <button id="fileSubmitButton" class="admin-button admin-button-primary" type="submit">Save File</button>
            <button id="fileResetButton" class="admin-button admin-button-secondary" type="button">Reset</button>
          </div>
        </form>
      </section>
    </article>
  </div>
`

const renderConfirmDialogMarkup = () => `
  <div id="adminConfirmOverlay" class="admin-confirm-overlay" hidden>
    <button class="admin-editor-backdrop" type="button" data-close-confirm="true" aria-label="Close confirm"></button>
    <article class="admin-card admin-panel-card admin-confirm-card" role="dialog" aria-modal="true">
      <p class="admin-eyebrow">Confirm Action</p>
      <h2 id="confirmDialogTitle" class="admin-section-title admin-section-title-sm">Confirm delete</h2>
      <p id="confirmDialogMessage" class="admin-section-copy">Please confirm this action.</p>
      <div class="admin-action-row">
        <button id="confirmDialogAccept" class="admin-button admin-button-danger" type="button">Delete</button>
        <button id="confirmDialogCancel" class="admin-button admin-button-secondary" type="button">Cancel</button>
      </div>
    </article>
  </div>
`

const renderDashboardMarkup = () => `
  <section class="admin-workspace-panel" data-workspace-panel="dashboard">
    <div id="adminStats" class="admin-metric-grid"></div>
    <div class="admin-dashboard-grid">
      <article class="admin-card admin-panel-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-eyebrow">Brand Map</p>
            <h2 class="admin-section-title admin-section-title-sm">Which brand contains what</h2>
          </div>
          <button class="admin-button admin-button-secondary" type="button" data-workspace-mode="catalog">Open Catalog</button>
        </div>
        <div id="dashboardBrands" class="admin-brand-summary-grid"></div>
      </article>

      <article class="admin-card admin-panel-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-eyebrow">Recent Files</p>
            <h2 class="admin-section-title admin-section-title-sm">Latest items touched in D1</h2>
          </div>
          <button class="admin-button admin-button-secondary" type="button" data-workspace-mode="files">Open Files</button>
        </div>
        <div id="dashboardRecentFiles" class="admin-list"></div>
      </article>

      <article class="admin-card admin-panel-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-eyebrow">System</p>
            <h2 class="admin-section-title admin-section-title-sm">Cache and health</h2>
          </div>
          <button class="admin-button admin-button-secondary" type="button" data-workspace-mode="tools">Open Tools</button>
        </div>
        <div id="dashboardHealth" class="admin-health-grid"></div>
      </article>
    </div>
  </section>
`

const renderCatalogMarkup = () => `
  <section class="admin-workspace-panel" data-workspace-panel="catalog" hidden>
    <div class="admin-browser-grid">
      <article class="admin-card admin-panel-card admin-explorer-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-eyebrow">Catalog Manager</p>
            <h2 class="admin-section-title admin-section-title-sm">Brand dan folder browser</h2>
            <p class="admin-section-copy">Pilih brand di atas, lalu klik folder di kiri. Isi brand atau folder aktif langsung tampil di panel kanan.</p>
          </div>
        </div>
        <div id="catalogExplorer" class="admin-explorer-stack"></div>
      </article>

      <article class="admin-card admin-panel-card admin-inspector-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-eyebrow">Current View</p>
            <h2 id="catalogInspectorTitle" class="admin-section-title admin-section-title-sm">Pilih brand atau folder</h2>
            <p id="catalogInspectorCopy" class="admin-section-copy">Di sini nanti terlihat isi brand atau folder yang sedang aktif, jadi tidak campur lagi.</p>
          </div>
          <div id="catalogQuickActions" class="admin-action-row"></div>
        </div>
        <div id="catalogSelectionMeta" class="admin-pill-row"></div>
        <div class="admin-table-shell admin-table-shell-medium">
          <table class="admin-table admin-table-responsive">
            <thead>
              <tr>
                <th>File</th>
                <th>Price</th>
                <th>Status</th>
                <th>Link</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="catalogFileTableBody"></tbody>
          </table>
        </div>
      </article>
    </div>
  </section>
`

const renderFilesMarkup = () => `
  <section class="admin-workspace-panel" data-workspace-panel="files" hidden>
    <article class="admin-card admin-panel-card">
      <div class="admin-card-head">
        <div>
          <p class="admin-eyebrow">File Manager</p>
          <h2 class="admin-section-title admin-section-title-sm">All links, price, status, and traffic</h2>
          <p class="admin-section-copy">Gunakan filter brand dan folder agar daftar file tidak campur. Klik Edit untuk membuka editor file yang tepat.</p>
        </div>
        <div class="admin-action-row">
          <button id="reloadFilesButton" class="admin-button admin-button-secondary" type="button">Reload Files</button>
          <button class="admin-button admin-button-secondary" type="button" data-composer-mode="file" data-composer-reset="true" data-open-workspace="catalog">New File</button>
          <button class="admin-button admin-button-ghost" type="button" data-workspace-mode="catalog">Open Catalog</button>
        </div>
      </div>
      <div class="admin-filter-row">
        <label class="admin-field">
          <span class="admin-label">Filter brand</span>
          <select id="filterBrand" class="admin-select"></select>
        </label>
        <label class="admin-field">
          <span class="admin-label">Filter folder</span>
          <select id="filterCategory" class="admin-select"></select>
        </label>
        <label class="admin-field">
          <span class="admin-label">Filter status</span>
          <select id="filterStatus" class="admin-select">
            <option value="">All status</option>
            <option value="published">Published only</option>
            <option value="draft">Draft only</option>
          </select>
        </label>
      </div>
      <div class="admin-table-shell admin-table-shell-tall">
        <table class="admin-table admin-table-responsive">
          <thead>
            <tr>
              <th>File</th>
              <th>Folder</th>
              <th>Status</th>
              <th>Traffic</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="fileTableBody"></tbody>
        </table>
      </div>
    </article>
  </section>
`

const renderMobileQuickbarMarkup = () => `
  <nav class="admin-mobile-quickbar" aria-label="Mobile quick actions">
    <button class="admin-button admin-button-primary" type="button" data-composer-mode="file" data-composer-reset="true" data-open-workspace="catalog">Tambah File</button>
    <button class="admin-button admin-button-secondary" type="button" data-composer-mode="category" data-composer-reset="true" data-open-workspace="catalog">Tambah Folder</button>
    <button class="admin-button admin-button-secondary" type="button" data-workspace-mode="catalog">Lihat Catalog</button>
    <button class="admin-button admin-button-secondary" type="button" data-workspace-mode="files">Lihat Files</button>
  </nav>
`

const renderToolsMarkup = () => `
  <section class="admin-workspace-panel" data-workspace-panel="tools" hidden>
    <div class="admin-tools-grid">
      <article class="admin-card admin-panel-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-eyebrow">Search</p>
            <h2 class="admin-section-title admin-section-title-sm">Find files fast</h2>
            <p class="admin-section-copy">Cari judul file, folder, brand, atau link tanpa perlu scroll daftar panjang.</p>
          </div>
        </div>
        <form id="searchForm" class="admin-form-grid">
          <label class="admin-field admin-span-2">
            <span class="admin-label">Search query</span>
            <input id="searchQuery" class="admin-input" type="text" placeholder="file title, category, brand, link..." />
          </label>
          <div class="admin-action-row admin-span-2">
            <button id="searchSubmitButton" class="admin-button admin-button-primary" type="submit">Run Search</button>
            <button id="refreshCacheButton" class="admin-button admin-button-secondary" type="button">Refresh Public Cache</button>
            <button id="runIntegrityButton" class="admin-button admin-button-secondary" type="button">Run Integrity Scan</button>
          </div>
        </form>
        <div class="admin-card-head admin-card-head-tight">
          <div>
            <h3 class="admin-subpanel-title">Search results</h3>
            <p class="admin-muted" id="searchSummary">Search results will appear here.</p>
          </div>
        </div>
        <div id="searchResults" class="admin-search-list"></div>
      </article>

      <article class="admin-card admin-panel-card">
        <div class="admin-card-head">
          <div>
            <p class="admin-eyebrow">Integrity</p>
            <h2 class="admin-section-title admin-section-title-sm">Data health check</h2>
            <p class="admin-section-copy">Scan setelah edit supaya parent-child relation, file link, dan struktur folder tetap sehat.</p>
          </div>
        </div>
        <div id="integrityResults" class="admin-issue-list"></div>
      </article>
    </div>
  </section>
`
const renderShellLegacy = () => {
  app.innerHTML = `
    <main class="admin-shell">
      <section class="admin-hero">
        <article class="admin-card admin-hero-copy">
          <p class="admin-eyebrow">Cloudflare Admin</p>
          <h1 class="admin-title">Folder, subfolder, and link control without Google Sheet lag.</h1>
          <p class="admin-copy">This panel writes directly to Cloudflare D1 through Pages Functions. Folder structure, file links, and publish status stay in one place, and every write bumps the public cache version automatically.</p>
          <div class="admin-pill-row">
            <span class="admin-pill">Public website stays static-fast</span>
            <span class="admin-pill">Admin writes go to D1</span>
            <span class="admin-pill">No Apps Script dependency</span>
          </div>
          <div id="adminBanner" class="admin-status" data-tone="neutral"></div>
          <div id="adminStats" class="admin-stat-grid"></div>
        </article>

        <article class="admin-card admin-hero-side">
          <p class="admin-eyebrow">Connection</p>
          <h2 class="admin-section-title">Admin Gateway</h2>
          <p class="admin-section-copy">Use your Pages Functions admin token here. The token stays only in this browser.</p>
          <form id="connectionForm" class="admin-form-grid" data-columns="1">
            <label class="admin-field">
              <span class="admin-label">Admin API base</span>
              <input id="adminApiBase" class="admin-input" type="text" placeholder="/api/admin" />
            </label>
            <label class="admin-field">
              <span class="admin-label">Admin token</span>
              <input id="adminToken" class="admin-input" type="password" placeholder="Paste ADMIN_TOKEN" />
            </label>
            <div class="admin-action-row">
              <button id="saveConnectionButton" class="admin-button admin-button-primary" type="submit">Connect Panel</button>
              <button id="refreshBootstrapButton" class="admin-button admin-button-secondary" type="button">Reload Data</button>
              <button id="clearTokenButton" class="admin-button admin-button-ghost" type="button">Clear Token</button>
            </div>
          </form>
          <p class="admin-footer-note">Current target: <span class="admin-kbd" id="currentApiTarget">/api/admin</span></p>
        </article>
      </section>

      <section class="admin-workbench">
        <aside class="admin-composer-column">
          <article id="adminComposerCard" class="admin-card admin-form-card admin-composer-card">
            <div class="admin-card-topline">
              <div>
                <p class="admin-eyebrow">Quick Create</p>
                <h2 class="admin-section-title">Single-action editor</h2>
              </div>
              <div class="admin-tab-row">
                <button class="admin-tab-button" type="button" data-composer-mode="brand">Brand</button>
                <button class="admin-tab-button" type="button" data-composer-mode="category">Folder</button>
                <button class="admin-tab-button" type="button" data-composer-mode="file">File</button>
              </div>
            </div>
            <p class="admin-section-copy">Pick one task at a time. Edit actions from the lists on the right will load into this editor automatically.</p>

            <section class="admin-composer-panel" data-composer-panel="brand">
              <p class="admin-eyebrow">Brand</p>
              <h2 class="admin-section-title" id="brandFormTitle">Create Brand</h2>
              <p class="admin-section-copy">Use this only for a new root family such as Huawei, Honor, or Solution.</p>
              <form id="brandForm" class="admin-form-grid" data-columns="1">
                <label class="admin-field">
                  <span class="admin-label">Brand ID</span>
                  <input id="brandId" class="admin-input" type="text" placeholder="huawei" />
                </label>
                <label class="admin-field">
                  <span class="admin-label">Brand label</span>
                  <input id="brandLabel" class="admin-input" type="text" placeholder="Huawei" />
                </label>
                <div class="admin-action-row">
                  <button id="brandSubmitButton" class="admin-button admin-button-primary" type="submit">Save Brand</button>
                  <button id="brandResetButton" class="admin-button admin-button-secondary" type="button">Reset</button>
                </div>
              </form>
            </section>

            <section class="admin-composer-panel" data-composer-panel="category" hidden>
              <p class="admin-eyebrow">Folder</p>
              <h2 class="admin-section-title" id="categoryFormTitle">Create Folder / Subfolder</h2>
              <p class="admin-section-copy">Select a brand, then choose an optional parent folder only if this should become a subfolder.</p>
              <form id="categoryForm" class="admin-form-grid">
                <label class="admin-field">
                  <span class="admin-label">Folder ID</span>
                  <input id="categoryId" class="admin-input" type="text" placeholder="auto-generated if blank" />
                </label>
                <label class="admin-field">
                  <span class="admin-label">Folder label</span>
                  <input id="categoryLabel" class="admin-input" type="text" placeholder="Removed ID" />
                </label>
                <label class="admin-field">
                  <span class="admin-label">Brand</span>
                  <select id="categoryBrand" class="admin-select"></select>
                </label>
                <label class="admin-field">
                  <span class="admin-label">Parent folder</span>
                  <select id="parentCategory" class="admin-select"></select>
                </label>
                <div class="admin-action-row admin-span-2">
                  <button id="categorySubmitButton" class="admin-button admin-button-primary" type="submit">Save Folder</button>
                  <button id="categoryResetButton" class="admin-button admin-button-secondary" type="button">Reset</button>
                </div>
              </form>
            </section>

            <section class="admin-composer-panel" data-composer-panel="file" hidden>
              <p class="admin-eyebrow">File</p>
              <h2 class="admin-section-title" id="fileFormTitle">Create File</h2>
              <p class="admin-section-copy">Main fields stay visible. Open advanced details only when you need subtitles, notes, size, price, or counters.</p>
              <form id="fileForm" class="admin-form-grid">
                <label class="admin-field">
                  <span class="admin-label">File ID</span>
                  <input id="fileId" class="admin-input" type="text" placeholder="auto-generated if blank" />
                </label>
                <label class="admin-field">
                  <span class="admin-label">Title</span>
                  <input id="fileTitle" class="admin-input" type="text" placeholder="Huawei Mate50..." />
                </label>
                <label class="admin-field">
                  <span class="admin-label">Brand</span>
                  <select id="fileBrand" class="admin-select"></select>
                </label>
                <label class="admin-field">
                  <span class="admin-label">Folder</span>
                  <select id="fileCategory" class="admin-select"></select>
                </label>
                <label class="admin-field admin-span-2">
                  <span class="admin-label">Drive URL</span>
                  <input id="fileDriveUrl" class="admin-input" type="url" placeholder="https://drive.google.com/file/d/..." />
                </label>
                <label class="admin-field">
                  <span class="admin-label">Status</span>
                  <select id="fileStatus" class="admin-select">
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </label>
                <details id="fileAdvancedDetails" class="admin-disclosure admin-span-2">
                  <summary class="admin-disclosure-summary">Advanced file details</summary>
                  <div class="admin-disclosure-content admin-form-grid">
                    <label class="admin-field admin-span-2">
                      <span class="admin-label">Subtitle</span>
                      <input id="fileSubtitle" class="admin-input" type="text" placeholder="Short subtitle for the download list" />
                    </label>
                    <label class="admin-field admin-span-2">
                      <span class="admin-label">Summary</span>
                      <textarea id="fileSummary" class="admin-textarea" placeholder="Short summary, notes, or package context"></textarea>
                    </label>
                    <label class="admin-field">
                      <span class="admin-label">Date label</span>
                      <input id="fileDate" class="admin-input" type="text" placeholder="07-04-2026" />
                    </label>
                    <label class="admin-field">
                      <span class="admin-label">Size label</span>
                      <input id="fileSize" class="admin-input" type="text" placeholder="7.91 GB" />
                    </label>
                    <label class="admin-field">
                      <span class="admin-label">Price</span>
                      <input id="filePrice" class="admin-input" type="text" placeholder="free" />
                    </label>
                    <label class="admin-field">
                      <span class="admin-label">Featured</span>
                      <select id="fileFeaturedSelect" class="admin-select">
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </label>
                    <label class="admin-field">
                      <span class="admin-label">Visits</span>
                      <input id="fileVisits" class="admin-input" type="number" min="0" step="1" placeholder="0" />
                    </label>
                    <label class="admin-field">
                      <span class="admin-label">Downloads</span>
                      <input id="fileDownloads" class="admin-input" type="number" min="0" step="1" placeholder="0" />
                    </label>
                  </div>
                </details>
                <div class="admin-action-row admin-span-2">
                  <button id="fileSubmitButton" class="admin-button admin-button-primary" type="submit">Save File</button>
                  <button id="fileResetButton" class="admin-button admin-button-secondary" type="button">Reset</button>
                </div>
              </form>
            </section>
          </article>
        </aside>

        <div class="admin-content-column">
          <article id="adminWorkspaceCard" class="admin-card admin-data-card admin-switcher-card">
            <div class="admin-card-topline">
              <div>
                <p class="admin-eyebrow">Workspace</p>
                <h2 class="admin-section-title">Focus one area at a time</h2>
              </div>
              <div class="admin-tab-row">
                <button class="admin-tab-button" type="button" data-workspace-mode="catalog">Catalog</button>
                <button class="admin-tab-button" type="button" data-workspace-mode="files">Files</button>
                <button class="admin-tab-button" type="button" data-workspace-mode="tools">Tools</button>
              </div>
            </div>
            <p class="admin-section-copy">Use Catalog for brands and folders, Files for download links, and Tools for search plus integrity checks.</p>
          </article>

          <article class="admin-card admin-data-card admin-workspace-panel" data-workspace-panel="catalog">
            <p class="admin-eyebrow">Catalog</p>
            <h2 class="admin-section-title">Brands and folders</h2>
            <p class="admin-section-copy">Edit actions here load straight into the quick editor on the left, so you do not need to hunt for the right form.</p>
            <div class="admin-catalog-grid">
              <section class="admin-subpanel">
                <div class="admin-subpanel-head">
                  <div>
                    <h3 class="admin-subpanel-title">Brands</h3>
                    <p class="admin-muted">Root groups for the public download hub.</p>
                  </div>
                  <button class="admin-button admin-button-secondary" type="button" data-composer-mode="brand" data-composer-reset="true">New Brand</button>
                </div>
                <div class="admin-scroll-panel">
                  <div id="brandList" class="admin-list"></div>
                </div>
              </section>

              <section class="admin-subpanel">
                <div class="admin-subpanel-head">
                  <div>
                    <h3 class="admin-subpanel-title">Folders / Subfolders</h3>
                    <p class="admin-muted">Keep parent-child structure clean here.</p>
                  </div>
                  <button class="admin-button admin-button-secondary" type="button" data-composer-mode="category" data-composer-reset="true">New Folder</button>
                </div>
                <div class="admin-scroll-panel admin-scroll-panel-tall">
                  <div id="categoryList" class="admin-list"></div>
                </div>
              </section>
            </div>
          </article>

          <article class="admin-card admin-data-card admin-workspace-panel" data-workspace-panel="files" hidden>
            <p class="admin-eyebrow">Files</p>
            <h2 class="admin-section-title">Published and draft files</h2>
            <p class="admin-section-copy">Filter the list, open a link, or send an item into the editor without leaving this view.</p>
            <div class="admin-filter-row">
              <label class="admin-field">
                <span class="admin-label">Filter brand</span>
                <select id="filterBrand" class="admin-select"></select>
              </label>
              <label class="admin-field">
                <span class="admin-label">Filter folder</span>
                <select id="filterCategory" class="admin-select"></select>
              </label>
              <label class="admin-field">
                <span class="admin-label">Filter status</span>
                <select id="filterStatus" class="admin-select">
                  <option value="">All status</option>
                  <option value="published">Published only</option>
                  <option value="draft">Draft only</option>
                </select>
              </label>
            </div>
            <div class="admin-action-row">
              <button id="reloadFilesButton" class="admin-button admin-button-secondary" type="button">Reload Files</button>
              <button class="admin-button admin-button-secondary" type="button" data-composer-mode="file" data-composer-reset="true">New File</button>
              <button class="admin-button admin-button-ghost" type="button" data-workspace-mode="catalog">Open Catalog</button>
            </div>
            <div class="admin-table-shell admin-table-shell-tall">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Folder</th>
                    <th>Status</th>
                    <th>Traffic</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="fileTableBody"></tbody>
              </table>
            </div>
          </article>

          <article class="admin-card admin-data-card admin-workspace-panel" data-workspace-panel="tools" hidden>
            <p class="admin-eyebrow">Tools</p>
            <h2 class="admin-section-title">Search and integrity</h2>
            <p class="admin-section-copy">Search finds a file fast. Integrity scan checks category chains and file links before visitors see problems.</p>
            <form id="searchForm" class="admin-form-grid">
              <label class="admin-field admin-span-2">
                <span class="admin-label">Search query</span>
                <input id="searchQuery" class="admin-input" type="text" placeholder="file title, category, brand, link..." />
              </label>
              <div class="admin-action-row admin-span-2">
                <button id="searchSubmitButton" class="admin-button admin-button-primary" type="submit">Run Search</button>
                <button id="refreshCacheButton" class="admin-button admin-button-secondary" type="button">Refresh Public Cache</button>
                <button id="runIntegrityButton" class="admin-button admin-button-secondary" type="button">Run Integrity Scan</button>
              </div>
            </form>
            <div class="admin-tools-grid">
              <section class="admin-subpanel">
                <div class="admin-subpanel-head">
                  <div>
                    <h3 class="admin-subpanel-title">Search results</h3>
                    <p class="admin-muted" id="searchSummary">Search results will appear here.</p>
                  </div>
                </div>
                <div class="admin-scroll-panel">
                  <div id="searchResults" class="admin-search-list"></div>
                </div>
              </section>

              <section class="admin-subpanel">
                <div class="admin-subpanel-head">
                  <div>
                    <h3 class="admin-subpanel-title">Integrity</h3>
                    <p class="admin-muted">Run scans after edits to confirm the structure is still healthy.</p>
                  </div>
                </div>
                <div class="admin-scroll-panel">
                  <div id="integrityResults" class="admin-issue-list"></div>
                </div>
              </section>
            </div>
          </article>
        </div>
      </section>
    </main>
  `
}

const renderShell = () => {
  app.innerHTML = `
    <main class="admin-shell">
      <div class="admin-layout">
        ${renderSidebarMarkup()}

        <section class="admin-main">
          <header id="adminMainHeader" class="admin-card admin-header-card">
            <div class="admin-header-copy">
              <p id="workspaceEyebrow" class="admin-eyebrow">Catalog</p>
              <h2 id="workspaceTitle" class="admin-header-title">Browser brand, folder, dan file</h2>
              <p id="workspaceCopy" class="admin-copy">Pilih satu area kerja, lalu fokuskan edit hanya pada item yang aktif.</p>
            </div>
            <div class="admin-header-side">
              <div id="workspaceTrail" class="admin-pill-row"></div>
              <div class="admin-action-row">
                <button id="headerReloadButton" class="admin-button admin-button-secondary" type="button">Reload All</button>
                <button id="headerCacheButton" class="admin-button admin-button-secondary" type="button">Refresh Cache</button>
              </div>
            </div>
          </header>

          ${renderMobileQuickbarMarkup()}
          ${renderDashboardMarkup()}
          ${renderCatalogMarkup()}
          ${renderFilesMarkup()}
          ${renderToolsMarkup()}
        </section>
      </div>
      ${renderEditorMarkup()}
      ${renderConfirmDialogMarkup()}
    </main>
  `
}

const renderBanner = () => {
  const banner = byId<HTMLDivElement>('adminBanner')
  if (!banner) return

  banner.dataset.tone = state.bannerTone
  banner.textContent = state.bannerMessage
}

const renderWorkspaceHeader = () => {
  const eyebrow = byId<HTMLParagraphElement>('workspaceEyebrow')
  const title = byId<HTMLHeadingElement>('workspaceTitle')
  const copy = byId<HTMLParagraphElement>('workspaceCopy')
  const trail = byId<HTMLDivElement>('workspaceTrail')

  if (!eyebrow || !title || !copy || !trail) return

  const focusBrand = state.focusBrandId ? getBrandById(state.focusBrandId) : null
  const focusCategory = state.focusCategoryId ? getCategoryById(state.focusCategoryId) : null

  const dictionary: Record<WorkspaceMode, { eyebrow: string; title: string; copy: string }> = {
    dashboard: {
      eyebrow: 'Dashboard',
      title: 'Overview and quick access',
      copy: 'Ringkasan sistem.',
    },
    catalog: {
      eyebrow: 'Catalog',
      title: 'Browser brand, folder, dan isi file',
      copy: 'Fokuskan satu brand atau satu folder saja. Isi file aktif tampil di kanan supaya struktur lebih gampang dibaca.',
    },
    files: {
      eyebrow: 'Files',
      title: 'Link, price, dan status file',
      copy: 'Gunakan filter brand dan folder supaya daftar file lebih jelas dan tidak bercampur.',
    },
    tools: {
      eyebrow: 'Tools',
      title: 'Pencarian dan pengecekan data',
      copy: 'Gunakan hanya saat perlu cari file cepat atau cek integritas.',
    },
  }

  const current = dictionary[state.activeWorkspace]
  eyebrow.textContent = current.eyebrow
  title.textContent = current.title
  copy.textContent = current.copy

  const chips = [
    focusBrand ? `<span class="admin-pill">Brand: ${escapeHtml(focusBrand.label)}</span>` : '',
    focusCategory ? `<span class="admin-pill">Folder: ${escapeHtml(focusCategory.fullLabel || focusCategory.label)}</span>` : '',
    state.bootstrap?.lastPublicRefresh
      ? `<span class="admin-pill">Refresh: ${escapeHtml(formatTimestamp(state.bootstrap.lastPublicRefresh))}</span>`
      : '',
  ].filter(Boolean)

  trail.innerHTML = chips.join('') || `<span class="admin-pill">No focus selected yet</span>`
}

const renderStats = () => {
  const mount = byId<HTMLDivElement>('adminStats')
  if (!mount) return

  const totals = state.bootstrap?.totals
  const brandCount = totals?.brands ?? state.bootstrap?.brands.length ?? 0
  const categoryCount = totals?.categories ?? state.bootstrap?.categories.length ?? 0
  const fileCount = totals?.files ?? state.fileIndex.length ?? state.files.length ?? state.bootstrap?.recentFiles.length ?? 0
  const lastRefresh = formatTimestamp(state.bootstrap?.lastPublicRefresh || '')

  mount.innerHTML = `
    <article class="admin-metric-card" data-tone="blue">
      <span class="admin-metric-label">Brands</span>
      <strong>${brandCount}</strong>
      <span class="admin-metric-meta">Root groups</span>
    </article>
    <article class="admin-metric-card" data-tone="amber">
      <span class="admin-metric-label">Folders</span>
      <strong>${categoryCount}</strong>
      <span class="admin-metric-meta">Folder and subfolder rows</span>
    </article>
    <article class="admin-metric-card" data-tone="green">
      <span class="admin-metric-label">Files</span>
      <strong>${fileCount}</strong>
      <span class="admin-metric-meta">Indexed in D1</span>
    </article>
    <article class="admin-metric-card" data-tone="rose">
      <span class="admin-metric-label">Last Refresh</span>
      <strong class="admin-metric-compact">${escapeHtml(lastRefresh)}</strong>
      <span class="admin-metric-meta">Public cache update</span>
    </article>
  `
}

const renderDashboardBrands = () => {
  const mount = byId<HTMLDivElement>('dashboardBrands')
  if (!mount) return

  const brands = getBootstrapBrands()
  if (!brands.length) {
    mount.innerHTML = `<article class="admin-list-item"><div class="admin-empty">No brands loaded yet.</div></article>`
    return
  }

  mount.innerHTML = brands
    .map((brand) => {
      const folderCount = getCategoriesForBrand(brand.id).length
      const fileCount = countIndexedFilesForBrand(brand.id)
      const isActive = state.focusBrandId === brand.id && !state.focusCategoryId

      return `
        <article class="admin-brand-summary-card${isActive ? ' is-active' : ''}">
          <div class="admin-card-head admin-card-head-tight">
            <div>
              <h3 class="admin-subpanel-title">${escapeHtml(brand.label)}</h3>
              <p class="admin-muted">ID <span class="admin-kbd">${escapeHtml(brand.id)}</span></p>
            </div>
            <div class="admin-chip-row">
              <span class="admin-tree-chip">${folderCount} folders</span>
              <span class="admin-tree-chip">${fileCount} files</span>
            </div>
          </div>
          <div class="admin-action-row">
            <button class="admin-button admin-button-secondary" type="button" data-action="open-brand-catalog" data-id="${escapeHtml(brand.id)}">Open Catalog</button>
            <button class="admin-button admin-button-secondary" type="button" data-action="brand-files" data-id="${escapeHtml(brand.id)}">Open Files</button>
          </div>
        </article>
      `
    })
    .join('')
}

const renderDashboardRecentFiles = () => {
  const mount = byId<HTMLDivElement>('dashboardRecentFiles')
  if (!mount) return

  const files = [...(state.bootstrap?.recentFiles ?? [])]
  if (!files.length) {
    mount.innerHTML = `<article class="admin-list-item"><div class="admin-empty">No recent files yet.</div></article>`
    return
  }

  mount.innerHTML = files
    .map(
      (file) => `
        <article class="admin-list-item">
          <div class="admin-list-item-head">
            <div>
              <div class="admin-file-title">${escapeHtml(file.title)}</div>
              <div class="admin-file-meta">${escapeHtml(file.brandLabel)} / ${escapeHtml(file.categoryLabel)} / ${escapeHtml(file.status)}</div>
              <div class="admin-subtle">Updated ${escapeHtml(formatTimestamp(file.updatedAt))}</div>
            </div>
            <div class="admin-actions">
              <button class="admin-button admin-button-secondary" type="button" data-action="edit-dashboard-file" data-id="${escapeHtml(file.id)}">Edit</button>
              <button class="admin-button admin-button-ghost" type="button" data-action="category-files" data-id="${escapeHtml(file.categoryId)}">Open Folder</button>
            </div>
          </div>
        </article>
      `,
    )
    .join('')
}

const renderDashboardHealth = () => {
  const mount = byId<HTMLDivElement>('dashboardHealth')
  if (!mount) return

  const refreshTime = formatTimestamp(state.bootstrap?.lastPublicRefresh || '')
  const cacheVersion = toText(state.bootstrap?.cacheVersion || '') || '-'
  const integrityState = state.integrity?.status || 'not-run'
  const integrityTotal = state.integrity?.summary.totalIssues ?? 0

  mount.innerHTML = `
    <article class="admin-health-card">
      <span class="admin-muted">Current target</span>
      <strong>${escapeHtml(getCurrentAdminBaseUrl() || '/api/admin')}</strong>
    </article>
    <article class="admin-health-card">
      <span class="admin-muted">Cache version</span>
      <strong>${escapeHtml(cacheVersion)}</strong>
    </article>
    <article class="admin-health-card">
      <span class="admin-muted">Last refresh</span>
      <strong>${escapeHtml(refreshTime)}</strong>
    </article>
    <article class="admin-health-card">
      <span class="admin-muted">Integrity</span>
      <strong>${escapeHtml(integrityState)}</strong>
      <span class="admin-subtle">${integrityTotal} issue(s)</span>
    </article>
  `
}

const renderCatalogExplorer = () => {
  const mount = byId<HTMLDivElement>('catalogExplorer')
  if (!mount) return

  const brands = getBootstrapBrands()
  if (!brands.length) {
    mount.innerHTML = `<article class="admin-list-item"><div class="admin-empty">No brands loaded yet. Connect the panel first.</div></article>`
    return
  }

  const renderCategoryBranch = (category: AdminCategory, depth = 0): string => {
    const children = getChildCategories(category.id)
    const fileCount = countIndexedFilesForCategory(category.id)
    const isActive = state.focusCategoryId === category.id

    return `
      <article class="admin-folder-row${isActive ? ' is-active' : ''}" style="--folder-depth:${depth}">
        <div class="admin-folder-main">
          <button class="admin-folder-select" type="button" data-action="focus-category" data-id="${escapeHtml(category.id)}">
            <span class="admin-folder-bullet"></span>
            <span>
              <strong>${escapeHtml(category.label)}</strong>
              <span class="admin-folder-meta">${fileCount} file · ${children.length} subfolder</span>
            </span>
          </button>
        </div>
      </article>
      ${children.length ? `<div class="admin-folder-children">${children.map((child) => renderCategoryBranch(child, depth + 1)).join('')}</div>` : ''}
    `
  }

  const activeBrandId = state.focusBrandId || brands[0]?.id || ''
  const activeBrand = getBrandById(activeBrandId) || brands[0]

  if (activeBrand && state.focusBrandId !== activeBrand.id) {
    state.focusBrandId = activeBrand.id
  }

  const activeCategories = activeBrand ? getRootCategoriesForBrand(activeBrand.id) : []
  const activeFolderCount = activeBrand ? getCategoriesForBrand(activeBrand.id).length : 0
  const activeFileCount = activeBrand ? countIndexedFilesForBrand(activeBrand.id) : 0

  mount.innerHTML = `
    <section class="admin-brand-switcher">
      ${brands
        .map((brand) => {
          const isActive = activeBrand?.id === brand.id
          const brandFolders = getCategoriesForBrand(brand.id).length
          const brandFiles = countIndexedFilesForBrand(brand.id)
          return `
            <button class="admin-brand-pill${isActive ? ' is-active' : ''}" type="button" data-action="focus-brand" data-id="${escapeHtml(brand.id)}">
              <span>${escapeHtml(brand.label)}</span>
              <small>${brandFolders} folder · ${brandFiles} file</small>
            </button>
          `
        })
        .join('')}
    </section>

    ${
      activeBrand
        ? `
          <article class="admin-brand-card is-active">
            <div class="admin-card-head">
              <div>
                <p class="admin-eyebrow">Brand aktif</p>
                <h3 class="admin-subpanel-title">${escapeHtml(activeBrand.label)}</h3>
                <p class="admin-muted">ID <span class="admin-kbd">${escapeHtml(activeBrand.id)}</span> / ${activeFolderCount} folders / ${activeFileCount} files</p>
              </div>
            </div>
            <div class="admin-folder-tree">
              ${
                activeCategories.length
                  ? activeCategories.map((category) => renderCategoryBranch(category)).join('')
                  : '<div class="admin-empty">Belum ada folder di brand ini.</div>'
              }
            </div>
          </article>
        `
        : `<article class="admin-list-item"><div class="admin-empty">No brand selected.</div></article>`
    }
  `
}

const renderCatalogInspector = () => {
  const title = byId<HTMLHeadingElement>('catalogInspectorTitle')
  const copy = byId<HTMLParagraphElement>('catalogInspectorCopy')
  const meta = byId<HTMLDivElement>('catalogSelectionMeta')
  const actions = byId<HTMLDivElement>('catalogQuickActions')
  const body = byId<HTMLTableSectionElement>('catalogFileTableBody')

  if (!title || !copy || !meta || !actions || !body) return

  const activeBrand = getActiveBrand()
  const activeCategory = state.focusCategoryId ? getCategoryById(state.focusCategoryId) : null
  const files = getInspectorFiles()

  if (!activeBrand) {
    title.textContent = 'Belum ada brand aktif'
    copy.textContent = 'Connect dulu, lalu pilih brand agar isi file tampil di sini.'
    meta.innerHTML = ''
    actions.innerHTML = ''
    body.innerHTML = `<tr><td colspan="5" class="admin-subtle admin-table-empty">No brand selected yet.</td></tr>`
    return
  }

  title.textContent = activeCategory ? `${activeCategory.label}` : `${activeBrand.label}`
  copy.textContent = activeCategory
    ? `Menampilkan file milik folder ${activeCategory.label} beserta subfolder di brand ${activeBrand.label}.`
    : `Menampilkan semua file dalam brand ${activeBrand.label}. Klik folder di kiri kalau ingin lebih fokus.`

  meta.innerHTML = [
    `<span class="admin-pill">Brand: ${escapeHtml(activeBrand.label)}</span>`,
    activeCategory ? `<span class="admin-pill">Folder: ${escapeHtml(activeCategory.fullLabel || activeCategory.label)}</span>` : '',
    `<span class="admin-pill">${files.length} file tampil</span>`,
  ]
    .filter(Boolean)
    .join('')

  actions.innerHTML = activeCategory
    ? `
        <button class="admin-button admin-button-secondary" type="button" data-action="inspect-edit-category" data-id="${escapeHtml(activeCategory.id)}">Edit Folder</button>
        <button class="admin-button admin-button-secondary" type="button" data-action="inspect-new-subcategory" data-id="${escapeHtml(activeCategory.id)}">Tambah Subfolder</button>
        <button class="admin-button admin-button-secondary" type="button" data-action="inspect-new-file" data-id="${escapeHtml(activeCategory.id)}">Tambah File</button>
        <button class="admin-button admin-button-danger" type="button" data-action="inspect-delete-category" data-id="${escapeHtml(activeCategory.id)}">Hapus Folder</button>
      `
    : `
        <button class="admin-button admin-button-secondary" type="button" data-action="inspect-edit-brand" data-id="${escapeHtml(activeBrand.id)}">Edit Brand</button>
        <button class="admin-button admin-button-secondary" type="button" data-action="inspect-new-category" data-id="${escapeHtml(activeBrand.id)}">Tambah Folder</button>
        <button class="admin-button admin-button-secondary" type="button" data-action="inspect-new-file-in-brand" data-id="${escapeHtml(activeBrand.id)}">Tambah File</button>
      `

  if (!files.length) {
    body.innerHTML = `<tr><td colspan="5" class="admin-subtle admin-table-empty">Belum ada file di pilihan ini.</td></tr>`
    return
  }

  body.innerHTML = files
    .map(
      (file) => `
        <tr>
          <td data-label="File">
            <div class="admin-file-title">${escapeHtml(file.title)}</div>
            <div class="admin-file-meta">${escapeHtml(file.categoryLabel)}</div>
          </td>
          <td data-label="Price">${escapeHtml(file.price || 'free')}</td>
          <td data-label="Status">
            <span class="admin-file-chip" data-tone="${escapeHtml(file.status)}">${escapeHtml(file.status)}</span>
          </td>
          <td data-label="Link">
            <a class="admin-link-button" href="${escapeHtml(file.driveUrl || '#')}" target="_blank" rel="noreferrer">Open Link</a>
          </td>
          <td data-label="Actions">
            <div class="admin-actions">
              <button class="admin-button admin-button-secondary" type="button" data-action="inspect-edit-file" data-id="${escapeHtml(file.id)}">Edit</button>
              <button class="admin-button admin-button-danger" type="button" data-action="inspect-delete-file" data-id="${escapeHtml(file.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

const renderBrandList = () => {
  const mount = byId<HTMLDivElement>('brandList')
  if (!mount) return

  const brands = getBootstrapBrands()
  if (!brands.length) {
    mount.innerHTML = `<div class="admin-list-item"><div class="admin-empty">No brands loaded yet. Connect the panel first.</div></div>`
    return
  }

  mount.innerHTML = brands
    .map(
      (brand) => `
        <article class="admin-list-item">
          <div class="admin-list-item-head">
            <div>
              <div class="admin-tree-label">${escapeHtml(brand.label)}</div>
              <div class="admin-tree-meta">Brand ID: <span class="admin-kbd">${escapeHtml(brand.id)}</span></div>
            </div>
            <div class="admin-actions">
              <button class="admin-button admin-button-secondary" type="button" data-action="edit-brand" data-id="${escapeHtml(brand.id)}">Edit</button>
              <button class="admin-button admin-button-danger" type="button" data-action="delete-brand" data-id="${escapeHtml(brand.id)}">Delete</button>
            </div>
          </div>
        </article>
      `,
    )
    .join('')
}

const renderCategoryList = () => {
  const mount = byId<HTMLDivElement>('categoryList')
  if (!mount) return

  const categories = getBootstrapCategories()
  if (!categories.length) {
    mount.innerHTML = `<div class="admin-list-item"><div class="admin-empty">No folders loaded yet.</div></div>`
    return
  }

  mount.innerHTML = categories
    .map((category) => {
      const depth = Number(category.depth || 0)
      const indent = '&nbsp;'.repeat(Math.max(0, depth) * 4)

      return `
        <article class="admin-list-item">
          <div class="admin-list-item-head">
            <div>
              <div class="admin-tree-label">${indent}${escapeHtml(category.fullLabel || category.label)}</div>
              <div class="admin-tree-meta">
                ${escapeHtml(category.brandLabel)} · ID <span class="admin-kbd">${escapeHtml(category.id)}</span>
                ${category.parentCategoryId ? ` · Parent <span class="admin-kbd">${escapeHtml(category.parentCategoryId)}</span>` : ''}
                ${category.hasChildren ? ' · Has subfolders' : ''}
              </div>
            </div>
            <div class="admin-actions">
              <button class="admin-button admin-button-secondary" type="button" data-action="edit-category" data-id="${escapeHtml(category.id)}">Edit</button>
              <button class="admin-button admin-button-danger" type="button" data-action="delete-category" data-id="${escapeHtml(category.id)}">Delete</button>
            </div>
          </div>
        </article>
      `
    })
    .join('')
}

const renderFileTableLegacy = () => {
  const mount = byId<HTMLTableSectionElement>('fileTableBody')
  if (!mount) return

  if (state.filesLoading) {
    mount.innerHTML = `<tr><td colspan="5" class="admin-subtle admin-table-empty">Loading files from D1...</td></tr>`
    return
  }

  if (!state.files.length) {
    mount.innerHTML = `<tr><td colspan="5" class="admin-subtle admin-table-empty">No files match the current filter.</td></tr>`
    return
  }

  mount.innerHTML = state.files
    .map(
      (file) => `
        <tr>
          <td>
            <div class="admin-file-title">${escapeHtml(file.title)}</div>
            <div class="admin-file-meta">${escapeHtml(file.subtitle || '-')}</div>
            <div class="admin-subtle">ID <span class="admin-kbd">${escapeHtml(file.id)}</span></div>
          </td>
          <td>
            <div class="admin-file-title">${escapeHtml(file.categoryLabel)}</div>
            <div class="admin-file-meta">${escapeHtml(file.brandLabel)} · ${escapeHtml(file.size || '-')}</div>
          </td>
          <td>
            <span class="admin-file-chip" data-tone="${escapeHtml(file.status)}">${escapeHtml(file.status)}</span>
            ${file.featured ? `<div class="admin-subtle" style="margin-top:8px">Featured</div>` : ''}
          </td>
          <td>
            <div class="admin-file-title">${escapeHtml(file.downloads)} downloads</div>
            <div class="admin-file-meta">${escapeHtml(file.visits)} visits · ${escapeHtml(file.price || 'free')}</div>
          </td>
          <td>
            <div class="admin-actions">
              <button class="admin-button admin-button-secondary" type="button" data-action="edit-file" data-id="${escapeHtml(file.id)}">Edit</button>
              <a class="admin-link-button" href="${escapeHtml(file.driveUrl || '#')}" target="_blank" rel="noreferrer">Open Link</a>
              <button class="admin-button admin-button-danger" type="button" data-action="delete-file" data-id="${escapeHtml(file.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

const renderFileTable = () => {
  const mount = byId<HTMLTableSectionElement>('fileTableBody')
  if (!mount) return

  if (state.filesLoading) {
    mount.innerHTML = `<tr><td colspan="5" class="admin-subtle">Loading files from D1...</td></tr>`
    return
  }

  if (!state.files.length) {
    mount.innerHTML = `<tr><td colspan="5" class="admin-subtle">No files match the current filter.</td></tr>`
    return
  }

  mount.innerHTML = state.files
    .map(
      (file) => `
        <tr>
          <td data-label="File">
            <div class="admin-file-title">${escapeHtml(file.title)}</div>
            <div class="admin-file-meta">${escapeHtml(file.subtitle || '-')}</div>
            <div class="admin-subtle">ID <span class="admin-kbd">${escapeHtml(file.id)}</span></div>
          </td>
          <td data-label="Folder">
            <div class="admin-file-title">${escapeHtml(file.categoryLabel)}</div>
            <div class="admin-file-meta">${escapeHtml(file.brandLabel)} / ${escapeHtml(file.size || '-')}</div>
          </td>
          <td data-label="Status">
            <span class="admin-file-chip" data-tone="${escapeHtml(file.status)}">${escapeHtml(file.status)}</span>
            ${file.featured ? `<div class="admin-subtle" style="margin-top:8px">Featured</div>` : ''}
          </td>
          <td data-label="Traffic">
            <div class="admin-file-title">${escapeHtml(file.downloads)} downloads</div>
            <div class="admin-file-meta">${escapeHtml(file.visits)} visits / ${escapeHtml(file.price || 'free')}</div>
          </td>
          <td data-label="Actions">
            <div class="admin-actions">
              <button class="admin-button admin-button-secondary" type="button" data-action="edit-file" data-id="${escapeHtml(file.id)}">Edit</button>
              <a class="admin-link-button" href="${escapeHtml(file.driveUrl || '#')}" target="_blank" rel="noreferrer">Open Link</a>
              <button class="admin-button admin-button-danger" type="button" data-action="delete-file" data-id="${escapeHtml(file.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
}

const renderSearchResultsLegacy = () => {
  const mount = byId<HTMLDivElement>('searchResults')
  const summary = byId<HTMLParagraphElement>('searchSummary')
  if (!mount || !summary) return

  summary.textContent = state.searchSummary || 'Search results will appear here.'

  if (!state.searchResults.length) {
    mount.innerHTML = ''
    return
  }

  mount.innerHTML = state.searchResults
    .map(
      (file) => `
        <article class="admin-search-item">
          <div class="admin-search-item-head">
            <div>
              <div class="admin-file-title">${escapeHtml(file.title)}</div>
              <div class="admin-search-meta">${escapeHtml(file.brandLabel)} · ${escapeHtml(file.categoryLabel)} · ${escapeHtml(file.status)}</div>
            </div>
            <div class="admin-actions">
              <button class="admin-button admin-button-secondary" type="button" data-action="edit-search-file" data-id="${escapeHtml(file.id)}">Edit</button>
            </div>
          </div>
        </article>
      `,
    )
    .join('')
}

const renderSearchResults = () => {
  const mount = byId<HTMLDivElement>('searchResults')
  const summary = byId<HTMLParagraphElement>('searchSummary')
  if (!mount || !summary) return

  summary.textContent = state.searchSummary || 'Search results will appear here.'

  if (!state.searchResults.length) {
    mount.innerHTML = ''
    return
  }

  mount.innerHTML = state.searchResults
    .map(
      (file) => `
        <article class="admin-search-item">
          <div class="admin-search-item-head">
            <div>
              <div class="admin-file-title">${escapeHtml(file.title)}</div>
              <div class="admin-search-meta">${escapeHtml(file.brandLabel)} / ${escapeHtml(file.categoryLabel)} / ${escapeHtml(file.status)}</div>
            </div>
            <div class="admin-actions">
              <button class="admin-button admin-button-secondary" type="button" data-action="edit-search-file" data-id="${escapeHtml(file.id)}">Edit</button>
              <button class="admin-button admin-button-ghost" type="button" data-action="search-open-folder" data-id="${escapeHtml(file.categoryId)}">Open Folder</button>
            </div>
          </div>
        </article>
      `,
    )
    .join('')
}

const renderIntegrityResultsLegacy = () => {
  const mount = byId<HTMLDivElement>('integrityResults')
  if (!mount) return

  if (!state.integrity) {
    mount.innerHTML = ''
    return
  }

  const statusTone =
    state.integrity.status === 'critical'
      ? 'critical'
      : state.integrity.status === 'warning'
        ? 'warning'
        : 'clean'

  const issueMarkup = state.integrity.issues.length
    ? state.integrity.issues
        .map(
          (issue) => `
            <article class="admin-issue-item">
              <div class="admin-list-item-head">
                <div>
                  <div class="admin-issue-title">${escapeHtml(issue.title)}</div>
                  <div class="admin-issue-detail">${escapeHtml(issue.detail)}</div>
                </div>
                <span class="admin-issue-chip" data-tone="${escapeHtml(issue.level)}">${escapeHtml(issue.level)}</span>
              </div>
            </article>
          `,
        )
        .join('')
    : `<article class="admin-issue-item"><div class="admin-empty">No integrity issues detected.</div></article>`

  mount.innerHTML = `
    <article class="admin-search-item">
      <div class="admin-list-item-head">
        <div>
          <div class="admin-file-title">Integrity status: ${escapeHtml(state.integrity.status)}</div>
          <div class="admin-search-meta">
            Checked ${escapeHtml(formatTimestamp(state.integrity.checkedAt))} ·
            ${state.integrity.summary.totalIssues} issues ·
            ${state.integrity.summary.files} files
          </div>
        </div>
        <span class="admin-issue-chip" data-tone="${statusTone}">${escapeHtml(state.integrity.status)}</span>
      </div>
    </article>
    ${issueMarkup}
  `
}

const renderIntegrityResults = () => {
  const mount = byId<HTMLDivElement>('integrityResults')
  if (!mount) return

  if (!state.integrity) {
    mount.innerHTML = `<article class="admin-issue-item"><div class="admin-empty">Run an integrity scan to see structure health here.</div></article>`
    return
  }

  const statusTone =
    state.integrity.status === 'critical'
      ? 'critical'
      : state.integrity.status === 'warning'
        ? 'warning'
        : 'clean'

  const issueMarkup = state.integrity.issues.length
    ? state.integrity.issues
        .map(
          (issue) => `
            <article class="admin-issue-item">
              <div class="admin-list-item-head">
                <div>
                  <div class="admin-issue-title">${escapeHtml(issue.title)}</div>
                  <div class="admin-issue-detail">${escapeHtml(issue.detail)}</div>
                </div>
                <span class="admin-issue-chip" data-tone="${escapeHtml(issue.level)}">${escapeHtml(issue.level)}</span>
              </div>
            </article>
          `,
        )
        .join('')
    : `<article class="admin-issue-item"><div class="admin-empty">No integrity issues detected.</div></article>`

  mount.innerHTML = `
    <article class="admin-search-item">
      <div class="admin-list-item-head">
        <div>
          <div class="admin-file-title">Integrity status: ${escapeHtml(state.integrity.status)}</div>
          <div class="admin-search-meta">
            Checked ${escapeHtml(formatTimestamp(state.integrity.checkedAt))} /
            ${state.integrity.summary.totalIssues} issues /
            ${state.integrity.summary.files} files
          </div>
        </div>
        <span class="admin-issue-chip" data-tone="${statusTone}">${escapeHtml(state.integrity.status)}</span>
      </div>
    </article>
    ${issueMarkup}
  `
}

const syncConnectionFields = () => {
  setInputValue('adminApiBase', getCurrentAdminBaseUrl())
  setInputValue('adminToken', state.token)

  const target = byId<HTMLSpanElement>('currentApiTarget')
  if (target) {
    target.textContent = getCurrentAdminBaseUrl() || '/api/admin'
  }
}

const syncCategoryParentOptions = () => {
  const select = byId<HTMLSelectElement>('parentCategory')
  const brandId = getInputValue('categoryBrand')
  const currentValue = toText(select?.value || '')

  const options = [
    { value: '', label: 'No parent (top-level folder)' },
    ...getCategoriesForBrand(brandId)
      .filter((category) => category.id !== state.editingCategoryId)
      .map((category) => ({
        value: category.id,
        label: category.fullLabel || category.label,
      })),
  ]

  setSelectOptions(select, options, currentValue)
}

const syncFileCategoryOptions = () => {
  const select = byId<HTMLSelectElement>('fileCategory')
  const brandId = getInputValue('fileBrand')
  const currentValue = toText(select?.value || '')

  const options = getCategoriesForBrand(brandId).map((category) => ({
    value: category.id,
    label: category.fullLabel || category.label,
  }))

  setSelectOptions(
    select,
    options.length ? options : [{ value: '', label: 'No folder available for this brand yet' }],
    currentValue,
  )
}

const syncFilterCategoryOptions = () => {
  const select = byId<HTMLSelectElement>('filterCategory')
  const brandId = getInputValue('filterBrand')
  const currentValue = toText(select?.value || '')

  const options = [
    { value: '', label: 'All folders' },
    ...getCategoriesForBrand(brandId).map((category) => ({
      value: category.id,
      label: category.fullLabel || category.label,
    })),
  ]

  if (!brandId) {
    options.push(
      ...getBootstrapCategories()
        .filter((category) => !options.some((option) => option.value === category.id))
        .map((category) => ({
          value: category.id,
          label: category.fullLabel || category.label,
        })),
    )
  }

  setSelectOptions(select, options, currentValue)
}

const syncBrandOptions = () => {
  const brands = getBootstrapBrands()
  const brandOptions = brands.length
    ? brands.map((brand) => ({
        value: brand.id,
        label: `${brand.label} (${brand.id})`,
      }))
    : [{ value: '', label: 'No brand available yet' }]

  setSelectOptions(byId<HTMLSelectElement>('categoryBrand'), brandOptions, getInputValue('categoryBrand'))
  setSelectOptions(byId<HTMLSelectElement>('fileBrand'), brandOptions, getInputValue('fileBrand'))

  const filterOptions = [{ value: '', label: 'All brands' }, ...brandOptions.filter((option) => option.value)]
  setSelectOptions(byId<HTMLSelectElement>('filterBrand'), filterOptions, getInputValue('filterBrand'))

  syncCategoryParentOptions()
  syncFileCategoryOptions()
  syncFilterCategoryOptions()
}

const setBrandFormMode = (editing: boolean) => {
  const title = byId<HTMLHeadingElement>('brandFormTitle')
  const submit = byId<HTMLButtonElement>('brandSubmitButton')
  if (title) {
    title.textContent = editing ? 'Edit Brand' : 'Create Brand'
  }
  if (submit) {
    submit.textContent = editing ? 'Update Brand' : 'Save Brand'
  }
}

const setCategoryFormMode = (editing: boolean) => {
  const title = byId<HTMLHeadingElement>('categoryFormTitle')
  const submit = byId<HTMLButtonElement>('categorySubmitButton')
  if (title) {
    title.textContent = editing ? 'Edit Folder / Subfolder' : 'Create Folder / Subfolder'
  }
  if (submit) {
    submit.textContent = editing ? 'Update Folder' : 'Save Folder'
  }
}

const setFileFormMode = (editing: boolean) => {
  const title = byId<HTMLHeadingElement>('fileFormTitle')
  const submit = byId<HTMLButtonElement>('fileSubmitButton')
  if (title) {
    title.textContent = editing ? 'Edit File' : 'Create File'
  }
  if (submit) {
    submit.textContent = editing ? 'Update File' : 'Save File'
  }
}

const resetBrandForm = () => {
  state.editingBrandId = ''
  setInputValue('brandId', '')
  setInputValue('brandLabel', '')
  setBrandFormMode(false)
  syncViewModes()
}

const resetCategoryForm = () => {
  state.editingCategoryId = ''
  setInputValue('categoryId', '')
  setInputValue('categoryLabel', '')
  const firstBrandId = state.focusBrandId || getBootstrapBrands()[0]?.id || ''
  setInputValue('categoryBrand', firstBrandId)
  syncCategoryParentOptions()
  setInputValue('parentCategory', state.focusCategoryId || '')
  setCategoryFormMode(false)
  syncViewModes()
}

const resetFileForm = () => {
  state.editingFileId = ''
  const firstBrandId = state.focusBrandId || getBootstrapBrands()[0]?.id || ''

  setInputValue('fileId', '')
  setInputValue('fileTitle', '')
  setInputValue('fileSubtitle', '')
  setInputValue('fileSummary', '')
  setInputValue('fileDriveUrl', '')
  setInputValue('fileDate', '')
  setInputValue('fileSize', '')
  setInputValue('filePrice', 'free')
  setInputValue('fileVisits', '0')
  setInputValue('fileDownloads', '0')
  setInputValue('fileStatus', 'draft')
  setInputValue('fileBrand', firstBrandId)
  syncFileCategoryOptions()
  setInputValue('fileCategory', state.focusCategoryId || getCategoriesForBrand(firstBrandId)[0]?.id || '')
  setInputValue('fileFeaturedSelect', 'false')
  setFileFormMode(false)
  state.fileAdvancedOpen = false
  syncViewModes()
}

const prepareNewCategoryForm = (brandId = '', parentCategoryId = '') => {
  state.editingCategoryId = ''
  setCategoryFormMode(false)
  setInputValue('categoryId', '')
  setInputValue('categoryLabel', '')
  const nextBrandId = brandId || state.focusBrandId || getBootstrapBrands()[0]?.id || ''
  setInputValue('categoryBrand', nextBrandId)
  syncCategoryParentOptions()
  setInputValue('parentCategory', parentCategoryId)
  setFocus({ brandId: nextBrandId, categoryId: parentCategoryId })
  revealWorkspace('catalog', { scroll: true })
  revealComposer('category', { scroll: true })
}

const prepareNewFileForm = (brandId = '', categoryId = '') => {
  state.editingFileId = ''
  setFileFormMode(false)
  const nextBrandId = brandId || state.focusBrandId || getBootstrapBrands()[0]?.id || ''
  const nextCategoryId = categoryId || state.focusCategoryId || getCategoriesForBrand(nextBrandId)[0]?.id || ''

  setInputValue('fileId', '')
  setInputValue('fileTitle', '')
  setInputValue('fileSubtitle', '')
  setInputValue('fileSummary', '')
  setInputValue('fileDriveUrl', '')
  setInputValue('fileDate', '')
  setInputValue('fileSize', '')
  setInputValue('filePrice', 'free')
  setInputValue('fileVisits', '0')
  setInputValue('fileDownloads', '0')
  setInputValue('fileStatus', 'draft')
  setInputValue('fileBrand', nextBrandId)
  syncFileCategoryOptions()
  setInputValue('fileCategory', nextCategoryId)
  setInputValue('fileFeaturedSelect', 'false')
  state.fileAdvancedOpen = false
  setFocus({ brandId: nextBrandId, categoryId: nextCategoryId })
  revealWorkspace('catalog', { scroll: true })
  revealComposer('file', { scroll: true })
}

const populateBrandForm = (brand: AdminBrand) => {
  state.editingBrandId = brand.id
  setInputValue('brandId', brand.id)
  setInputValue('brandLabel', brand.label)
  setBrandFormMode(true)
  setFocus({ brandId: brand.id })
  revealWorkspace('catalog', { scroll: true })
  revealComposer('brand', { scroll: true })
}

const populateCategoryForm = (category: AdminCategory) => {
  state.editingCategoryId = category.id
  setInputValue('categoryId', category.id)
  setInputValue('categoryLabel', category.label)
  setInputValue('categoryBrand', category.brandId)
  syncCategoryParentOptions()
  setInputValue('parentCategory', category.parentCategoryId || '')
  setCategoryFormMode(true)
  setFocus({ categoryId: category.id })
  revealWorkspace('catalog', { scroll: true })
  revealComposer('category', { scroll: true })
}

const populateFileForm = (file: AdminFile) => {
  state.editingFileId = file.id
  setInputValue('fileId', file.id)
  setInputValue('fileTitle', file.title)
  setInputValue('fileSubtitle', file.subtitle)
  setInputValue('fileSummary', file.summary)
  setInputValue('fileDriveUrl', file.driveUrl)
  setInputValue('fileDate', file.date)
  setInputValue('fileSize', file.size)
  setInputValue('filePrice', file.price)
  setInputValue('fileVisits', file.visits)
  setInputValue('fileDownloads', file.downloads)
  setInputValue('fileStatus', file.status)
  setInputValue('fileBrand', file.brandId)
  syncFileCategoryOptions()
  setInputValue('fileCategory', file.categoryId)
  setInputValue('fileFeaturedSelect', String(Boolean(file.featured)))
  setFileFormMode(true)
  setFocus({ categoryId: file.categoryId })
  revealWorkspace('catalog', { scroll: true })
  revealComposer('file', { scroll: true, fileAdvancedOpen: true })
}

const ensureFormsStillValid = () => {
  if (state.editingBrandId && !getBrandById(state.editingBrandId)) {
    resetBrandForm()
  }

  if (state.editingCategoryId && !getCategoryById(state.editingCategoryId)) {
    resetCategoryForm()
  }

  if (state.editingFileId && !getKnownFiles().find((file) => file.id === state.editingFileId)) {
    resetFileForm()
  }
}

const ensureFocusStillValid = () => {
  if (state.focusCategoryId && !getCategoryById(state.focusCategoryId)) {
    state.focusCategoryId = ''
  }

  if (state.focusBrandId && !getBrandById(state.focusBrandId)) {
    state.focusBrandId = ''
  }
}

const applyBootstrap = (payload: BootstrapResponse) => {
  state.bootstrap = payload
  ensureFocusStillValid()
  if (!state.focusBrandId) {
    state.focusBrandId = payload.brands[0]?.id || ''
  }
  renderStats()
  renderDashboardBrands()
  renderDashboardRecentFiles()
  renderDashboardHealth()
  renderCatalogExplorer()
  renderCatalogInspector()
  syncBrandOptions()
  ensureFormsStillValid()
  renderWorkspaceHeader()
}

const loadBootstrap = async () => {
  const data = await requestAdmin<BootstrapResponse>('bootstrap', { method: 'GET' })
  applyBootstrap(data)
}

const loadFileIndex = async () => {
  const data = await requestAdmin<FilesResponse>('files', { method: 'GET' })
  state.fileIndex = data.files ?? []
  renderStats()
  renderDashboardBrands()
  renderDashboardRecentFiles()
  renderDashboardHealth()
  renderCatalogExplorer()
  renderCatalogInspector()
}

const loadFiles = async () => {
  state.filesLoading = true
  renderFileTable()

  try {
    const params = new URLSearchParams()
    const brandId = getInputValue('filterBrand')
    const categoryId = getInputValue('filterCategory')
    const status = getInputValue('filterStatus')

    if (isUnfilteredFileView() && state.fileIndex.length) {
      state.files = [...state.fileIndex]
    } else {
      if (brandId) params.set('brand', brandId)
      if (categoryId) params.set('category', categoryId)
      if (status) params.set('status', status)

      const data = await requestAdmin<FilesResponse>('files', { method: 'GET' }, params)
      state.files = data.files ?? []
    }
  } finally {
    state.filesLoading = false
    renderFileTable()
    renderCatalogInspector()
  }
}

const openFilesWorkspace = async ({ brandId = '', categoryId = '' }: { brandId?: string; categoryId?: string }) => {
  const nextBrandId = categoryId ? getCategoryById(categoryId)?.brandId || brandId : brandId

  setInputValue('filterBrand', nextBrandId)
  syncFilterCategoryOptions()
  setInputValue('filterCategory', categoryId)
  setInputValue('filterStatus', '')
  setFocus({ brandId: nextBrandId, categoryId })
  revealWorkspace('files', { scroll: true })
  await loadFiles()
}

const refreshAllData = async () => {
  await loadBootstrap()
  await loadFileIndex()
  await loadFiles()
  renderDashboardHealth()
}

const submitBrandForm = async (button: HTMLButtonElement | null) => {
  const payload = {
    brandId: getInputValue('brandId'),
    brandLabel: getInputValue('brandLabel'),
  }

  const release = setButtonBusy(button, state.editingBrandId ? 'Updating...' : 'Saving...')
  try {
    const nextState = state.editingBrandId
      ? await requestAdmin<BootstrapResponse>(`brands/${encodeURIComponent(state.editingBrandId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      : await requestAdmin<BootstrapResponse>('brands', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

    applyBootstrap(nextState)
    await loadFileIndex()
    await loadFiles()
    resetBrandForm()
    closeComposer()
    setBanner('Brand saved successfully.', 'success')
  } finally {
    release()
  }
}

const submitCategoryForm = async (button: HTMLButtonElement | null) => {
  const payload = {
    categoryId: getInputValue('categoryId'),
    categoryLabel: getInputValue('categoryLabel'),
    brandId: getInputValue('categoryBrand'),
    parentCategoryId: getInputValue('parentCategory'),
  }

  const release = setButtonBusy(button, state.editingCategoryId ? 'Updating...' : 'Saving...')
  try {
    const nextState = state.editingCategoryId
      ? await requestAdmin<BootstrapResponse>(`categories/${encodeURIComponent(state.editingCategoryId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      : await requestAdmin<BootstrapResponse>('categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

    applyBootstrap(nextState)
    await loadFileIndex()
    await loadFiles()
    resetCategoryForm()
    closeComposer()
    setBanner('Folder saved successfully.', 'success')
  } finally {
    release()
  }
}

const submitFileForm = async (button: HTMLButtonElement | null) => {
  const payload = {
    id: getInputValue('fileId'),
    title: getInputValue('fileTitle'),
    subtitle: getInputValue('fileSubtitle'),
    summary: getInputValue('fileSummary'),
    driveUrl: getInputValue('fileDriveUrl'),
    date: getInputValue('fileDate'),
    size: getInputValue('fileSize'),
    price: getInputValue('filePrice'),
    visits: getInputValue('fileVisits'),
    downloads: getInputValue('fileDownloads'),
    status: getInputValue('fileStatus'),
    brandId: getInputValue('fileBrand'),
    categoryId: getInputValue('fileCategory'),
    featured: getInputValue('fileFeaturedSelect') === 'true',
  }

  const release = setButtonBusy(button, state.editingFileId ? 'Updating...' : 'Saving...')
  try {
    const nextState = state.editingFileId
      ? await requestAdmin<BootstrapResponse>(`files/${encodeURIComponent(state.editingFileId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      : await requestAdmin<BootstrapResponse>('files', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

    applyBootstrap(nextState)
    await loadFileIndex()
    await loadFiles()
    resetFileForm()
    closeComposer()
    setBanner('File saved successfully.', 'success')
  } finally {
    release()
  }
}

const deleteBrand = async (brandId: string) => {
  const brand = getBrandById(brandId)
  if (!brand) return
  const confirmed = await openConfirmDialog(
    'Hapus brand',
    `Hapus brand "${brand.label}"? Ini hanya bisa jalan kalau brand sudah tidak punya folder dan file.`,
    'Hapus Brand',
  )
  if (!confirmed) return

  const nextState = await requestAdmin<BootstrapResponse>(`brands/${encodeURIComponent(brandId)}`, {
    method: 'DELETE',
  })

  applyBootstrap(nextState)
  await loadFileIndex()
  await loadFiles()
  resetBrandForm()
  setBanner(`Brand "${brand.label}" deleted.`, 'success')
}

const deleteCategory = async (categoryId: string) => {
  const category = getCategoryById(categoryId)
  if (!category) return
  const confirmed = await openConfirmDialog(
    'Hapus folder',
    `Hapus folder "${category.fullLabel || category.label}"? Pastikan folder ini sudah tidak punya subfolder dan file.`,
    'Hapus Folder',
  )
  if (!confirmed) return

  const nextState = await requestAdmin<BootstrapResponse>(`categories/${encodeURIComponent(categoryId)}`, {
    method: 'DELETE',
  })

  applyBootstrap(nextState)
  await loadFileIndex()
  await loadFiles()
  resetCategoryForm()
  setBanner(`Folder "${category.label}" deleted.`, 'success')
}

const deleteFile = async (fileId: string) => {
  const file = getKnownFiles().find((item) => item.id === fileId)
  if (!file) return
  const confirmed = await openConfirmDialog('Hapus file', `Hapus file "${file.title}"?`, 'Hapus File')
  if (!confirmed) return

  const nextState = await requestAdmin<BootstrapResponse>(`files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  })

  applyBootstrap(nextState)
  await loadFileIndex()
  await loadFiles()
  resetFileForm()
  setBanner(`File "${file.title}" deleted.`, 'success')
}

const runSearch = async (button: HTMLButtonElement | null) => {
  const query = getInputValue('searchQuery')
  const release = setButtonBusy(button, 'Searching...')

  try {
    const params = new URLSearchParams()
    if (query) {
      params.set('q', query)
    }

    const data = await requestAdmin<SearchResponse>('search', { method: 'GET' }, params)
    state.searchResults = data.results ?? []
    state.searchSummary = query
      ? `${data.total} result(s) for "${query}".`
      : 'Type a query first if you want targeted results.'
    renderSearchResults()
  } finally {
    release()
  }
}

const runIntegrity = async (button: HTMLButtonElement | null) => {
  const release = setButtonBusy(button, 'Scanning...')

  try {
    state.integrity = await requestAdmin<IntegrityResponse>('integrity', { method: 'GET' })
    renderIntegrityResults()

    const tone =
      state.integrity.status === 'critical'
        ? 'error'
        : state.integrity.status === 'warning'
          ? 'warning'
          : 'success'

    setBanner(`Integrity scan finished with status "${state.integrity.status}".`, tone)
  } finally {
    release()
  }
}

const refreshPublicCache = async (button: HTMLButtonElement | null) => {
  const release = setButtonBusy(button, 'Refreshing...')

  try {
    const result = await requestAdmin<{ ok: boolean; cacheVersion: string; updatedAt: string }>('cache-refresh', {
      method: 'POST',
    })

    if (state.bootstrap) {
      state.bootstrap.cacheVersion = result.cacheVersion
      state.bootstrap.lastPublicRefresh = result.updatedAt
    }

    renderStats()
    renderDashboardHealth()
    renderWorkspaceHeader()
    setBanner('Public cache version bumped successfully.', 'success')
  } finally {
    release()
  }
}

const handleConnectionSave = async (button: HTMLButtonElement | null) => {
  state.apiBaseUrl = getInputValue('adminApiBase') || getConfigAdminBaseUrl()
  state.token = getInputValue('adminToken')

  window.localStorage.setItem(API_STORAGE_KEY, state.apiBaseUrl)
  window.localStorage.setItem(TOKEN_STORAGE_KEY, state.token)
  syncConnectionFields()

  const release = setButtonBusy(button, 'Connecting...')
  try {
    await refreshAllData()
    revealWorkspace('catalog')
    setBanner('Admin panel connected to Cloudflare successfully.', 'success')
  } finally {
    release()
  }
}

const restoreButton = (buttonId: string, label: string) => {
  const button = byId<HTMLButtonElement>(buttonId)
  if (!button) return
  button.disabled = false
  button.textContent = label
}

const bindStaticEventsLegacy = () => {
  app.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-composer-mode], button[data-workspace-mode]')
    if (!target) return

    const composerMode = target.dataset.composerMode as ComposerMode | undefined
    if (composerMode) {
      if (target.dataset.composerReset === 'true') {
        if (composerMode === 'brand') resetBrandForm()
        if (composerMode === 'category') resetCategoryForm()
        if (composerMode === 'file') resetFileForm()
      }

      revealComposer(composerMode, { scroll: target.dataset.composerReset === 'true' })
      return
    }

    const workspaceMode = target.dataset.workspaceMode as WorkspaceMode | undefined
    if (workspaceMode) {
      revealWorkspace(workspaceMode)
    }
  })

  byId<HTMLFormElement>('connectionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()

    try {
      await handleConnectionSave(byId<HTMLButtonElement>('saveConnectionButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Connection failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('refreshBootstrapButton')?.addEventListener('click', async () => {
    try {
      const release = setButtonBusy(byId<HTMLButtonElement>('refreshBootstrapButton'), 'Reloading...')
      await refreshAllData()
      setBanner('Data reloaded from D1.', 'success')
      release()
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Reload failed.', 'error')
      restoreButton('refreshBootstrapButton', 'Reload Data')
    }
  })

  byId<HTMLButtonElement>('clearTokenButton')?.addEventListener('click', () => {
    state.token = ''
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    syncConnectionFields()
    setBanner('Stored token cleared from this browser.', 'warning')
  })

  byId<HTMLButtonElement>('fileAutofillButton')?.addEventListener('click', () => {
    autofillFileFieldsFromLink()
  })

  byId<HTMLButtonElement>('closeComposerButton')?.addEventListener('click', () => {
    closeComposer()
  })

  byId<HTMLButtonElement>('adminEditorOverlay')?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-close-editor="true"]')) {
      closeComposer()
    }
  })

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.editorOpen) {
      closeComposer()
      return
    }

    if (event.key === 'Escape' && confirmResolver) {
      closeConfirmDialog(false)
    }
  })

  byId<HTMLButtonElement>('confirmDialogAccept')?.addEventListener('click', () => {
    closeConfirmDialog(true)
  })

  byId<HTMLButtonElement>('confirmDialogCancel')?.addEventListener('click', () => {
    closeConfirmDialog(false)
  })

  byId<HTMLDivElement>('adminConfirmOverlay')?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-close-confirm="true"]')) {
      closeConfirmDialog(false)
    }
  })

  byId<HTMLFormElement>('brandForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await submitBrandForm(byId<HTMLButtonElement>('brandSubmitButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Brand save failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('brandResetButton')?.addEventListener('click', () => {
    resetBrandForm()
  })

  byId<HTMLFormElement>('categoryForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await submitCategoryForm(byId<HTMLButtonElement>('categorySubmitButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Folder save failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('categoryResetButton')?.addEventListener('click', () => {
    resetCategoryForm()
  })

  byId<HTMLSelectElement>('categoryBrand')?.addEventListener('change', () => {
    syncCategoryParentOptions()
  })

  byId<HTMLFormElement>('fileForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await submitFileForm(byId<HTMLButtonElement>('fileSubmitButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'File save failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('fileResetButton')?.addEventListener('click', () => {
    resetFileForm()
  })

  byId<HTMLSelectElement>('fileBrand')?.addEventListener('change', () => {
    syncFileCategoryOptions()
  })

  byId<HTMLDetailsElement>('fileAdvancedDetails')?.addEventListener('toggle', (event) => {
    state.fileAdvancedOpen = (event.currentTarget as HTMLDetailsElement).open
  })

  byId<HTMLButtonElement>('reloadFilesButton')?.addEventListener('click', async () => {
    try {
      const release = setButtonBusy(byId<HTMLButtonElement>('reloadFilesButton'), 'Reloading...')
      await loadFiles()
      setBanner('File list reloaded.', 'success')
      release()
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'File reload failed.', 'error')
      restoreButton('reloadFilesButton', 'Reload Files')
    }
  })

  ;['filterBrand', 'filterCategory', 'filterStatus'].forEach((id) => {
    byId<HTMLSelectElement>(id)?.addEventListener('change', async () => {
      if (id === 'filterBrand') {
        syncFilterCategoryOptions()
      }

      try {
        await loadFiles()
      } catch (error) {
        console.error(error)
        setBanner(error instanceof Error ? error.message : 'Filtering failed.', 'error')
      }
    })
  })

  byId<HTMLFormElement>('searchForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await runSearch(byId<HTMLButtonElement>('searchSubmitButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Search failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('refreshCacheButton')?.addEventListener('click', async () => {
    try {
      await refreshPublicCache(byId<HTMLButtonElement>('refreshCacheButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Cache refresh failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('runIntegrityButton')?.addEventListener('click', async () => {
    try {
      await runIntegrity(byId<HTMLButtonElement>('runIntegrityButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Integrity scan failed.', 'error')
    }
  })

  byId<HTMLDivElement>('brandList')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    const brandId = target.dataset.id || ''

    try {
      if (target.dataset.action === 'edit-brand') {
        const brand = getBrandById(brandId)
        if (brand) {
          populateBrandForm(brand)
        }
      }

      if (target.dataset.action === 'delete-brand') {
        await deleteBrand(brandId)
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Brand action failed.', 'error')
    }
  })

  byId<HTMLDivElement>('categoryList')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    const categoryId = target.dataset.id || ''

    try {
      if (target.dataset.action === 'edit-category') {
        const category = getCategoryById(categoryId)
        if (category) {
          populateCategoryForm(category)
        }
      }

      if (target.dataset.action === 'delete-category') {
        await deleteCategory(categoryId)
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Folder action failed.', 'error')
    }
  })

  byId<HTMLTableSectionElement>('fileTableBody')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    const fileId = target.dataset.id || ''

    try {
      if (target.dataset.action === 'edit-file') {
        const file = getKnownFiles().find((item) => item.id === fileId)
        if (file) {
          populateFileForm(file)
        }
      }

      if (target.dataset.action === 'delete-file') {
        await deleteFile(fileId)
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'File action failed.', 'error')
    }
  })

  byId<HTMLDivElement>('searchResults')?.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    if (target.dataset.action === 'edit-search-file') {
      const fileId = target.dataset.id || ''
      const file = getKnownFiles().find((item) => item.id === fileId)
      if (file) {
        populateFileForm(file)
      }
    }
  })
}

const bindStaticEvents = () => {
  app.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-composer-mode], button[data-workspace-mode]')
    if (!target) return

    const openWorkspace = target.dataset.openWorkspace as WorkspaceMode | undefined
    if (openWorkspace) {
      revealWorkspace(openWorkspace)
    }

    const composerMode = target.dataset.composerMode as ComposerMode | undefined
    if (composerMode) {
      if (target.dataset.composerReset === 'true') {
        if (composerMode === 'brand') resetBrandForm()
        if (composerMode === 'category') resetCategoryForm()
        if (composerMode === 'file') resetFileForm()
      }

      revealComposer(composerMode, { scroll: true })
      return
    }

    const workspaceMode = target.dataset.workspaceMode as WorkspaceMode | undefined
    if (workspaceMode) {
      revealWorkspace(workspaceMode, { scroll: true })
    }
  })

  byId<HTMLFormElement>('connectionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()

    try {
      await handleConnectionSave(byId<HTMLButtonElement>('saveConnectionButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Connection failed.', 'error')
    }
  })

  const reloadEverything = async (buttonId: string, busyLabel: string, idleLabel: string) => {
    try {
      const release = setButtonBusy(byId<HTMLButtonElement>(buttonId), busyLabel)
      await refreshAllData()
      setBanner('Data reloaded from D1.', 'success')
      release()
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Reload failed.', 'error')
      restoreButton(buttonId, idleLabel)
    }
  }

  byId<HTMLButtonElement>('refreshBootstrapButton')?.addEventListener('click', async () => {
    await reloadEverything('refreshBootstrapButton', 'Reloading...', 'Reload')
  })

  byId<HTMLButtonElement>('headerReloadButton')?.addEventListener('click', async () => {
    await reloadEverything('headerReloadButton', 'Reloading...', 'Reload All')
  })

  byId<HTMLButtonElement>('headerCacheButton')?.addEventListener('click', async () => {
    try {
      await refreshPublicCache(byId<HTMLButtonElement>('headerCacheButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Cache refresh failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('headerIntegrityButton')?.addEventListener('click', async () => {
    try {
      await runIntegrity(byId<HTMLButtonElement>('headerIntegrityButton'))
      renderDashboardHealth()
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Integrity scan failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('clearTokenButton')?.addEventListener('click', () => {
    state.token = ''
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    syncConnectionFields()
    setBanner('Stored token cleared from this browser.', 'warning')
  })

  byId<HTMLButtonElement>('fileAutofillButton')?.addEventListener('click', () => {
    autofillFileFieldsFromLink()
  })

  byId<HTMLButtonElement>('closeComposerButton')?.addEventListener('click', () => {
    closeComposer()
  })

  byId<HTMLDivElement>('adminEditorOverlay')?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-close-editor="true"]')) {
      closeComposer()
    }
  })

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.editorOpen) {
      closeComposer()
      return
    }

    if (event.key === 'Escape' && confirmResolver) {
      closeConfirmDialog(false)
    }
  })

  byId<HTMLButtonElement>('confirmDialogAccept')?.addEventListener('click', () => {
    closeConfirmDialog(true)
  })

  byId<HTMLButtonElement>('confirmDialogCancel')?.addEventListener('click', () => {
    closeConfirmDialog(false)
  })

  byId<HTMLDivElement>('adminConfirmOverlay')?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-close-confirm="true"]')) {
      closeConfirmDialog(false)
    }
  })

  byId<HTMLFormElement>('brandForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await submitBrandForm(byId<HTMLButtonElement>('brandSubmitButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Brand save failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('brandResetButton')?.addEventListener('click', () => {
    resetBrandForm()
  })

  byId<HTMLFormElement>('categoryForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await submitCategoryForm(byId<HTMLButtonElement>('categorySubmitButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Folder save failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('categoryResetButton')?.addEventListener('click', () => {
    resetCategoryForm()
  })

  byId<HTMLSelectElement>('categoryBrand')?.addEventListener('change', () => {
    setFocus({ brandId: getInputValue('categoryBrand') })
    syncCategoryParentOptions()
  })

  byId<HTMLFormElement>('fileForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await submitFileForm(byId<HTMLButtonElement>('fileSubmitButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'File save failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('fileResetButton')?.addEventListener('click', () => {
    resetFileForm()
  })

  byId<HTMLSelectElement>('fileBrand')?.addEventListener('change', () => {
    setFocus({ brandId: getInputValue('fileBrand') })
    syncFileCategoryOptions()
  })

  byId<HTMLDetailsElement>('fileAdvancedDetails')?.addEventListener('toggle', (event) => {
    state.fileAdvancedOpen = (event.currentTarget as HTMLDetailsElement).open
  })

  byId<HTMLButtonElement>('reloadFilesButton')?.addEventListener('click', async () => {
    try {
      const release = setButtonBusy(byId<HTMLButtonElement>('reloadFilesButton'), 'Reloading...')
      await loadFiles()
      setBanner('File list reloaded.', 'success')
      release()
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'File reload failed.', 'error')
      restoreButton('reloadFilesButton', 'Reload Files')
    }
  })

  ;['filterBrand', 'filterCategory', 'filterStatus'].forEach((id) => {
    byId<HTMLSelectElement>(id)?.addEventListener('change', async () => {
      if (id === 'filterBrand') {
        syncFilterCategoryOptions()
        setFocus({ brandId: getInputValue('filterBrand') })
      }

      if (id === 'filterCategory') {
        const categoryId = getInputValue('filterCategory')
        if (categoryId) {
          setFocus({ categoryId })
        }
      }

      try {
        await loadFiles()
      } catch (error) {
        console.error(error)
        setBanner(error instanceof Error ? error.message : 'Filtering failed.', 'error')
      }
    })
  })

  byId<HTMLFormElement>('searchForm')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await runSearch(byId<HTMLButtonElement>('searchSubmitButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Search failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('refreshCacheButton')?.addEventListener('click', async () => {
    try {
      await refreshPublicCache(byId<HTMLButtonElement>('refreshCacheButton'))
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Cache refresh failed.', 'error')
    }
  })

  byId<HTMLButtonElement>('runIntegrityButton')?.addEventListener('click', async () => {
    try {
      await runIntegrity(byId<HTMLButtonElement>('runIntegrityButton'))
      renderDashboardHealth()
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Integrity scan failed.', 'error')
    }
  })

  byId<HTMLDivElement>('dashboardBrands')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    try {
      if (target.dataset.action === 'open-brand-catalog') {
        const brandId = target.dataset.id || ''
        setFocus({ brandId })
        revealWorkspace('catalog', { scroll: true })
        return
      }

      if (target.dataset.action === 'brand-files') {
        await openFilesWorkspace({ brandId: target.dataset.id || '' })
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Dashboard action failed.', 'error')
    }
  })

  byId<HTMLDivElement>('dashboardRecentFiles')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    try {
      if (target.dataset.action === 'edit-dashboard-file') {
        const file = getKnownFiles().find((item) => item.id === (target.dataset.id || ''))
        if (file) {
          populateFileForm(file)
        }
      }

      if (target.dataset.action === 'category-files') {
        await openFilesWorkspace({ categoryId: target.dataset.id || '' })
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Recent file action failed.', 'error')
    }
  })

  byId<HTMLDivElement>('catalogExplorer')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    const action = target.dataset.action || ''
    const id = target.dataset.id || ''

    try {
      if (action === 'focus-brand') {
        setFocus({ brandId: id })
      } else if (action === 'edit-brand') {
        const brand = getBrandById(id)
        if (brand) populateBrandForm(brand)
      } else if (action === 'delete-brand') {
        await deleteBrand(id)
      } else if (action === 'brand-files') {
        await openFilesWorkspace({ brandId: id })
      } else if (action === 'new-category-in-brand') {
        prepareNewCategoryForm(id, '')
      } else if (action === 'new-file-in-brand') {
        prepareNewFileForm(id, '')
      } else if (action === 'focus-category') {
        setFocus({ categoryId: id })
      } else if (action === 'edit-category') {
        const category = getCategoryById(id)
        if (category) populateCategoryForm(category)
      } else if (action === 'delete-category') {
        await deleteCategory(id)
      } else if (action === 'category-files') {
        await openFilesWorkspace({ categoryId: id })
      } else if (action === 'new-subcategory') {
        const category = getCategoryById(id)
        if (category) prepareNewCategoryForm(category.brandId, category.id)
      } else if (action === 'new-file-in-category') {
        const category = getCategoryById(id)
        if (category) prepareNewFileForm(category.brandId, category.id)
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Catalog action failed.', 'error')
    }
  })

  byId<HTMLDivElement>('catalogQuickActions')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    const action = target.dataset.action || ''
    const activeBrand = getActiveBrand()
    const activeCategory = state.focusCategoryId ? getCategoryById(state.focusCategoryId) : null

    try {
      if (action === 'inspect-edit-brand' && activeBrand) {
        populateBrandForm(activeBrand)
      } else if (action === 'inspect-new-category' && activeBrand) {
        prepareNewCategoryForm(activeBrand.id, '')
      } else if (action === 'inspect-new-file-in-brand' && activeBrand) {
        prepareNewFileForm(activeBrand.id, '')
      } else if (action === 'inspect-edit-category' && activeCategory) {
        populateCategoryForm(activeCategory)
      } else if (action === 'inspect-new-subcategory' && activeCategory) {
        prepareNewCategoryForm(activeCategory.brandId, activeCategory.id)
      } else if (action === 'inspect-new-file' && activeCategory) {
        prepareNewFileForm(activeCategory.brandId, activeCategory.id)
      } else if (action === 'inspect-delete-category' && activeCategory) {
        await deleteCategory(activeCategory.id)
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Inspector action failed.', 'error')
    }
  })

  byId<HTMLTableSectionElement>('catalogFileTableBody')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    const fileId = target.dataset.id || ''

    try {
      if (target.dataset.action === 'inspect-edit-file') {
        const file = getKnownFiles().find((item) => item.id === fileId)
        if (file) {
          populateFileForm(file)
        }
      }

      if (target.dataset.action === 'inspect-delete-file') {
        await deleteFile(fileId)
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Catalog file action failed.', 'error')
    }
  })

  byId<HTMLTableSectionElement>('fileTableBody')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    const fileId = target.dataset.id || ''

    try {
      if (target.dataset.action === 'edit-file') {
        const file = getKnownFiles().find((item) => item.id === fileId)
        if (file) {
          populateFileForm(file)
        }
      }

      if (target.dataset.action === 'delete-file') {
        await deleteFile(fileId)
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'File action failed.', 'error')
    }
  })

  byId<HTMLDivElement>('searchResults')?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!target) return

    try {
      if (target.dataset.action === 'edit-search-file') {
        const fileId = target.dataset.id || ''
        const file = getKnownFiles().find((item) => item.id === fileId)
        if (file) {
          populateFileForm(file)
        }
      }

      if (target.dataset.action === 'search-open-folder') {
        await openFilesWorkspace({ categoryId: target.dataset.id || '' })
      }
    } catch (error) {
      console.error(error)
      setBanner(error instanceof Error ? error.message : 'Search action failed.', 'error')
    }
  })
}

void [
  renderShellLegacy,
  renderBrandList,
  renderCategoryList,
  renderFileTableLegacy,
  renderSearchResultsLegacy,
  renderIntegrityResultsLegacy,
  bindStaticEventsLegacy,
]

const bootstrapAdmin = async () => {
  state.apiBaseUrl = window.localStorage.getItem(API_STORAGE_KEY) || getConfigAdminBaseUrl()
  state.token = window.localStorage.getItem(TOKEN_STORAGE_KEY) || ''

  renderShell()
  syncViewModes()
  renderBanner()
  renderStats()
  renderDashboardBrands()
  renderDashboardRecentFiles()
  renderDashboardHealth()
  renderCatalogExplorer()
  renderCatalogInspector()
  renderFileTable()
  renderSearchResults()
  renderIntegrityResults()
  syncConnectionFields()
  syncBrandOptions()
  resetBrandForm()
  resetCategoryForm()
  resetFileForm()
  bindStaticEvents()
  syncViewModes()

  if (!state.token) {
    setBanner('Admin token belum diisi. Paste token lalu klik Connect.', 'warning')
    revealWorkspace('catalog')
    return
  }

  try {
    await refreshAllData()
    setBanner('Admin panel ready. Data is now coming from Cloudflare D1.', 'success')
  } catch (error) {
    console.error(error)
    setBanner(error instanceof Error ? error.message : 'Admin bootstrap failed.', 'error')
  }
}

void bootstrapAdmin()
