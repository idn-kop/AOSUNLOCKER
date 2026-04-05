import { anaAn00Files, downloadHomeCategories, huaweiUpdateFolders, solutionCategories, solutionFilesByCategory } from './download-data'
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

type PublicStatusResponse = {
  ok?: boolean
  cacheVersion?: string
}

type IncrementResponse = {
  ok?: boolean
  downloads?: string
}

export type SearchCatalogEntry = {
  title: string
  meta: string
  href: string
  keywords: string
  icon: string
}

const brandLabelMap: Record<BrandId, string> = {
  huawei: 'Huawei',
  honor: 'Honor',
  'aos-firmware': 'AOS Firmware',
}

const LIVE_CACHE_PREFIX = 'aosunlocker-live-cache:'
const LIVE_CACHE_TTL = 1000 * 60 * 15
const LIVE_FETCH_TIMEOUT = 1000 * 10
const LIVE_VERSION_STORAGE_KEY = 'aosunlocker-live-cache-version'
const inFlightRequests = new Map<string, Promise<unknown>>()

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

const readCache = <T>(key: string, options: { allowExpired?: boolean } = {}) => {
  const storageKey = `${LIVE_CACHE_PREFIX}${key}`
  const stores = [window.sessionStorage, window.localStorage]
  const { allowExpired = false } = options

  for (const store of stores) {
    try {
      const raw = store.getItem(storageKey)
      if (!raw) continue

      const parsed = JSON.parse(raw) as { timestamp?: number; value?: T }
      if (!parsed?.timestamp) {
        store.removeItem(storageKey)
        continue
      }

      const isExpired = Date.now() - parsed.timestamp > LIVE_CACHE_TTL
      if (isExpired && !allowExpired) {
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

const readVersionMarker = () => {
  const stores = [window.sessionStorage, window.localStorage]

  for (const store of stores) {
    try {
      const raw = store.getItem(LIVE_VERSION_STORAGE_KEY)
      if (raw) return raw
    } catch {
      // ignore storage failures
    }
  }

  return ''
}

const writeVersionMarker = (value: string) => {
  const nextValue = String(value || '').trim()
  if (!nextValue) return

  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      store.setItem(LIVE_VERSION_STORAGE_KEY, nextValue)
    } catch {
      // ignore storage failures
    }
  }
}

const clearLiveCache = () => {
  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      const keys: string[] = []

      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index)
        if (key?.startsWith(LIVE_CACHE_PREFIX)) {
          keys.push(key)
        }
      }

      keys.forEach((key) => store.removeItem(key))
    } catch {
      // ignore storage failures
    }
  }
}

const loadPublicCacheVersion = async () => {
  const url = buildApiUrl('status')
  if (!url) return ''

  const inFlightKey = `status:${url}`
  const existingRequest = inFlightRequests.get(inFlightKey) as Promise<string> | undefined
  if (existingRequest) return existingRequest

  const request = (async () => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Status request failed.')

      const data = (await response.json()) as PublicStatusResponse
      return String(data.cacheVersion || '').trim()
    } catch {
      return ''
    } finally {
      window.clearTimeout(timeout)
      inFlightRequests.delete(inFlightKey)
    }
  })()

  inFlightRequests.set(inFlightKey, request)
  return request
}

export const syncLiveCacheVersion = async () => {
  const nextVersion = await loadPublicCacheVersion()
  if (!nextVersion) return false

  const currentVersion = readVersionMarker()
  if (currentVersion && currentVersion !== nextVersion) {
    clearLiveCache()
  }

  writeVersionMarker(nextVersion)
  return currentVersion !== nextVersion
}

