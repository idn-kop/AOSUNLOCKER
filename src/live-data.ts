import { anaAn00Files, downloadHomeCategories, huaweiUpdateFolders, solutionCategories, solutionFilesByCategory } from './download-data'
import type { BrandId, DownloadListFile, SolutionCategory, TickerItem } from './data-types'

declare global {
  interface Window {
    AOSUNLOCKER_CONFIG?: {
      apiBaseUrl?: string
      adminApiBaseUrl?: string
    }
  }
}

type PublicCategoryRecord = {
  id?: string
  label?: string
  brandId?: BrandId
  brandLabel?: string
  parentCategoryId?: string
  parentCategoryLabel?: string
  fullLabel?: string
  depth?: number
  hasChildren?: boolean
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
  solution: 'SOLUTION',
}

const LIVE_CACHE_PREFIX = 'aosunlocker-live-cache:'
const LIVE_CACHE_TTL = 1000 * 60 * 15
const LIVE_FETCH_TIMEOUT = 1000 * 10
const LIVE_VERSION_STORAGE_KEY = 'aosunlocker-live-cache-version'
const inFlightRequests = new Map<string, Promise<unknown>>()

const getPublicApiBaseUrl = () => window.AOSUNLOCKER_CONFIG?.apiBaseUrl?.trim() ?? ''

const shouldUseStaticCatalogFallback = () => !getPublicApiBaseUrl()

const shouldAllowExpiredCacheFallback = () => false

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
  const baseUrl = getPublicApiBaseUrl()
  if (!baseUrl) return ''

  const url = new URL(baseUrl, window.location.origin)
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

const buildCategoryDescription = (brandLabel: string, fullTitle: string, hasChildren: boolean) =>
  hasChildren
    ? `${brandLabel} folder group for ${fullTitle}.`
    : `${brandLabel} solution folder.`

const decorateSolutionCategories = (categories: SolutionCategory[]): SolutionCategory[] => {
  const normalized = categories.map((item) => ({
    ...item,
    id: String(item.id || '').trim(),
    brandId: String(item.brandId || '').trim(),
    brandLabel: String(item.brandLabel || brandLabelMap[item.brandId] || toDisplayLabel(item.brandId || '')).trim(),
    title: String(item.title || '').trim(),
    parentCategoryId: String(item.parentCategoryId || '').trim(),
  }))

  const inferParentCategoryId = (item: SolutionCategory) => {
    const explicitParentId = String(item.parentCategoryId || '').trim()
    if (explicitParentId) return explicitParentId

    const itemId = String(item.id || '').trim()
    const brandId = String(item.brandId || '').trim()
    if (!itemId) return ''

    const candidates = normalized
      .filter((candidate) => {
        const candidateId = String(candidate.id || '').trim()
        return (
          candidateId &&
          candidateId !== itemId &&
          String(candidate.brandId || '').trim() === brandId &&
          itemId.startsWith(`${candidateId}-`)
        )
      })
      .sort((left, right) => String(right.id || '').length - String(left.id || '').length)

    return String(candidates[0]?.id || '').trim()
  }

  const categoryMap = new Map(
    normalized.map((item) => [
      item.id,
      {
        ...item,
        parentCategoryId: inferParentCategoryId(item),
      },
    ]),
  )
  const childCounts = new Map<string, number>()

  normalized.forEach((item) => {
    const parentId = String(item.parentCategoryId || '').trim()
    if (!parentId) return
    childCounts.set(parentId, (childCounts.get(parentId) || 0) + 1)
  })

  const buildFullTitle = (categoryId: string) => {
    const seen = new Set<string>()
    const parts: string[] = []
    let currentId = String(categoryId || '').trim()

    while (currentId && categoryMap.has(currentId) && !seen.has(currentId)) {
      seen.add(currentId)
      const current = categoryMap.get(currentId)!
      parts.unshift(String(current.title || current.id).trim())
      currentId = String(current.parentCategoryId || '').trim()
    }

    return parts.join(' / ')
  }

  const getDepth = (categoryId: string) => {
    const seen = new Set<string>()
    let depth = 0
    let currentId = String(categoryId || '').trim()

    while (currentId && categoryMap.has(currentId) && !seen.has(currentId)) {
      seen.add(currentId)
      const current = categoryMap.get(currentId)!
      currentId = String(current.parentCategoryId || '').trim()
      if (currentId) depth += 1
    }

    return depth
  }

  return normalized.map((item) => {
    const parentId = String(item.parentCategoryId || '').trim()
    const parent = parentId ? categoryMap.get(parentId) : null
    const fullTitle = String(item.fullTitle || buildFullTitle(item.id)).trim() || item.title
    const depth = typeof item.depth === 'number' ? item.depth : getDepth(item.id)
    const hasChildren = typeof item.hasChildren === 'boolean' ? item.hasChildren : childCounts.has(item.id)

    return {
      ...item,
      parentCategoryId: parentId,
      parentCategoryLabel: String(item.parentCategoryLabel || parent?.title || '').trim(),
      fullTitle,
      depth,
      hasChildren,
      description: String(item.description || buildCategoryDescription(item.brandLabel, fullTitle, hasChildren)).trim(),
    }
  })
}

