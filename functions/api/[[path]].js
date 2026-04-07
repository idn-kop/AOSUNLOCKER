const json = (payload, init = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });

const errorResponse = (status, message) =>
  json(
    {
      ok: false,
      message,
    },
    { status },
  );

const PUBLIC_ROUTE_ALIASES = new Set(['status', 'brands', 'categories', 'files', 'file', 'increment']);

const nowIso = () => new Date().toISOString();

const normalizeId = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const toText = (value) => String(value || '').trim();

const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const stripFileExtension = (value) => toText(value).replace(/\.[a-z0-9]{1,8}$/i, '');

const prettifyFileLabel = (value) =>
  stripFileExtension(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const decodeHtmlEntities = (value) =>
  toText(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const extractDriveFileIdFromUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const directId = toText(url.searchParams.get('id'));
    if (directId) {
      return directId;
    }

    const shareMatch = url.pathname.match(/\/file\/d\/([^/]+)/i);
    if (shareMatch?.[1]) {
      return toText(shareMatch[1]);
    }
  } catch {
    return '';
  }

  return '';
};

const formatBytesLabel = (rawBytes) => {
  const bytes = Number(rawBytes || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  const digits = power >= 2 ? 2 : 0;

  return `${value.toFixed(digits)} ${units[power]}`;
};

const extractDrivePreviewFromHtml = (html, driveFileId) => {
  const safeHtml = String(html || '');
  const ogTitleMatch = safeHtml.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  const rawTitle = decodeHtmlEntities(ogTitleMatch?.[1] || '');
  const itemJsonMatch = safeHtml.match(/itemJson:\s*\[(.*?)\]\s*};/s);
  const itemJsonSlice = itemJsonMatch?.[1] || '';
  const sizeMatch = itemJsonSlice.match(/\[null,null,"(\d{6,})"\]/);
  const sizeBytes = Number.parseInt(sizeMatch?.[1] || '', 10);

  return {
    ok: true,
    driveFileId: toText(driveFileId),
    title: stripFileExtension(rawTitle),
    label: prettifyFileLabel(rawTitle),
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
    size: formatBytesLabel(sizeBytes),
  };
};

const handleAdminLinkPreview = async (rawUrl) => {
  const sourceUrl = toText(rawUrl);
  if (!sourceUrl) {
    return errorResponse(400, 'Link URL is required.');
  }

  const driveFileId = extractDriveFileIdFromUrl(sourceUrl);
  if (!driveFileId) {
    return json({
      ok: true,
      driveFileId: '',
      title: '',
      label: '',
      sizeBytes: 0,
      size: '',
    });
  }

  const response = await fetch(`https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view?usp=sharing`, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; AOSUNLOCKER/1.0; +https://aosunlocker.com)',
    },
  });

  if (!response.ok) {
    return errorResponse(422, 'Metadata Google Drive tidak bisa dibaca dari link ini.');
  }

  const html = await response.text();
  const preview = extractDrivePreviewFromHtml(html, driveFileId);

  if (!preview.title && !preview.size) {
    return errorResponse(422, 'Metadata Google Drive tidak tersedia untuk link ini.');
  }

  return json(preview);
};

const buildCategoryId = (brandId, categoryLabel, parentCategoryId) => {
  const base = slugify(categoryLabel);
  const normalizedParentId = slugify(parentCategoryId);

  if (normalizedParentId) {
    return `${normalizedParentId}-${base}`;
  }

  return brandId === 'huawei' && ['fix-reboot', 'repair-chip-damage', 'xml-qualcomm'].includes(base)
    ? base
    : `${brandId}-${base}`;
};

const buildFileId = (categoryId, title) => {
  const base = slugify(title).slice(0, 60);
  return `${categoryId}-${base}`;
};

const extractBearerToken = (request) => {
  const authorization = toText(request.headers.get('authorization'));
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? toText(match[1]) : '';
};

const resolveConfiguredAdminToken = async (db, env) => {
  const runtimeToken = toText(env.ADMIN_TOKEN);
  if (runtimeToken) {
    return runtimeToken;
  }

  const dbToken = await getMetaValue(db, 'admin_token');
  if (dbToken) {
    return dbToken;
  }

  return '';
};

const assertAdmin = async (request, env, db) => {
  const configuredToken = await resolveConfiguredAdminToken(db, env);
  if (!configuredToken) {
    return errorResponse(500, 'Admin token is not configured in Cloudflare runtime or D1 meta.');
  }

  if (extractBearerToken(request) !== configuredToken) {
    return errorResponse(401, 'Admin token is missing or invalid.');
  }

  return null;
};