const fetchJsonCached = async <T>(
  cacheKey: string,
  url: string,
  options: { preferFresh?: boolean } = {},
) => {
  const { preferFresh = false } = options
  const cached = preferFresh ? null : readCache<T>(cacheKey)
  if (cached) return cached

  const inFlightKey = `${cacheKey}:${url}`
  const existingRequest = inFlightRequests.get(inFlightKey) as Promise<T> | undefined
  if (existingRequest) return existingRequest

  const request = (async () => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Request failed.')

      const data = (await response.json()) as T
      writeCache(cacheKey, data)
      return data
    } catch (error) {
      const stale = readCache<T>(cacheKey, { allowExpired: true })
      if (stale) return stale
      throw error
    } finally {
      window.clearTimeout(timeout)
      inFlightRequests.delete(inFlightKey)
    }
  })()

  inFlightRequests.set(inFlightKey, request)
  return request
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

const getLocalCategoriesByBrand = (brandId: BrandId) => solutionCategories.filter((item) => item.brandId === brandId)

const getLocalFilesByCategory = (categoryId: string) => solutionFilesByCategory[categoryId] ?? []

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

const dedupeBrands = (brands: Array<{ id?: string; label?: string }>) => {
  const seen = new Set<string>()

  return brands.filter((item) => {
    const key = String(item.id || '').trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const dedupeCategories = (categories: PublicCategoryRecord[]) => {
  const seen = new Set<string>()

  return categories.filter((item) => {
    const brandKey = String(item.brandId || '').trim().toLowerCase()
    const labelKey = String(item.label || item.id || '').trim().toLowerCase()
    const key = `${brandKey}:${labelKey}`

    if (!labelKey || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const dedupeFiles = (files: PublicFileRecord[]) => {
  const uniqueFiles = new Map<string, PublicFileRecord>()

  files.forEach((file) => {
    const key = String(file.id || '').trim()
    if (!key) return

    const existing = uniqueFiles.get(key)
    if (!existing || parseSortDate(file) >= parseSortDate(existing)) {
      uniqueFiles.set(key, file)
    }
  })

  return Array.from(uniqueFiles.values())
}

const dedupeDownloadFiles = (files: DownloadListFile[]) => {
  const uniqueFiles = new Map<string, DownloadListFile>()

  files.forEach((file) => {
    const key = String(file.id || '').trim()
    if (!key || uniqueFiles.has(key)) return
    uniqueFiles.set(key, file)
  })

  return Array.from(uniqueFiles.values())
}

const toBrandSearchLabel = (brandId?: string) => {
  const normalized = String(brandId || '').trim()
  if (!normalized) return 'Catalog'
  return brandLabelMap[normalized as BrandId] || toDisplayLabel(normalized)
}

const buildSearchMeta = (parts: Array<string | undefined>) =>
  parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' • ')

const localSearchCatalog = (() => {
  const entries: SearchCatalogEntry[] = []

  downloadHomeCategories.forEach((item) => {
    entries.push({
      title: item.title,
      meta: 'Brand folder',
      href: item.href,
      keywords: `${item.title} ${item.description} ${item.brandId || ''}`.trim(),
      icon: 'fa-folder-tree',
    })
  })

  solutionCategories.forEach((category) => {
    entries.push({
      title: category.title,
      meta: buildSearchMeta([category.brandLabel, 'Solution folder']),
      href: `/solution-files.html?brand=${category.brandId}&category=${category.id}`,
      keywords: `${category.title} ${category.description} ${category.brandLabel} ${category.brandId}`.trim(),
      icon: 'fa-folder-open',
    })
  })

  huaweiUpdateFolders.forEach((model) => {
    entries.push({
      title: model.title,
      meta: buildSearchMeta(['Model folder', 'Huawei']),
      href: model.href,
      keywords: `${model.title} ${model.subtitle} huawei model folder firmware`.trim(),
      icon: 'fa-mobile-screen',
    })
  })

  dedupeDownloadFiles([...Object.values(solutionFilesByCategory).flat(), ...anaAn00Files]).forEach((file) => {
    const brandLabel = toBrandSearchLabel(file.brandId)
    entries.push({
      title: file.title,
      meta: buildSearchMeta([brandLabel, file.size ? `Size ${file.size}` : '', file.downloads ? `${file.downloads} downloads` : 'File']),
      href: `/download.html?file=${encodeURIComponent(file.id)}`,
      keywords: `${file.title} ${file.subtitle} ${file.summary} ${brandLabel} ${file.brandId || ''}`.trim(),
      icon: 'fa-file-archive',
    })
  })

  const uniqueEntries = new Map<string, SearchCatalogEntry>()
  entries.forEach((entry) => {
    const key = entry.href || `${entry.title}:${entry.meta}`
    if (!key || uniqueEntries.has(key)) return
    uniqueEntries.set(key, entry)
  })

  return Array.from(uniqueEntries.values())
})()

const toTickerTitle = (file: PublicFileRecord) => String(file.title || '').trim()

const toTickerBrandMeta = (file: PublicFileRecord) =>
  String(file.brandLabel || file.brandId || file.categoryLabel || '').trim()

const toTickerDownloadMeta = (file: PublicFileRecord) => {
  const count = Number(String(file.downloads || '0').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(count) || count <= 0) return 'Recently published'
  return `${count.toLocaleString('en-US')} downloads`
}

export const hasLiveApi = () => Boolean(getAppsScriptUrl())

const getLocalBrandFolders = () =>
  downloadHomeCategories
    .filter((item) => item.kind === 'brand' && item.brandId)
    .map((item) => ({
      title: item.title,
      description: item.description,
      href: item.href,
      kind: 'brand' as const,
      brandId: item.brandId as BrandId,
    }))

const getLocalFileById = (fileId: string) => {
  for (const category of solutionCategories) {
    const file = (solutionFilesByCategory[category.id] ?? []).find((item) => item.id === fileId)
    if (file) {
      return {
        file,
        category,
      }
    }
  }

  return null
}

export const peekBrandFolders = () => {
  const cached = readCache<PublicBrandsResponse>('brands')
  if (!cached) {
    return {
      source: 'local-cache-miss' as const,
      brands: getLocalBrandFolders(),
    }
  }

  const brands = dedupeBrands(cached.brands ?? [])
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
  if (!cached) {
    const localCategories = getLocalCategoriesByBrand(brandId)
    return localCategories.length
      ? {
          source: 'local-cache-miss' as const,
          categories: localCategories,
        }
      : null
  }

  const categories = dedupeCategories(cached.categories ?? []).map((item) => normalizeCategory(item, brandId))

  return {
    source: 'cache' as const,
    categories,
  }
}

export const peekFilesByCategory = (categoryId: string, brandId?: BrandId) => {
  const fallbackCategory = solutionCategories.find((item) => item.id === categoryId) ?? buildFallbackCategory(categoryId, brandId ?? 'huawei')
  const requestBrandId = brandId ?? fallbackCategory.brandId
  const cached = readCache<PublicFilesResponse>(`files:${requestBrandId}:${categoryId}`)
  if (!cached) {
    const localFiles = getLocalFilesByCategory(categoryId)
    return localFiles.length
      ? {
          source: 'local-cache-miss' as const,
          category: fallbackCategory,
          files: localFiles,
        }
      : null
  }

  const liveFileRecords = dedupeFiles(cached.files ?? [])
  const liveFiles = liveFileRecords.map(normalizeFile)
  const category =
    liveFiles[0]
      ? {
          id: categoryId,
          brandId: (liveFiles[0].brandId as BrandId | undefined) || requestBrandId,
          brandLabel: String((liveFileRecords[0] as PublicFileRecord | undefined)?.brandLabel || brandLabelMap[requestBrandId] || toDisplayLabel(requestBrandId)),
          title: String((liveFileRecords[0] as PublicFileRecord | undefined)?.categoryLabel || fallbackCategory.title),
          description: `${String((liveFileRecords[0] as PublicFileRecord | undefined)?.brandLabel || brandLabelMap[requestBrandId] || toDisplayLabel(requestBrandId))} solution folder.`,
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
    const data = await fetchJsonCached<PublicCategoriesResponse>(cacheKey, url, {
      preferFresh: true,
    })
    const liveCategories = dedupeCategories(data.categories ?? []).map((item) => normalizeCategory(item, brandId))

    return {
      source: 'live' as const,
      categories: liveCategories,
    }
  } catch (error) {
    console.warn('Categories could not be loaded.', error)
    const localCategories = getLocalCategoriesByBrand(brandId)
    return {
      source: 'live-error' as const,
      categories: localCategories,
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
    const data = await fetchJsonCached<PublicBrandsResponse>(cacheKey, url, {
      preferFresh: true,
    })
    const liveBrands = dedupeBrands(data.brands ?? [])
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
      brands: getLocalBrandFolders(),
    }
  }
}

export const warmBrandCategoryData = (brandIds: BrandId[]) => {
  const uniqueBrandIds = Array.from(
    new Set(
      brandIds
        .map((brandId) => String(brandId || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 6) as BrandId[]

  uniqueBrandIds.forEach((brandId, index) => {
    window.setTimeout(() => {
      void loadCategoriesByBrand(brandId)
    }, 60 + index * 110)
  })
}

export const loadHomepageTickers = async (): Promise<{ latest: TickerItem[]; top: TickerItem[] }> => {
  const url = buildApiUrl('files')
  if (!url) {
    return { latest: [], top: [] }
  }

  try {
    const data = await fetchJsonCached<PublicFilesResponse>('homepage-tickers', url, {
      preferFresh: true,
    })
    return buildHomepageTickerPayload(data.files ?? [])
  } catch (error) {
    console.warn('Homepage tickers could not be loaded.', error)
    return { latest: [], top: [] }
  }
}

const buildHomepageTickerPayload = (files: PublicFileRecord[]): { latest: TickerItem[]; top: TickerItem[] } => {
  const normalizedFiles = dedupeFiles(files).filter((item) => toTickerTitle(item))

  const latest = [...normalizedFiles]
    .sort((a, b) => parseSortDate(b) - parseSortDate(a))
    .slice(0, 6)
    .map((item) => ({
      title: toTickerTitle(item),
      meta: toTickerBrandMeta(item) || 'Published file',
      icon: 'fa-file-archive',
    }))

  const top = [...normalizedFiles]
    .sort((a, b) => Number(String(b.downloads || '0').replace(/[^\d.-]/g, '')) - Number(String(a.downloads || '0').replace(/[^\d.-]/g, '')))
    .slice(0, 6)
    .map((item) => ({
      title: toTickerTitle(item),
      meta: toTickerDownloadMeta(item),
      icon: 'fa-fire',
    }))

  return { latest, top }
}

export const peekHomepageTickers = () => {
  const cached = readCache<PublicFilesResponse>('homepage-tickers')
  if (!cached?.files?.length) return null
  return buildHomepageTickerPayload(cached.files)
}

export const loadGlobalSearchCatalog = async (): Promise<SearchCatalogEntry[]> => {
  const url = buildApiUrl('files')
  if (!url) {
    return localSearchCatalog
  }

  try {
    const data = await fetchJsonCached<PublicFilesResponse>('homepage-tickers', url, {
      preferFresh: true,
    })
    const liveEntries = dedupeFiles(data.files ?? [])
      .filter((file) => {
        const fileId = String(file.id || '').trim()
        const displayTitle = String(file.title || file.subtitle || fileId).trim()
        return Boolean(fileId && displayTitle)
      })
      .map((file) => {
        const fileId = String(file.id || '').trim()
        const displayTitle = String(file.title || file.subtitle || fileId).trim()
        const brandLabel = String(file.brandLabel || toBrandSearchLabel(file.brandId))
        const href = `/download.html?file=${encodeURIComponent(fileId)}`

        return {
          title: displayTitle,
          meta: buildSearchMeta([
            brandLabel,
            String(file.size || '').trim() ? `Size ${String(file.size || '').trim()}` : '',
            String(file.downloads || '').trim() ? `${String(file.downloads || '').trim()} downloads` : 'File',
          ]),
          href,
          keywords: `${fileId} ${String(file.title || '')} ${String(file.subtitle || '')} ${String(file.summary || '')} ${brandLabel} ${String(file.brandId || '')} ${String(file.categoryLabel || '')}`.trim(),
          icon: 'fa-file-archive',
        } satisfies SearchCatalogEntry
      })

    const mergedEntries = new Map<string, SearchCatalogEntry>()
    ;[...localSearchCatalog, ...liveEntries].forEach((entry) => {
      const key = entry.href || `${entry.title}:${entry.meta}`
      if (!key) return
      mergedEntries.set(key, entry)
    })

    return Array.from(mergedEntries.values())
  } catch (error) {
    console.warn('Search catalog could not be loaded from live API.', error)
    return localSearchCatalog
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
    const data = await fetchJsonCached<PublicFilesResponse>(cacheKey, url, {
      preferFresh: true,
    })
    const liveFileRecords = dedupeFiles(data.files ?? [])
    const liveFiles = liveFileRecords.map(normalizeFile)
    const liveCategory =
      liveFiles[0]
        ? {
            id: categoryId,
            brandId: (liveFiles[0].brandId as BrandId | undefined) || requestBrandId,
            brandLabel: String((liveFileRecords[0] as PublicFileRecord | undefined)?.brandLabel || brandLabelMap[requestBrandId] || toDisplayLabel(requestBrandId)),
            title: String((liveFileRecords[0] as PublicFileRecord | undefined)?.categoryLabel || fallbackCategory.title),
            description: `${String((liveFileRecords[0] as PublicFileRecord | undefined)?.brandLabel || brandLabelMap[requestBrandId] || toDisplayLabel(requestBrandId))} solution folder.`,
          }
        : fallbackCategory

    return {
      source: 'live' as const,
      category: liveCategory,
      files: liveFiles,
    }
  } catch (error) {
    console.warn('Category files could not be loaded.', error)
    const localFiles = getLocalFilesByCategory(categoryId)
    return {
      source: 'live-error' as const,
      category: fallbackCategory,
      files: localFiles,
    }
  }
}

export const loadFileById = async (fileId: string) => {
  const localFileMatch = getLocalFileById(fileId)
  const fallbackCategory =
    localFileMatch?.category ??
    solutionCategories.find((category) => (solutionFilesByCategory[category.id] ?? []).some((item) => item.id === fileId)) ??
    solutionCategories[0]

  const url = buildApiUrl('file', { id: fileId })
  if (!url) {
    return {
      source: 'unconfigured' as const,
      file: localFileMatch?.file ?? null,
      category: fallbackCategory,
      driveUrl: '',
      price: localFileMatch?.file.price || '',
      status: '',
    }
  }

  try {
    const data = await fetchJsonCached<PublicFileResponse>(`file:${fileId}`, url, {
      preferFresh: true,
    })
    const file = data.file

    if (!file) {
      if (localFileMatch) {
        return {
          source: 'live-local-fallback' as const,
          file: localFileMatch.file,
          category: localFileMatch.category,
          driveUrl: '',
          price: localFileMatch.file.price || '',
          status: '',
        }
      }

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

    if (localFileMatch) {
      return {
        source: 'live-error-local' as const,
        file: localFileMatch.file,
        category: localFileMatch.category,
        driveUrl: '',
        price: localFileMatch.file.price || '',
        status: '',
      }
    }

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

export const warmRouteDataFromHref = (href: string, intent: 'hover' | 'navigation' = 'navigation') => {
  try {
    const url = new URL(href, window.location.origin)
    const path = url.pathname.toLowerCase()

    if (path.endsWith('/downloads.html') || path.endsWith('downloads.html')) {
      void loadBrandFolders()
      return true
    }

    if (path.endsWith('/solution-files.html') || path.endsWith('solution-files.html')) {
      const brand = (url.searchParams.get('brand') || 'huawei') as BrandId
      const category = url.searchParams.get('category')

      if (category) {
        void loadFilesByCategory(category, brand)
      } else {
        void loadCategoriesByBrand(brand)
      }
      return true
    }

    if (path.endsWith('/download.html') || path.endsWith('download.html')) {
      if (intent === 'hover') return false
      const fileId = url.searchParams.get('file')
      if (fileId) {
        void loadFileById(fileId)
        return true
      }
    }
  } catch {
    // ignore invalid hrefs
  }

  return false
}