const findCategoryById = (categories: SolutionCategory[], categoryId: string) =>
  categories.find((item) => String(item.id || '').trim() === String(categoryId || '').trim()) || null

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
      const stale = shouldAllowExpiredCacheFallback()
        ? readCache<T>(cacheKey, { allowExpired: true })
        : null
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

const buildFallbackCategory = (categoryId: string, brandId: BrandId, categoryLabel = ''): SolutionCategory => {
  const title = String(categoryLabel || toDisplayLabel(categoryId || 'solution-folder')).trim() || 'Solution Folder'
  const brandLabel = brandLabelMap[brandId] || toDisplayLabel(brandId)

  return {
    id: String(categoryId || '').trim() || 'solution-folder',
    brandId,
    brandLabel,
    title,
    description: `${brandLabel} solution folder.`,
    parentCategoryId: '',
    parentCategoryLabel: '',
    fullTitle: title,
    depth: 0,
    hasChildren: false,
  }
}

const normalizeCategory = (category: PublicCategoryRecord, brandId: BrandId): SolutionCategory => {
  const resolvedBrandId = (String(category.brandId || '').trim() || brandId) as BrandId
  const brandLabel = String(category.brandLabel || brandLabelMap[resolvedBrandId] || toDisplayLabel(resolvedBrandId)).trim()
  const title = String(category.label || '').trim() || toDisplayLabel(String(category.id || ''))
  const parentCategoryId = String(category.parentCategoryId || '').trim()
  const parentCategoryLabel = String(category.parentCategoryLabel || '').trim()
  const fullTitle = String(category.fullLabel || title).trim() || title
  const depth = Number.isFinite(Number(category.depth)) ? Number(category.depth) : 0
  const hasChildren = Boolean(category.hasChildren)

  return {
    id: String(category.id || '').trim(),
    brandId: resolvedBrandId,
    brandLabel,
    title,
    description: buildCategoryDescription(brandLabel, fullTitle, hasChildren),
    parentCategoryId,
    parentCategoryLabel,
    fullTitle,
    depth,
    hasChildren,
  }
}

const getLocalCategoriesByBrand = (brandId: BrandId) =>
  decorateSolutionCategories(solutionCategories.filter((item) => item.brandId === brandId))

const getLocalFilesByCategory = (categoryId: string) => solutionFilesByCategory[categoryId] ?? []