const parseJsonBody = async (request) => {
  try {
    return await request.json();
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
};

const mapCategoryRecord = (row) => ({
  id: toText(row.id),
  label: toText(row.label),
  brandId: normalizeId(row.brandId),
  brandLabel: toText(row.brandLabel),
  parentCategoryId: toText(row.parentCategoryId),
  createdAt: toText(row.createdAt),
  updatedAt: toText(row.updatedAt),
});

const mapFileRecord = (row) => ({
  id: toText(row.id),
  brandId: normalizeId(row.brandId),
  brandLabel: toText(row.brandLabel),
  categoryId: toText(row.categoryId),
  categoryLabel: toText(row.categoryLabel),
  title: toText(row.title),
  subtitle: toText(row.subtitle),
  summary: toText(row.summary),
  date: toText(row.date),
  size: toText(row.size),
  visits: String(row.visits ?? 0),
  downloads: String(row.downloads ?? 0),
  price: toText(row.price),
  driveUrl: toText(row.driveUrl),
  featured: Number(row.featured || 0) === 1,
  status: toText(row.status) || 'draft',
  createdAt: toText(row.createdAt),
  updatedAt: toText(row.updatedAt),
});

const decorateCategories = (items) => {
  const registry = new Map();
  const childCounts = new Map();

  items.forEach((item) => {
    registry.set(item.id, {
      ...item,
      parentCategoryId: toText(item.parentCategoryId),
    });
  });

  registry.forEach((item) => {
    if (!item.parentCategoryId) return;
    childCounts.set(item.parentCategoryId, (childCounts.get(item.parentCategoryId) || 0) + 1);
  });

  const buildFullLabel = (categoryId) => {
    const parts = [];
    const seen = new Set();
    let currentId = toText(categoryId);

    while (currentId && registry.has(currentId) && !seen.has(currentId)) {
      seen.add(currentId);
      const current = registry.get(currentId);
      parts.unshift(toText(current.label) || currentId);
      currentId = toText(current.parentCategoryId);
    }

    return parts.join(' / ');
  };

  const getDepth = (categoryId) => {
    let depth = 0;
    const seen = new Set();
    let currentId = toText(categoryId);

    while (currentId && registry.has(currentId) && !seen.has(currentId)) {
      seen.add(currentId);
      const current = registry.get(currentId);
      currentId = toText(current.parentCategoryId);
      if (currentId) {
        depth += 1;
      }
    }

    return depth;
  };

  return items.map((item) => {
    const parent = item.parentCategoryId ? registry.get(item.parentCategoryId) : null;
    return {
      ...item,
      parentCategoryLabel: parent ? toText(parent.label) : '',
      fullLabel: buildFullLabel(item.id),
      depth: getDepth(item.id),
      hasChildren: Boolean(childCounts.get(item.id)),
    };
  });
};

const getCategoryDescendantIds = (categories, parentCategoryId) => {
  const targetId = toText(parentCategoryId);
  if (!targetId) return [];

  const childMap = new Map();
  categories.forEach((item) => {
    const parentId = toText(item.parentCategoryId);
    if (!parentId) return;
    if (!childMap.has(parentId)) {
      childMap.set(parentId, []);
    }
    childMap.get(parentId).push(item.id);
  });

  const descendants = [];
  const seen = new Set();
  const queue = [...(childMap.get(targetId) || [])];

  while (queue.length) {
    const currentId = toText(queue.shift());
    if (!currentId || seen.has(currentId)) continue;
    seen.add(currentId);
    descendants.push(currentId);
    queue.push(...(childMap.get(currentId) || []));
  }

  return descendants;
};

const runIntegrityScan = (brands, categories, files) => {
  const issues = [];
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const brandMap = new Map(brands.map((item) => [normalizeId(item.id), item]));

  categories.forEach((category) => {
    if (!brandMap.has(normalizeId(category.brandId))) {
      issues.push({
        level: 'critical',
        title: 'Category points to missing brand',
        detail: `Folder "${category.label}" uses unknown brand "${category.brandId}".`,
      });
    }

    if (category.parentCategoryId) {
      const parent = categoryMap.get(category.parentCategoryId);
      if (!parent) {
        issues.push({
          level: 'critical',
          title: 'Category points to missing parent',
          detail: `Folder "${category.label}" points to missing parent "${category.parentCategoryId}".`,
        });
      } else if (normalizeId(parent.brandId) !== normalizeId(category.brandId)) {
        issues.push({
          level: 'critical',
          title: 'Parent folder brand mismatch',
          detail: `Folder "${category.label}" belongs to "${category.brandId}" but parent "${parent.label}" belongs to "${parent.brandId}".`,
        });
      }
    }
  });

  categories.forEach((category) => {
    const seen = new Set();
    let currentId = category.id;
    while (currentId) {
      if (seen.has(currentId)) {
        issues.push({
          level: 'critical',
          title: 'Folder loop detected',
          detail: `Folder "${category.label}" creates a circular parent chain.`,
        });
        break;
      }

      seen.add(currentId);
      currentId = toText(categoryMap.get(currentId)?.parentCategoryId);
    }
  });

  files.forEach((file) => {
    const category = categoryMap.get(file.categoryId);
    if (!category) {
      issues.push({
        level: 'critical',
        title: 'File points to missing category',
        detail: `File "${file.title}" points to unknown folder "${file.categoryId}".`,
      });
      return;
    }

    if (normalizeId(category.brandId) !== normalizeId(file.brandId)) {
      issues.push({
        level: 'critical',
        title: 'File brand/category mismatch',
        detail: `File "${file.title}" uses brand "${file.brandId}" but folder "${category.label}" belongs to "${category.brandId}".`,
      });
    }
  });

  const critical = issues.filter((item) => item.level === 'critical').length;
  const warning = issues.length - critical;

  return {
    ok: true,
    checkedAt: nowIso(),
    status: critical ? 'critical' : warning ? 'warning' : 'clean',
    summary: {
      brands: brands.length,
      categories: categories.length,
      files: files.length,
      critical,
      warning,
      fixableCategoryRows: 0,
      totalIssues: issues.length,
    },
    issues: issues.slice(0, 18),
  };
};

const queryAll = async (db, sql, bindings = []) => {
  const statement = db.prepare(sql);
  const bound = bindings.length ? statement.bind(...bindings) : statement;
  const result = await bound.all();
  return result.results || [];
};

const queryFirst = async (db, sql, bindings = []) => {
  const statement = db.prepare(sql);
  const bound = bindings.length ? statement.bind(...bindings) : statement;
  return await bound.first();
};

const runStatement = async (db, sql, bindings = []) => {
  const statement = db.prepare(sql);
  const bound = bindings.length ? statement.bind(...bindings) : statement;
  return await bound.run();
};

const setMetaValue = async (db, key, value) => {
  await runStatement(
    db,
    `
      INSERT INTO meta (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `,
    [key, String(value ?? ''), nowIso()],
  );
};

const getMetaValue = async (db, key) => {
  const row = await queryFirst(db, 'SELECT value FROM meta WHERE key = ? LIMIT 1', [key]);
  return toText(row?.value);
};

const touchPublicCacheVersion = async (db) => {
  const version = String(Date.now());
  const updatedAt = nowIso();
  await setMetaValue(db, 'public_cache_version', version);
  await setMetaValue(db, 'last_admin_update', updatedAt);
  return { version, updatedAt };
};

const getBrands = async (db) => {
  const rows = await queryAll(db, 'SELECT id, label FROM brands ORDER BY label COLLATE NOCASE ASC');
  return rows.map((row) => ({
    id: normalizeId(row.id),
    label: toText(row.label),
  }));
};

const getAllCategories = async (db) => {
  const rows = await queryAll(
    db,
    `
      SELECT
        c.id AS id,
        c.label AS label,
        c.brand_id AS brandId,
        b.label AS brandLabel,
        c.parent_category_id AS parentCategoryId,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt
      FROM categories c
      INNER JOIN brands b ON b.id = c.brand_id
      ORDER BY b.label COLLATE NOCASE ASC, c.label COLLATE NOCASE ASC
    `,
  );

  return decorateCategories(rows.map(mapCategoryRecord));
};

const getCategories = async (db, brandId) => {
  const categories = await getAllCategories(db);
  const normalizedBrandId = normalizeId(brandId);
  return normalizedBrandId
    ? categories.filter((item) => normalizeId(item.brandId) === normalizedBrandId)
    : categories;
};

const getFileRows = async (db, options = {}) => {
  const { brandId = '', categoryId = '', status = '', publishedOnly = true, limit = 0 } = options;
  const clauses = [];
  const bindings = [];

  if (publishedOnly) {
    clauses.push(`f.status = 'published'`);
  } else if (status) {
    clauses.push('f.status = ?');
    bindings.push(toText(status) === 'published' ? 'published' : 'draft');
  }

  if (brandId) {
    clauses.push('f.brand_id = ?');
    bindings.push(normalizeId(brandId));
  }

  if (categoryId) {
    clauses.push('f.category_id = ?');
    bindings.push(toText(categoryId));
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limitClause = Number(limit) > 0 ? `LIMIT ${Number(limit)}` : '';

  return await queryAll(
    db,
    `
      SELECT
        f.id AS id,
        f.brand_id AS brandId,
        b.label AS brandLabel,
        f.category_id AS categoryId,
        c.label AS categoryLabel,
        f.title AS title,
        f.subtitle AS subtitle,
        f.summary AS summary,
        f.date_label AS date,
        f.size_label AS size,
        f.visits AS visits,
        f.downloads AS downloads,
        f.price AS price,
        f.drive_url AS driveUrl,
        f.featured AS featured,
        f.status AS status,
        f.created_at AS createdAt,
        f.updated_at AS updatedAt
      FROM files f
      INNER JOIN brands b ON b.id = f.brand_id
      INNER JOIN categories c ON c.id = f.category_id
      ${whereClause}
      ORDER BY f.updated_at DESC, f.created_at DESC, f.title COLLATE NOCASE ASC
      ${limitClause}
    `,
    bindings,
  );
};

const getFiles = async (db, options = {}) => (await getFileRows(db, options)).map(mapFileRecord);

const getFileById = async (db, fileId, options = {}) => {
  const { publishedOnly = false } = options;
  const row = await queryFirst(
    db,
    `
      SELECT
        f.id AS id,
        f.brand_id AS brandId,
        b.label AS brandLabel,
        f.category_id AS categoryId,
        c.label AS categoryLabel,
        f.title AS title,
        f.subtitle AS subtitle,
        f.summary AS summary,
        f.date_label AS date,
        f.size_label AS size,
        f.visits AS visits,
        f.downloads AS downloads,
        f.price AS price,
        f.drive_url AS driveUrl,
        f.featured AS featured,
        f.status AS status,
        f.created_at AS createdAt,
        f.updated_at AS updatedAt
      FROM files f
      INNER JOIN brands b ON b.id = f.brand_id
      INNER JOIN categories c ON c.id = f.category_id
      WHERE f.id = ?
      ${publishedOnly ? `AND f.status = 'published'` : ''}
      LIMIT 1
    `,
    [toText(fileId)],
  );

  return row ? mapFileRecord(row) : null;
};

const countFiles = async (db) => {
  const row = await queryFirst(db, 'SELECT COUNT(*) AS count FROM files');
  return Number(row?.count || 0);
};

const getRecentFiles = async (db, limit = 20) => getFiles(db, { publishedOnly: false, limit });

const searchFiles = async (db, query) => {
  const keyword = toText(query).toLowerCase();
  if (!keyword) {
    return {
      ok: true,
      query: '',
      total: 0,
      results: [],
    };
  }

  const categories = await getAllCategories(db);
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const files = await getFiles(db, { publishedOnly: false });
  const results = files.filter((file) => {
    const category = categoryMap.get(file.categoryId);
    const haystack = [
      file.id,
      file.brandId,
      file.brandLabel,
      file.categoryId,
      file.categoryLabel,
      category?.fullLabel,
      file.title,
      file.subtitle,
      file.summary,
      file.driveUrl,
    ]
      .map((item) => toText(item).toLowerCase())
      .join(' ');

    return haystack.includes(keyword);
  });

  return {
    ok: true,
    query: keyword,
    total: results.length,
    results: results.slice(0, 60),
  };
};

const getCategoryRecord = async (db, categoryId) =>
  await queryFirst(
    db,
    `
      SELECT
        c.id AS id,
        c.label AS label,
        c.brand_id AS brandId,
        b.label AS brandLabel,
        c.parent_category_id AS parentCategoryId,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt
      FROM categories c
      INNER JOIN brands b ON b.id = c.brand_id
      WHERE c.id = ?
      LIMIT 1
    `,
    [toText(categoryId)],
  );

const validateFilePayload = async (db, payload, originalId = '') => {
  const brandId = normalizeId(payload.brandId);
  const categoryId = toText(payload.categoryId);
  const title = toText(payload.title);
  const driveUrl = toText(payload.driveUrl);
  const customId = toText(payload.id);

  if (!brandId) {
    throw new Error('Brand is required.');
  }

  if (!categoryId) {
    throw new Error('Category is required.');
  }

  if (!title) {
    throw new Error('Title is required.');
  }

  if (!driveUrl) {
    throw new Error('Drive URL is required.');
  }

  const category = await getCategoryRecord(db, categoryId);
  if (!category) {
    throw new Error('Selected category was not found.');
  }

  if (normalizeId(category.brandId) !== brandId) {
    throw new Error('Selected folder belongs to a different brand.');
  }

  const fileId = customId || toText(originalId) || buildFileId(categoryId, title);
  const duplicate = await queryFirst(db, 'SELECT id FROM files WHERE id = ? LIMIT 1', [fileId]);
  if (duplicate && toText(duplicate.id) !== toText(originalId)) {
    throw new Error('A file with the same generated ID already exists.');
  }

  return {
    id: fileId,
    brandId,
    brandLabel: toText(category.brandLabel),
    categoryId,
    categoryLabel: toText(category.label),
    title,
    subtitle: toText(payload.subtitle) || title,
    summary: toText(payload.summary) || toText(payload.subtitle) || title,
    date: toText(payload.date),
    size: toText(payload.size),
    visits: toInt(payload.visits, 0),
    downloads: toInt(payload.downloads, 0),
    price: toText(payload.price),
    driveUrl,
    featured: Boolean(payload.featured),
    status: toText(payload.status || 'draft') === 'published' ? 'published' : 'draft',
  };
};

const handlePublicGet = async (context, url) => {
  const db = context.env.DB;
  await db.exec('PRAGMA foreign_keys = ON;');

  const view = toText(url.searchParams.get('view')) || 'catalog';

  if (view === 'status') {
    return json({
      ok: true,
      cacheVersion: (await getMetaValue(db, 'public_cache_version')) || String(Date.now()),
    });
  }

  if (view === 'brands') {
    return json({
      ok: true,
      brands: await getBrands(db),
    });
  }

  if (view === 'categories') {
    return json({
      ok: true,
      categories: await getCategories(db, url.searchParams.get('brand')),
    });
  }

  if (view === 'files') {
    return json({
      ok: true,
      brandId: toText(url.searchParams.get('brand')),
      categoryId: toText(url.searchParams.get('category')),
      files: await getFiles(db, {
        brandId: url.searchParams.get('brand'),
        categoryId: url.searchParams.get('category'),
        publishedOnly: true,
      }),
    });
  }

  if (view === 'file') {
    const file = await getFileById(db, url.searchParams.get('id'), { publishedOnly: true });
    return json({
      ok: Boolean(file),
      file,
    });
  }

  if (view === 'increment') {
    const fileId = toText(url.searchParams.get('id'));
    if (!fileId) {
      return errorResponse(400, 'Missing file id.');
    }

    const result = await runStatement(
      db,
      'UPDATE files SET downloads = downloads + 1 WHERE id = ? AND status = ?',
      [fileId, 'published'],
    );

    if (!result.success || !result.meta?.changes) {
      return errorResponse(404, 'File id not found.');
    }

    const file = await queryFirst(db, 'SELECT downloads FROM files WHERE id = ? LIMIT 1', [fileId]);
    return json({
      ok: true,
      id: fileId,
      downloads: String(file?.downloads ?? 0),
    });
  }

  return json({
    ok: true,
    categories: await getCategories(db, ''),
    files: await getFiles(db, { publishedOnly: true }),
  });
};

const handleAdminBootstrap = async (db) => {
  const [brands, categories, recentFiles, fileCount, cacheVersion, lastPublicRefresh] = await Promise.all([
    getBrands(db),
    getCategories(db, ''),
    getRecentFiles(db, 20),
    countFiles(db),
    getMetaValue(db, 'public_cache_version'),
    getMetaValue(db, 'last_admin_update'),
  ]);

  return json({
    ok: true,
    brands,
    categories,
    recentFiles,
    totals: {
      brands: brands.length,
      categories: categories.length,
      files: fileCount,
    },
    cacheVersion,
    sheetName: 'Cloudflare D1',
    lastPublicRefresh,
  });
};

const handleAdminCacheRefresh = async (db) => {
  const refresh = await touchPublicCacheVersion(db);
  return json({
    ok: true,
    cacheVersion: refresh.version,
    updatedAt: refresh.updatedAt,
  });
};

const handleAdminBrandCreate = async (db, payload) => {
  const brandLabel = toText(payload.brandLabel || payload.label);
  const brandId = slugify(payload.brandId || brandLabel || payload.label);

  if (!brandLabel) {
    return errorResponse(400, 'Brand label is required.');
  }

  if (!brandId) {
    return errorResponse(400, 'Brand ID could not be generated. Use letters or numbers in the brand name.');
  }

  if (!/^[a-z0-9-]+$/.test(brandId)) {
    return errorResponse(400, 'Brand ID can only contain lowercase letters, numbers, and dashes.');
  }

  const duplicate = await queryFirst(db, 'SELECT id FROM brands WHERE id = ? LIMIT 1', [brandId]);
  if (duplicate) {
    return errorResponse(409, 'Brand ID already exists.');
  }

  const timestamp = nowIso();
  await runStatement(
    db,
    'INSERT INTO brands (id, label, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [brandId, brandLabel, timestamp, timestamp],
  );
  await touchPublicCacheVersion(db);

  return handleAdminBootstrap(db);
};

const handleAdminBrandUpdate = async (db, brandId, payload) => {
  const targetId = normalizeId(brandId);
  const brandLabel = toText(payload.brandLabel || payload.label);
  if (!brandLabel) {
    return errorResponse(400, 'Brand label is required.');
  }

  const existing = await queryFirst(db, 'SELECT id FROM brands WHERE id = ? LIMIT 1', [targetId]);
  if (!existing) {
    return errorResponse(404, 'Brand was not found.');
  }

  await runStatement(db, 'UPDATE brands SET label = ?, updated_at = ? WHERE id = ?', [brandLabel, nowIso(), targetId]);
  await touchPublicCacheVersion(db);
  return handleAdminBootstrap(db);
};

const handleAdminBrandDelete = async (db, brandId) => {
  const targetId = normalizeId(brandId);
  const categoryCount = await queryFirst(db, 'SELECT COUNT(*) AS count FROM categories WHERE brand_id = ?', [targetId]);
  const fileCount = await queryFirst(db, 'SELECT COUNT(*) AS count FROM files WHERE brand_id = ?', [targetId]);

  if (Number(categoryCount?.count || 0) > 0 || Number(fileCount?.count || 0) > 0) {
    return errorResponse(409, 'This brand still has linked folders or files. Remove them first.');
  }

  const result = await runStatement(db, 'DELETE FROM brands WHERE id = ?', [targetId]);
  if (!result.success || !result.meta?.changes) {
    return errorResponse(404, 'Brand was not found.');
  }

  await touchPublicCacheVersion(db);
  return handleAdminBootstrap(db);
};

const handleAdminCategoryCreate = async (db, payload) => {
  const brandId = normalizeId(payload.brandId);
  const categoryLabel = toText(payload.categoryLabel || payload.label);
  const parentCategoryId = toText(payload.parentCategoryId);
  const categoryId = toText(payload.categoryId) || buildCategoryId(brandId, categoryLabel, parentCategoryId);

  if (!brandId) {
    return errorResponse(400, 'Brand is required.');
  }

  if (!categoryLabel) {
    return errorResponse(400, 'Folder label is required.');
  }

  const brand = await queryFirst(db, 'SELECT id FROM brands WHERE id = ? LIMIT 1', [brandId]);
  if (!brand) {
    return errorResponse(404, 'Brand was not found.');
  }

  if (parentCategoryId) {
    const parent = await getCategoryRecord(db, parentCategoryId);
    if (!parent) {
      return errorResponse(404, 'Parent folder was not found.');
    }

    if (normalizeId(parent.brandId) !== brandId) {
      return errorResponse(409, 'Parent folder belongs to a different brand.');
    }
  }

  const duplicate = await queryFirst(db, 'SELECT id FROM categories WHERE id = ? LIMIT 1', [categoryId]);
  if (duplicate) {
    return errorResponse(409, 'Folder ID already exists.');
  }

  const timestamp = nowIso();
  await runStatement(
    db,
    'INSERT INTO categories (id, brand_id, label, parent_category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [categoryId, brandId, categoryLabel, parentCategoryId, timestamp, timestamp],
  );
  await touchPublicCacheVersion(db);

  return handleAdminBootstrap(db);
};

const handleAdminCategoryUpdate = async (db, categoryId, payload) => {
  const originalCategoryId = toText(categoryId);
  const brandId = normalizeId(payload.brandId);
  const categoryLabel = toText(payload.categoryLabel || payload.label);
  const parentCategoryId = toText(payload.parentCategoryId);
  const requestedCategoryId = toText(payload.categoryId);
  const nextCategoryId = requestedCategoryId || originalCategoryId;

  if (!brandId) {
    return errorResponse(400, 'Brand is required.');
  }

  if (!categoryLabel) {
    return errorResponse(400, 'Folder label is required.');
  }

  const current = await getCategoryRecord(db, originalCategoryId);
  if (!current) {
    return errorResponse(404, 'Folder was not found.');
  }

  const categories = await getAllCategories(db);
  const descendants = getCategoryDescendantIds(categories, originalCategoryId);
  const directFileCount = await queryFirst(db, 'SELECT COUNT(*) AS count FROM files WHERE category_id = ?', [originalCategoryId]);

  if (parentCategoryId && (parentCategoryId === originalCategoryId || parentCategoryId === nextCategoryId)) {
    return errorResponse(409, 'Folder cannot be its own parent.');
  }

  if (parentCategoryId && descendants.includes(parentCategoryId)) {
    return errorResponse(409, "Parent folder cannot be one of this folder's children.");
  }

  if (
    nextCategoryId !== originalCategoryId &&
    (descendants.length > 0 || Number(directFileCount?.count || 0) > 0)
  ) {
    return errorResponse(409, 'Folder ID cannot be changed while this folder still has linked files or subfolders.');
  }

  if (descendants.length && normalizeId(current.brandId) !== brandId) {
    return errorResponse(409, 'Move or delete subfolders first before changing this folder to another brand.');
  }

  if (parentCategoryId) {
    const parent = await getCategoryRecord(db, parentCategoryId);
    if (!parent) {
      return errorResponse(404, 'Parent folder was not found.');
    }

    if (normalizeId(parent.brandId) !== brandId) {
      return errorResponse(409, 'Parent folder belongs to a different brand.');
    }
  }

  const duplicate = await queryFirst(db, 'SELECT id FROM categories WHERE id = ? LIMIT 1', [nextCategoryId]);
  if (duplicate && toText(duplicate.id) !== originalCategoryId) {
    return errorResponse(409, 'Folder ID already exists.');
  }

  await runStatement(
    db,
    'UPDATE categories SET id = ?, brand_id = ?, label = ?, parent_category_id = ?, updated_at = ? WHERE id = ?',
    [nextCategoryId, brandId, categoryLabel, parentCategoryId, nowIso(), originalCategoryId],
  );

  if (normalizeId(current.brandId) !== brandId) {
    await runStatement(db, 'UPDATE files SET brand_id = ?, updated_at = ? WHERE category_id = ?', [
      brandId,
      nowIso(),
      nextCategoryId,
    ]);
  }

  await touchPublicCacheVersion(db);
  return handleAdminBootstrap(db);
};

const handleAdminCategoryDelete = async (db, categoryId) => {
  const targetId = toText(categoryId);
  const childCount = await queryFirst(db, 'SELECT COUNT(*) AS count FROM categories WHERE parent_category_id = ?', [targetId]);
  const fileCount = await queryFirst(db, 'SELECT COUNT(*) AS count FROM files WHERE category_id = ?', [targetId]);

  if (Number(fileCount?.count || 0) > 0) {
    return errorResponse(409, 'This folder still has files. Remove them first.');
  }

  if (Number(childCount?.count || 0) > 0) {
    return errorResponse(409, 'This folder still has subfolders. Remove them first.');
  }

  const result = await runStatement(db, 'DELETE FROM categories WHERE id = ?', [targetId]);
  if (!result.success || !result.meta?.changes) {
    return errorResponse(404, 'Folder was not found.');
  }

  await touchPublicCacheVersion(db);
  return handleAdminBootstrap(db);
};

const handleAdminFileCreate = async (db, payload) => {
  let clean;
  try {
    clean = await validateFilePayload(db, payload);
  } catch (error) {
    return errorResponse(400, error.message);
  }

  const timestamp = nowIso();
  await runStatement(
    db,
    `
      INSERT INTO files (
        id, brand_id, category_id, title, subtitle, summary, date_label, size_label, visits, downloads, price,
        drive_url, featured, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      clean.id,
      clean.brandId,
      clean.categoryId,
      clean.title,
      clean.subtitle,
      clean.summary,
      clean.date,
      clean.size,
      clean.visits,
      clean.downloads,
      clean.price,
      clean.driveUrl,
      clean.featured ? 1 : 0,
      clean.status,
      timestamp,
      timestamp,
    ],
  );

  await touchPublicCacheVersion(db);
  return handleAdminBootstrap(db);
};

const handleAdminFileUpdate = async (db, fileId, payload) => {
  const originalId = toText(fileId);
  const existing = await queryFirst(db, 'SELECT created_at AS createdAt FROM files WHERE id = ? LIMIT 1', [originalId]);
  if (!existing) {
    return errorResponse(404, 'File was not found.');
  }

  let clean;
  try {
    clean = await validateFilePayload(db, payload, originalId);
  } catch (error) {
    return errorResponse(400, error.message);
  }

  await runStatement(
    db,
    `
      UPDATE files
      SET
        id = ?,
        brand_id = ?,
        category_id = ?,
        title = ?,
        subtitle = ?,
        summary = ?,
        date_label = ?,
        size_label = ?,
        visits = ?,
        downloads = ?,
        price = ?,
        drive_url = ?,
        featured = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      clean.id,
      clean.brandId,
      clean.categoryId,
      clean.title,
      clean.subtitle,
      clean.summary,
      clean.date,
      clean.size,
      clean.visits,
      clean.downloads,
      clean.price,
      clean.driveUrl,
      clean.featured ? 1 : 0,
      clean.status,
      nowIso(),
      originalId,
    ],
  );

  await touchPublicCacheVersion(db);
  return handleAdminBootstrap(db);
};

const handleAdminFileDelete = async (db, fileId) => {
  const result = await runStatement(db, 'DELETE FROM files WHERE id = ?', [toText(fileId)]);
  if (!result.success || !result.meta?.changes) {
    return errorResponse(404, 'File was not found.');
  }

  await touchPublicCacheVersion(db);
  return handleAdminBootstrap(db);
};

const handleAdminRequest = async (context, url, pathParts) => {
  const db = context.env.DB;
  const authError = await assertAdmin(context.request, context.env, db);
  if (authError) {
    return authError;
  }

  await db.exec('PRAGMA foreign_keys = ON;');

  if (context.request.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'bootstrap') {
    return await handleAdminBootstrap(db);
  }

  if (context.request.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'search') {
    return json(await searchFiles(db, url.searchParams.get('q')));
  }

  if (context.request.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'brands') {
    return json({
      ok: true,
      brands: await getBrands(db),
    });
  }

  if (context.request.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'categories') {
    return json({
      ok: true,
      categories: await getCategories(db, url.searchParams.get('brand')),
    });
  }

  if (context.request.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'files') {
    return json({
      ok: true,
      files: await getFiles(db, {
        brandId: url.searchParams.get('brand'),
        categoryId: url.searchParams.get('category'),
        status: url.searchParams.get('status'),
        publishedOnly: false,
      }),
    });
  }

  if (context.request.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'integrity') {
    const brands = await getBrands(db);
    const categories = await getCategories(db, '');
    const files = await getFiles(db, { publishedOnly: false });
    return json(runIntegrityScan(brands, categories, files));
  }

  if (context.request.method === 'GET' && pathParts.length === 3 && pathParts[2] === 'link-preview') {
    return await handleAdminLinkPreview(url.searchParams.get('url'));
  }

  if (context.request.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'cache-refresh') {
    return await handleAdminCacheRefresh(db);
  }

  if (context.request.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'brands') {
    return await handleAdminBrandCreate(db, await parseJsonBody(context.request));
  }

  if (context.request.method === 'PUT' && pathParts.length === 4 && pathParts[2] === 'brands') {
    return await handleAdminBrandUpdate(db, pathParts[3], await parseJsonBody(context.request));
  }

  if (context.request.method === 'DELETE' && pathParts.length === 4 && pathParts[2] === 'brands') {
    return await handleAdminBrandDelete(db, pathParts[3]);
  }

  if (context.request.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'categories') {
    return await handleAdminCategoryCreate(db, await parseJsonBody(context.request));
  }

  if (context.request.method === 'PUT' && pathParts.length === 4 && pathParts[2] === 'categories') {
    return await handleAdminCategoryUpdate(db, pathParts[3], await parseJsonBody(context.request));
  }

  if (context.request.method === 'DELETE' && pathParts.length === 4 && pathParts[2] === 'categories') {
    return await handleAdminCategoryDelete(db, pathParts[3]);
  }

  if (context.request.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'files') {
    return await handleAdminFileCreate(db, await parseJsonBody(context.request));
  }

  if (context.request.method === 'PUT' && pathParts.length === 4 && pathParts[2] === 'files') {
    return await handleAdminFileUpdate(db, pathParts[3], await parseJsonBody(context.request));
  }

  if (context.request.method === 'DELETE' && pathParts.length === 4 && pathParts[2] === 'files') {
    return await handleAdminFileDelete(db, pathParts[3]);
  }

  return errorResponse(404, 'Admin route was not found.');
};

const normalizePublicRoute = (url, pathParts) => {
  const requestedView = toText(url.searchParams.get('view'));
  if (requestedView) {
    return requestedView;
  }

  const routeKey = toText(pathParts[1]);
  if (!routeKey) {
    return 'catalog';
  }

  if (!PUBLIC_ROUTE_ALIASES.has(routeKey)) {
    return '';
  }

  url.searchParams.set('view', routeKey);

  if ((routeKey === 'file' || routeKey === 'increment') && !toText(url.searchParams.get('id')) && pathParts[2]) {
    url.searchParams.set('id', toText(pathParts[2]));
  }

  return routeKey;
};

export const onRequest = async (context) => {
  try {
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (!pathParts.length || pathParts[0] !== 'api') {
      return errorResponse(404, 'API route was not found.');
    }

    if (pathParts[1] === 'admin') {
      return await handleAdminRequest(context, url, pathParts);
    }

    if (context.request.method !== 'GET') {
      return errorResponse(405, 'Only GET is allowed on public API routes.');
    }

    const publicView = normalizePublicRoute(url, pathParts);
    if (!publicView) {
      return errorResponse(404, 'Public API route was not found.');
    }

    return await handlePublicGet(context, url);
  } catch (error) {
    return errorResponse(500, error instanceof Error ? error.message : 'Unexpected API error.');
  }
};
