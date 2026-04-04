import { solutionCategories, solutionFilesByCategory } from './download-data'
import type { BrandId, DownloadListFile, SolutionCategory, TickerItem } from './data-types'

declare global {
  interface Window {
    AOSUNLOCKER_CONFIG?: {
      appsScriptUrl?: string
    }
  }
}

type PublicCategoryRecord = {
  id?: string
  label?: string
  brandId?: BrandId
  brandLabel?: string
}

type PublicFileRecord = DownloadListFile & {
  brandId?: BrandId
  brandLabel?: string
  categoryId?: string
  categoryLabel?: string
  date?: string
  visits?: string
  downloads?: string
  price?: string
  driveUrl?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

type PublicCategoriesResponse = {
  ok?: boolean
  categories?: PublicCategoryRecord[]
}

type PublicBrandsResponse = {
  ok?: boolean
  brands?: Array<{ id?: string; label?: string }>
}

type PublicFilesResponse = {
  ok?: boolean
  files?: PublicFileRecord[]
}

type PublicFileResponse = {
  ok?: boolean
  file?: PublicFileRecord | null
}

type IncrementResponse = {
  ok?: boolean
  downloads?: string
}

const brandLabelMap: Record<BrandId, string> = {
  huawei: 'Huawei',
  honor: 'Honor',
}

const LIVE_CACHE_PREFIX = 'aosunlocker-live-cache:'
const LIVE_CACHE_TTL = 1000 * 60 * 15
const LIVE_FETCH_TIMEOUT = 3200

const getAppsScriptUrl = () => window.AOSUNLOCKER_CONFIG?.appsScriptUrl?.trim() ?? ''

const formatDateValue = (value: string) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (/^\d{2}-\d{2}-\d{4}$/.test(raw) || /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw

  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = parsed.getFullYear()
  return `${day}-${month}-${year}`
}

const buildApiUrl = (view: string, params?: Record<string, string>) => {
  const baseUrl = getAppsScriptUrl()
  if (!baseUrl) return ''

  const url = new URL(baseUrl)
  url.searchParams.set('api', '1')
  url.searchParams.set('view', view)

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

const toDisplayLabel = (value: string) =>
  String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()

const readCache = <T>(key: string) => {
  const storageKey = `${LIVE_CACHE_PREFIX}${key}`
  const stores = [window.sessionStorage, window.localStorage]

  for (const store of stores) {
    try {
      const raw = store.getItem(storageKey)
      if (!raw) continue

      const parsed = JSON.parse(raw) as { timestamp?: number; value?: T }
      if (!parsed?.timestamp || Date.now() - parsed.timestamp > LIVE_CACHE_TTL) {
        store.removeItem(storageKey)
        continue
      }

      return parsed.value ?? null
    } catch {
      // ignore storage failures
    }
  }

  return null
}

const writeCache = <T>(key: string, value: T) => {
  const storageKey = `${LIVE_CACHE_PREFIX}${key}`
  try {
    const payload = JSON.stringify({
      timestamp: Date.now(),
      value,
    })

    window.sessionStorage.setItem(storageKey, payload)
    window.localStorage.setItem(storageKey, payload)
  } catch {
    // ignore storage failures
  }
}

const fetchJsonCached = async <T>(cacheKey: string, url: string) => {
  const cached = readCache<T>(cacheKey)
  if (cached) return cached

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT)
  const response = await fetch(url, {
    signal: controller.signal,
    cache: 'force-cache',
  }).finally(() => {
    window.clearTimeout(timeout)
  })
  if (!response.ok) throw new Error('Request failed.')

  const data = (await response.json()) as T
  writeCache(cacheKey, data)
  return data
}

const buildFallbackCategory = (categoryId: string, brandId: BrandId): SolutionCategory => ({
  id: String(categoryId || '').trim() || 'solution-folder',
  brandId,
  brandLabel: brandLabelMap[brandId] || toDisplayLabel(brandId),
  title: toDisplayLabel(categoryId || 'solution-folder'),
  description: `${brandLabelMap[brandId] || toDisplayLabel(brandId)} solution folder.`,
})

const normalizeCategory = (category: PublicCategoryRecord, brandId: BrandId): SolutionCategory => ({
  id: String(category.id || ''),
  brandId: category.brandId || brandId,
  brandLabel: String(category.brandLabel || brandLabelMap[brandId]),
  title: String(category.label || ''),
  description: `${String(category.brandLabel || brandLabelMap[brandId])} solution folder.`,
})

const normalizeFile = (file: PublicFileRecord): DownloadListFile => ({
  id: String(file.id || ''),
  brandId: (file.brandId as BrandId | undefined) || undefined,
  title: String(file.title || ''),
  subtitle: String(file.subtitle || file.title || ''),
  summary: String(file.summary || file.subtitle || file.title || ''),
  date: formatDateValue(String(file.date || file.createdAt || file.updatedAt || '')),
  size: String(file.size || '-'),
  visits: String(file.visits || '0'),
  downloads: String(file.downloads || '0'),
  price: String(file.price || ''),
  featured: Boolean(file.featured),
})

const parseSortDate = (file: PublicFileRecord) => {
  const raw = String(file.createdAt || file.updatedAt || file.date || '').trim()
  if (!raw) return 0

  const ddmmyyyy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (ddmmyyyy) {
    return new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1])).getTime()
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const toTickerTitle = (file: PublicFileRecord) => String(file.title || '').trim()

