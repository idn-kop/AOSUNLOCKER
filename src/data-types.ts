export type TickerItem = {
  title: string
  meta: string
  icon: string
}

export type SimpleCard = {
  title: string
  subtitle: string
  badge?: string
  icon: string
  accent: string
}

export type FirmwareCard = {
  id: string
  title: string
  brand: string
  downloads: string
  age: string
  status: string[]
  description: string
  size: string
  date: string
  visits: string
}

export type FeatureCard = {
  title: string
  description: string
  icon: string
  tone: string
}

export type RemoteServiceEntry = {
  model: string
  platform: string
}

export type SitePageKey = 'home' | 'huawei' | 'honor' | 'kirin' | 'harmony'

export type BrandId = string

export type SitePage = {
  key: SitePageKey
  title: string
  eyebrow: string
  heroTitle: string
  heroCopy: string
  quickLabel: string
  primaryEyebrow: string
  primaryTitle: string
  primaryItems: SimpleCard[]
  packageEyebrow: string
  packageTitle: string
  packageItems: FirmwareCard[]
  featureEyebrow: string
  featureTitle: string
  featureItems: FeatureCard[]
  ctaEyebrow: string
  ctaTitle: string
  ctaCopy: string
}

export type DownloadCategoryCard = {
  title: string
  description: string
  href: string
  kind: 'folder' | 'android' | 'brand'
  brandId?: BrandId
}

export type DownloadBrandCard = {
  title: string
  subtitle: string
  href: string
  badge?: string
  kind: 'huawei' | 'tool'
}

export type DownloadModelFolder = {
  title: string
  subtitle: string
  href: string
}

export type DownloadListFile = {
  id: string
  brandId?: BrandId
  title: string
  subtitle: string
  summary: string
  date: string
  size: string
  visits: string
  downloads: string
  price?: string
  featured?: boolean
  status?: DownloadFileStatus
}

export type DownloadFileStatus = 'draft' | 'buy' | 'published'

export type DownloadAccessGrant = {
  token: string
  fileId: string
  fileTitle?: string
  brandLabel?: string
  categoryLabel?: string
  buyerEmail: string
  buyerName?: string
  note?: string
  maxUses: number
  useCount: number
  remainingUses: number
  expiresAt?: string
  lastUsedAt?: string
  revokedAt?: string
  createdAt?: string
  updatedAt?: string
  isExpired?: boolean
  isRevoked?: boolean
  isExhausted?: boolean
  unlockUrl?: string
}

export type DownloadAccessGrantPreview = {
  fileId: string
  token: string
  maxUses: number
  useCount: number
  remainingUses: number
  expiresAt?: string
  isExpired: boolean
  isRevoked: boolean
  isExhausted: boolean
  unlockDownloadUrl?: string
}

export type SolutionCategory = {
  id: string
  brandId: BrandId
  brandLabel: string
  title: string
  description: string
  parentCategoryId?: string
  parentCategoryLabel?: string
  fullTitle?: string
  depth?: number
  hasChildren?: boolean
}
