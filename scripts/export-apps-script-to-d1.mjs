import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const [rawKey, ...rawValue] = entry.replace(/^--/, '').split('=')
    return [rawKey, rawValue.join('=')]
  }),
)

const source = String(args.source || process.env.AOSUNLOCKER_LEGACY_API || '').trim()
const outFile = path.resolve(process.cwd(), args.out || 'migrations/generated/import-from-apps-script.sql')

if (!source) {
  console.error('Missing legacy API source. Use --source=https://script.google.com/macros/s/.../exec')
  process.exit(1)
}

const toText = (value) => String(value || '').trim()

const toInt = (value) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const escapeSql = (value) => toText(value).replaceAll("'", "''")

const sqlValue = (value) => `'${escapeSql(value)}'`

const buildUrl = (view, params = {}) => {
  const url = new URL(source)
  url.searchParams.set('api', '1')
  url.searchParams.set('view', view)

  Object.entries(params).forEach(([key, value]) => {
    if (toText(value)) {
      url.searchParams.set(key, toText(value))
    }
  })

  return url.toString()
}

const fetchJson = async (view, params = {}) => {
  const response = await fetch(buildUrl(view, params), {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Request for view "${view}" failed with status ${response.status}.`)
  }

  return await response.json()
}

const dedupeById = (items) => {
  const registry = new Map()

  items.forEach((item) => {
    const id = toText(item.id)
    if (!id) return
    registry.set(id, item)
  })

  return Array.from(registry.values())
}

const brandsResponse = await fetchJson('brands')
const brands = dedupeById(brandsResponse.brands || [])

const allCategories = []
const allFiles = []

for (const brand of brands) {
  const brandId = toText(brand.id)
  if (!brandId) continue

  const categoriesResponse = await fetchJson('categories', { brand: brandId })
  const filesResponse = await fetchJson('files', { brand: brandId })

  allCategories.push(...(categoriesResponse.categories || []))
  allFiles.push(...(filesResponse.files || []))
}

const categories = dedupeById(allCategories)
const files = dedupeById(allFiles)

const lines = []

for (const brand of brands) {
  lines.push(
    `INSERT INTO brands (id, label, created_at, updated_at) VALUES (${sqlValue(brand.id)}, ${sqlValue(
      brand.label || brand.id,
    )}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  )
  lines.push(`ON CONFLICT(id) DO UPDATE SET label = excluded.label, updated_at = CURRENT_TIMESTAMP;`)
}

for (const category of categories) {
  lines.push(
    `INSERT INTO categories (id, brand_id, label, parent_category_id, created_at, updated_at) VALUES (${sqlValue(
      category.id,
    )}, ${sqlValue(category.brandId)}, ${sqlValue(category.label || category.id)}, ${sqlValue(
      category.parentCategoryId || '',
    )}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  )
  lines.push(
    `ON CONFLICT(id) DO UPDATE SET brand_id = excluded.brand_id, label = excluded.label, parent_category_id = excluded.parent_category_id, updated_at = CURRENT_TIMESTAMP;`,
  )
}

for (const file of files) {
  const featured = file.featured ? 1 : 0
  const status = toText(file.status || 'published') === 'published' ? 'published' : 'draft'
  const createdAt = toText(file.createdAt) || new Date().toISOString()
  const updatedAt = toText(file.updatedAt) || createdAt

  lines.push(
    `INSERT INTO files (id, brand_id, category_id, title, subtitle, summary, date_label, size_label, visits, downloads, price, drive_url, featured, status, created_at, updated_at) VALUES (${sqlValue(
      file.id,
    )}, ${sqlValue(file.brandId)}, ${sqlValue(file.categoryId)}, ${sqlValue(file.title || file.id)}, ${sqlValue(
      file.subtitle || file.title || file.id,
    )}, ${sqlValue(file.summary || file.subtitle || file.title || file.id)}, ${sqlValue(file.date)}, ${sqlValue(
      file.size,
    )}, ${toInt(file.visits)}, ${toInt(file.downloads)}, ${sqlValue(file.price || 'free')}, ${sqlValue(
      file.driveUrl,
    )}, ${featured}, ${sqlValue(status)}, ${sqlValue(createdAt)}, ${sqlValue(updatedAt)})`,
  )
  lines.push(
    `ON CONFLICT(id) DO UPDATE SET brand_id = excluded.brand_id, category_id = excluded.category_id, title = excluded.title, subtitle = excluded.subtitle, summary = excluded.summary, date_label = excluded.date_label, size_label = excluded.size_label, visits = excluded.visits, downloads = excluded.downloads, price = excluded.price, drive_url = excluded.drive_url, featured = excluded.featured, status = excluded.status, updated_at = excluded.updated_at;`,
  )
}

lines.push(
  `INSERT INTO meta (key, value, updated_at) VALUES ('public_cache_version', '${Date.now()}', CURRENT_TIMESTAMP)`,
  `ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
  `INSERT INTO meta (key, value, updated_at) VALUES ('last_admin_update', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  `ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
)

await mkdir(path.dirname(outFile), { recursive: true })
await writeFile(outFile, `${lines.join('\n')}\n`, 'utf8')

console.log(`Legacy export complete.`)
console.log(`Brands: ${brands.length}`)
console.log(`Categories: ${categories.length}`)
console.log(`Files: ${files.length}`)
console.log(`Output: ${outFile}`)