const toTickerBrandMeta = (file: PublicFileRecord) =>
  String(file.brandLabel || file.brandId || file.categoryLabel || '').trim()

const toTickerDownloadMeta = (file: PublicFileRecord) => {
  const count = Number(String(file.downloads || '0').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(count) || count <= 0) return 'Recently published'
  return `${count.toLocaleString('en-US')} downloads`
}

export const hasLiveApi = () => Boolean(getAppsScriptUrl())

export const peekBrandFolders = () => {
  const cached = readCache<PublicBrandsResponse>('brands')
  if (!cached) return null

  const brands = (cached.brands ?? [])
    .filter((item) => item.id)
    .map((item) => {
      const brandId = String(item.id || '').trim()
      const title = String(item.label || toDisplayLabel(brandId))
      return {
        title,
        description: `Open ${title} solution folders, service categories, and download files.`,
        href: `/solution-files.html?brand=${brandId}`,
        kind: 'brand' as const,
        brandId,
      }
    })

  return {
    source: 'cache' as const,
    brands,
  }
}

export const peekCategoriesByBrand = (brandId: BrandId) => {
  const cached = readCache<PublicCategoriesResponse>(`categories:${brandId}`)
  if (!cached) return null

  return {
    source: 'cache' as const,
    categories: (cached.categories ?? []).map((item) => normalizeCategory(item, brandId)),
  }
}

export const peekFilesByCategory = (categoryId: string, brandId?: BrandId) => {
  const fallbackCategory = solutionCategories.find((item) => item.id === categoryId) ?? buildFallbackCategory(categoryId, brandId ?? 'huawei')
  const requestBrandId = brandId ?? fallbackCategory.brandId
  const cached = readCache<PublicFilesResponse>(`files:${requestBrandId}:${categoryId}`)
  if (!cached) return null

  const liveFiles = (cached.files ?? []).map(normalizeFile)
  const category =
    liveFiles[0]
      ? {
          id: categoryId,
          brandId: (liveFiles[0].brandId as BrandId | undefined) || requestBrandId,
          brandLabel: String((cached.files?.[0] as PublicFileRecord | undefined)?.brandLabel || brandLabelMap[requestBrandId] || toDisplayLabel(requestBrandId)),
          title: String((cached.files?.[0] as PublicFileRecord | undefined)?.categoryLabel || fallbackCategory.title),
          description: `${String((cached.files?.[0] as PublicFileRecord | undefined)?.brandLabel || brandLabelMap[requestBrandId] || toDisplayLabel(requestBrandId))} solution folder.`,
        }
      : fallbackCategory

  return {
    source: 'cache' as const,
    category,
    files: liveFiles,
  }
}

export const loadCategoriesByBrand = async (brandId: BrandId) => {
  const url = buildApiUrl('categories', { brand: brandId })
  const cacheKey = `categories:${brandId}`

  if (!url) {
    return {
      source: 'unconfigured' as const,
      categories: [],
    }
  }

  try {
    const data = await fetchJsonCached<PublicCategoriesResponse>(cacheKey, url)
    const liveCategories = (data.categories ?? []).map((item) => normalizeCategory(item, brandId))

    return {
      source: 'live' as const,
      categories: liveCategories,
    }
  } catch (error) {
    console.warn('Categories could not be loaded.', error)
    return {
      source: 'live-error' as const,
      categories: [],
    }
  }
}

export const loadBrandFolders = async () => {
  const url = buildApiUrl('brands')
  const cacheKey = 'brands'

  if (!url) {
    return {
      source: 'unconfigured' as const,
      brands: [],
    }
  }

  try {
    const data = await fetchJsonCached<PublicBrandsResponse>(cacheKey, url)
    const liveBrands = (data.brands ?? [])
      .filter((item) => item.id)
      .map((item) => {
        const brandId = String(item.id || '').trim()
        const title = String(item.label || toDisplayLabel(brandId))
        return {
          title,
          description: `Open ${title} solution folders, service categories, and download files.`,
          href: `/solution-files.html?brand=${brandId}`,
          kind: 'brand' as const,
          brandId,
        }
      })

    return {
      source: 'live' as const,
      brands: liveBrands,
    }
  } catch (error) {
    console.warn('Brands could not be loaded.', error)
    return {
      source: 'live-error' as const,
      brands: [],
    }
  }
}