const resolveKnownCategory = (categoryId: string, brandId: BrandId, fallbackLabel = '') => {
  const knownCategories =
    peekCategoriesByBrand(brandId)?.categories ??
    (shouldUseStaticCatalogFallback() ? getLocalCategoriesByBrand(brandId) : [])
  const knownCategory = findCategoryById(knownCategories, categoryId)

  if (knownCategory) return knownCategory

  return buildFallbackCategory(categoryId, brandId, fallbackLabel)
}

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
  const knownIds = new Set(
    categories
      .map((item) => String(item.id || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const selected = new Map<string, PublicCategoryRecord & { _sourceIndex?: number }>()

  categories.forEach((item, index) => {
    const categoryKey = String(item.id || '').trim().toLowerCase()
    if (!categoryKey) return

    const candidate = { ...item, _sourceIndex: index }
    const existing = selected.get(categoryKey)
    if (!existing) {
      selected.set(categoryKey, candidate)
      return
    }

    selected.set(categoryKey, pickPreferredCategoryRecord(existing, candidate, knownIds))
  })

  return Array.from(selected.values())
    .sort((left, right) => Number(left._sourceIndex || 0) - Number(right._sourceIndex || 0))
    .map(({ _sourceIndex, ...item }) => item)
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

const pickPreferredCategoryRecord = (
  current: PublicCategoryRecord & { _sourceIndex?: number },
  candidate: PublicCategoryRecord & { _sourceIndex?: number },
  knownIds: Set<string>,
) => {
  const currentScore = getCategoryRecordScore(current, knownIds)
  const candidateScore = getCategoryRecordScore(candidate, knownIds)

  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current
  }

  return Number(candidate._sourceIndex || 0) >= Number(current._sourceIndex || 0) ? candidate : current
}

const getCategoryRecordScore = (
  item: PublicCategoryRecord,
  knownIds: Set<string>,
) => {
  const categoryId = String(item.id || '').trim().toLowerCase()
  const brandId = String(item.brandId || '').trim().toLowerCase()
  const label = String(item.label || '').trim()
  const parentCategoryId = String(item.parentCategoryId || '').trim().toLowerCase()
  const hasKnownParent = Boolean(parentCategoryId && knownIds.has(parentCategoryId) && parentCategoryId !== categoryId)

  let score = 0
  if (brandId) score += 1
  if (label) score += 2
  if (!parentCategoryId) score += 1
  if (hasKnownParent) score += 3

  return score
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
    .join(' | ')

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

  decorateSolutionCategories(solutionCategories).forEach((category) => {
    const fullTitle = category.fullTitle || category.title
    entries.push({
      title: fullTitle,
      meta: buildSearchMeta([category.brandLabel, category.parentCategoryId ? 'Subfolder' : 'Solution folder']),
      href: `/solution-files.html?brand=${category.brandId}&category=${category.id}`,
      keywords: `${fullTitle} ${category.title} ${category.description} ${category.brandLabel} ${category.brandId}`.trim(),
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

export const hasLiveApi = () => Boolean(getPublicApiBaseUrl())

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
  for (const category of decorateSolutionCategories(solutionCategories)) {
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
    if (!shouldUseStaticCatalogFallback()) return null
    const localCategories = getLocalCategoriesByBrand(brandId)
    return localCategories.length
      ? {
          source: 'local-cache-miss' as const,
          categories: localCategories,
        }
      : null
  }

  const categories = decorateSolutionCategories(
    dedupeCategories(cached.categories ?? []).map((item) => normalizeCategory(item, brandId)),
  )

  return {
    source: 'cache' as const,
    categories,
  }
}

export const peekFilesByCategory = (categoryId: string, brandId?: BrandId) => {
  const fallbackCategory =
    resolveKnownCategory(categoryId, brandId ?? 'huawei') ??
    buildFallbackCategory(categoryId, brandId ?? 'huawei')
  const requestBrandId = brandId ?? fallbackCategory.brandId
  const cached = readCache<PublicFilesResponse>(`files:${requestBrandId}:${categoryId}`)
  if (!cached) {
    if (!shouldUseStaticCatalogFallback()) return null
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
  const resolvedBrandId = (liveFiles[0]?.brandId as BrandId | undefined) || requestBrandId
  const category = resolveKnownCategory(
    categoryId,
    resolvedBrandId,
    String((liveFileRecords[0] as PublicFileRecord | undefined)?.categoryLabel || fallbackCategory.title),
  )

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
    const liveCategories = decorateSolutionCategories(
      dedupeCategories(data.categories ?? []).map((item) => normalizeCategory(item, brandId)),
    )

    return {
      source: 'live' as const,
      categories: liveCategories,
    }
  } catch (error) {
    console.warn('Categories could not be loaded.', error)
    return {
      source: 'live-error' as const,
      categories: shouldUseStaticCatalogFallback() ? getLocalCategoriesByBrand(brandId) : [],
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
        const category = resolveKnownCategory(
          String(file.categoryId || ''),
          ((file.brandId as BrandId | undefined) || 'huawei') as BrandId,
          String(file.categoryLabel || ''),
        )
        const href = `/download.html?file=${encodeURIComponent(fileId)}`

        return {
          title: displayTitle,
          meta: buildSearchMeta([
            brandLabel,
            category?.fullTitle || category?.title || '',
            String(file.size || '').trim() ? `Size ${String(file.size || '').trim()}` : '',
            String(file.downloads || '').trim() ? `${String(file.downloads || '').trim()} downloads` : 'File',
          ]),
          href,
          keywords: `${fileId} ${String(file.title || '')} ${String(file.subtitle || '')} ${String(file.summary || '')} ${brandLabel} ${String(file.brandId || '')} ${String(file.categoryLabel || '')} ${category?.fullTitle || ''}`.trim(),
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
    return shouldUseStaticCatalogFallback() ? localSearchCatalog : []
  }
}

export const loadFilesByCategory = async (categoryId: string, brandId?: BrandId) => {
  const fallbackCategory =
    resolveKnownCategory(categoryId, brandId ?? 'huawei') ??
    buildFallbackCategory(categoryId, brandId ?? 'huawei')
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
    const resolvedBrandId = (liveFiles[0]?.brandId as BrandId | undefined) || requestBrandId
    const liveCategory = resolveKnownCategory(
      categoryId,
      resolvedBrandId,
      String((liveFileRecords[0] as PublicFileRecord | undefined)?.categoryLabel || fallbackCategory.title),
    )

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
      files: shouldUseStaticCatalogFallback() ? getLocalFilesByCategory(categoryId) : [],
    }
  }
}

export const loadFileById = async (fileId: string) => {
  const localFileMatch = shouldUseStaticCatalogFallback() ? getLocalFileById(fileId) : null
  const fallbackCategory =
    localFileMatch?.category ??
    (shouldUseStaticCatalogFallback()
      ? decorateSolutionCategories(solutionCategories).find((category) => (solutionFilesByCategory[category.id] ?? []).some((item) => item.id === fileId))
      : null) ??
    decorateSolutionCategories(solutionCategories)[0]

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
      category: resolveKnownCategory(
        String(file.categoryId || fallbackCategory.id),
        (((file.brandId as BrandId | undefined) || fallbackCategory.brandId) as BrandId),
        String(file.categoryLabel || fallbackCategory.title),
      ),
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
        void loadCategoriesByBrand(brand)
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