export const loadHomepageTickers = async (): Promise<{ latest: TickerItem[]; top: TickerItem[] }> => {
  const url = buildApiUrl('files')
  if (!url) {
    return { latest: [], top: [] }
  }

  try {
    const data = await fetchJsonCached<PublicFilesResponse>('homepage-tickers', url)
    const files = (data.files ?? []).filter((item) => toTickerTitle(item))

    const latest = [...files]
      .sort((a, b) => parseSortDate(b) - parseSortDate(a))
      .slice(0, 6)
      .map((item) => ({
        title: toTickerTitle(item),
        meta: toTickerBrandMeta(item) || 'Published file',
        icon: 'fa-file-archive',
      }))

    const top = [...files]
      .sort((a, b) => Number(String(b.downloads || '0').replace(/[^\d.-]/g, '')) - Number(String(a.downloads || '0').replace(/[^\d.-]/g, '')))
      .slice(0, 6)
      .map((item) => ({
        title: toTickerTitle(item),
        meta: toTickerDownloadMeta(item),
        icon: 'fa-fire',
      }))

    return { latest, top }
  } catch (error) {
    console.warn('Homepage tickers could not be loaded.', error)
    return { latest: [], top: [] }
  }
}

export const loadFilesByCategory = async (categoryId: string, brandId?: BrandId) => {
  const fallbackCategory = solutionCategories.find((item) => item.id === categoryId) ?? buildFallbackCategory(categoryId, brandId ?? 'huawei')
  const requestBrandId = brandId ?? fallbackCategory.brandId
  const url = buildApiUrl('files', { brand: requestBrandId, category: categoryId })
  const cacheKey = `files:${requestBrandId}:${categoryId}`

  if (!url) {
    return {
      source: 'unconfigured' as const,
      category: fallbackCategory,
      files: [],
    }
  }

  try {
    const data = await fetchJsonCached<PublicFilesResponse>(cacheKey, url)
    const liveFiles = (data.files ?? []).map(normalizeFile)
    const liveCategory =
      liveFiles[0]
        ? {
            id: categoryId,
            brandId: (liveFiles[0].brandId as BrandId | undefined) || requestBrandId,
            brandLabel: String((data.files?.[0] as PublicFileRecord | undefined)?.brandLabel || brandLabelMap[requestBrandId] || toDisplayLabel(requestBrandId)),
            title: String((data.files?.[0] as PublicFileRecord | undefined)?.categoryLabel || fallbackCategory.title),
            description: `${String((data.files?.[0] as PublicFileRecord | undefined)?.brandLabel || brandLabelMap[requestBrandId] || toDisplayLabel(requestBrandId))} solution folder.`,
          }
        : fallbackCategory

    return {
      source: 'live' as const,
      category: liveCategory,
      files: liveFiles,
    }
  } catch (error) {
    console.warn('Category files could not be loaded.', error)
    return {
      source: 'live-error' as const,
      category: fallbackCategory,
      files: [],
    }
  }
}

export const loadFileById = async (fileId: string) => {
  const fallbackCategory =
    solutionCategories.find((category) => (solutionFilesByCategory[category.id] ?? []).some((item) => item.id === fileId)) ??
    solutionCategories[0]

  const url = buildApiUrl('file', { id: fileId })
  if (!url) {
    return {
      source: 'unconfigured' as const,
      file: null,
      category: fallbackCategory,
      driveUrl: '',
      price: '',
      status: '',
    }
  }

  try {
    const data = await fetchJsonCached<PublicFileResponse>(`file:${fileId}`, url)
    const file = data.file

    if (!file) {
      return {
        source: 'live' as const,
        file: null,
        category: fallbackCategory,
        driveUrl: '',
        price: '',
        status: '',
      }
    }

    return {
      source: 'live' as const,
      file: normalizeFile(file),
      category:
        solutionCategories.find((category) => category.id === file.categoryId) ??
        buildFallbackCategory(String(file.categoryId || fallbackCategory.id), ((file.brandId as BrandId | undefined) || fallbackCategory.brandId)),
      driveUrl: String(file.driveUrl || ''),
      price: String(file.price || ''),
      status: String(file.status || ''),
    }
  } catch (error) {
    console.warn('File detail could not be loaded.', error)
    return {
      source: 'live-error' as const,
      file: null,
      category: fallbackCategory,
      driveUrl: '',
      price: '',
      status: '',
    }
  }
}

export const incrementDownloadCount = async (fileId: string) => {
  const url = buildApiUrl('increment', { id: fileId })
  if (!url) return null

  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to increment download count.')

    const data = (await response.json()) as IncrementResponse
    return data.ok ? String(data.downloads || '') : null
  } catch (error) {
    console.warn('Download count could not be incremented.', error)
    return null
  }
}

export const warmRouteDataFromHref = (href: string) => {
  try {
    const url = new URL(href, window.location.origin)
    const path = url.pathname.toLowerCase()

    if (path.endsWith('/downloads.html') || path.endsWith('downloads.html')) {
      void loadBrandFolders()
      return
    }

    if (path.endsWith('/solution-files.html') || path.endsWith('solution-files.html')) {
      const brand = (url.searchParams.get('brand') || 'huawei') as BrandId
      const category = url.searchParams.get('category')

      if (category) {
        void loadFilesByCategory(category, brand)
      } else {
        void loadCategoriesByBrand(brand)
      }
      return
    }

    if (path.endsWith('/download.html') || path.endsWith('download.html')) {
      const fileId = url.searchParams.get('file')
      if (fileId) {
        void loadFileById(fileId)
      }
    }
  } catch {
    // ignore invalid hrefs
  }
}
