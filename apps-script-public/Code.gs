const SPREADSHEET_NAME = 'AOSUNLOCKER DATA';
const DOWNLOADS_SHEET_NAME = 'Downloads';
const SETTINGS_SHEET_NAME = 'Settings';
const BRANDS_SHEET_NAME = 'Brands';
const META_SHEET_NAME = 'Meta';
const CACHE_TTL_SECONDS = 60;
const CACHE_VERSION_LOOKUP_SECONDS = 15;
const CACHE_VERSION_META_SYNC_SECONDS = 300;
const MAX_CACHE_VALUE_LENGTH = 95000;
const CACHE_VERSION_PROPERTY = 'AOSUNLOCKER_PUBLIC_CACHE_VERSION';
const CACHE_VERSION_CACHE_KEY = 'AOSUNLOCKER_PUBLIC_CACHE_VERSION_RUNTIME';
const CACHE_VERSION_META_SYNC_KEY = 'AOSUNLOCKER_PUBLIC_CACHE_VERSION_META_SYNC';
const SPREADSHEET_ID_PROPERTY = 'AOSUNLOCKER_PUBLIC_SPREADSHEET_ID';
const PUBLIC_CACHE_VERSION_KEY = 'public_cache_version';

var spreadsheetMemo_ = null;
var sheetValuesMemo_ = {};
var cacheVersionMemo_ = '';
var allPublishedFilesMemo_ = null;

function doGet(e) {
  resetRequestState_();
  const view = String((e && e.parameter && e.parameter.view) || 'catalog');

  if (view === 'refresh') {
    const requestedVersion = String((e && e.parameter && e.parameter.version) || '').trim();
    return jsonOutput_(refreshPublicCache_(requestedVersion));
  }

  if (view === 'categories') {
    const brandId = String((e && e.parameter && e.parameter.brand) || '').trim();
    return jsonOutput_({
      ok: true,
      categories: getCategories_(brandId),
    });
  }

  if (view === 'brands') {
    return jsonOutput_({
      ok: true,
      brands: getBrands_(),
    });
  }

  if (view === 'files') {
    const categoryId = String((e && e.parameter && e.parameter.category) || '').trim();
    const brandId = String((e && e.parameter && e.parameter.brand) || '').trim();
    return jsonOutput_({
      ok: true,
      brandId: brandId,
      categoryId: categoryId,
      files: getPublishedFiles_(categoryId, brandId),
    });
  }

  if (view === 'file') {
    const fileId = String((e && e.parameter && e.parameter.id) || '').trim();
    return jsonOutput_({
      ok: true,
      file: getPublishedFileById_(fileId),
    });
  }

  if (view === 'increment') {
    const fileId = String((e && e.parameter && e.parameter.id) || '').trim();
    return jsonOutput_(incrementDownloadCount_(fileId));
  }

  return jsonOutput_({
    ok: true,
    categories: getCategories_(''),
    files: getPublishedFiles_('', ''),
  });
}

function getSpreadsheet_() {
  if (spreadsheetMemo_) {
    return spreadsheetMemo_;
  }

  spreadsheetMemo_ = resolveSpreadsheet_();
  return spreadsheetMemo_;
}

function resolveSpreadsheet_() {
  if (!SPREADSHEET_NAME || SPREADSHEET_NAME === 'PASTE_YOUR_SPREADSHEET_NAME_HERE') {
    throw new Error('Spreadsheet name has not been configured.');
  }

  const properties = PropertiesService.getScriptProperties();
  const cachedId = String(properties.getProperty(SPREADSHEET_ID_PROPERTY) || '').trim();
  if (cachedId) {
    try {
      return SpreadsheetApp.openById(cachedId);
    } catch (error) {
      properties.deleteProperty(SPREADSHEET_ID_PROPERTY);
    }
  }

  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (!files.hasNext()) {
    throw new Error('Spreadsheet not found. Make sure the name matches exactly.');
  }

  const spreadsheetId = files.next().getId();
  properties.setProperty(SPREADSHEET_ID_PROPERTY, spreadsheetId);
  return SpreadsheetApp.openById(spreadsheetId);
}

function resetRequestState_() {
  spreadsheetMemo_ = null;
  sheetValuesMemo_ = {};
  cacheVersionMemo_ = '';
  allPublishedFilesMemo_ = null;
}

function getCategories_(brandId) {
  const normalizedBrandId = normalizeId_(brandId);

  return withJsonCache_('categories', [normalizedBrandId], function() {
    const values = getSheetValues_(SETTINGS_SHEET_NAME);
    if (!values.length) {
      return [];
    }

    const headers = values[0] || [];
    const headerLookup = createHeaderLookup_(headers);
    const hasBrandColumns = hasHeader_(headerLookup, 'brand_id');

    return dedupeCategories_(values
      .slice(1)
      .map(function(row) {
        if (hasBrandColumns && row[0] && row[2] && row[3]) {
          return {
            brandId: String(row[0] || '').trim(),
            brandLabel: String(row[1] || '').trim(),
            id: String(row[2] || '').trim(),
            label: String(row[3] || '').trim(),
          };
        }

        if (row[0] && row[1]) {
          return {
            brandId: 'huawei',
            brandLabel: 'Huawei',
            id: String(row[0] || '').trim(),
            label: String(row[1] || '').trim(),
          };
        }

        return null;
      })
      .filter(function(item) {
        if (!item || !item.id || !item.label) return false;
        return !normalizedBrandId || normalizeId_(item.brandId) === normalizedBrandId;
      }));
  });
}

function getBrands_() {
  return withJsonCache_('brands', [], function() {
    const values = getSheetValues_(BRANDS_SHEET_NAME);

    if (values.length) {
      return dedupeBrands_(values
        .slice(1)
        .map(function(row) {
          return {
            id: String(row[0] || '').trim(),
            label: String(row[1] || '').trim(),
          };
        })
        .filter(function(item) {
          return item.id && item.label;
        }));
    }

    const categories = getCategories_('');
    const brandMap = {};
    categories.forEach(function(item) {
      if (!item.brandId) return;
      brandMap[item.brandId] = item.brandLabel || item.brandId;
    });

    return dedupeBrands_(Object.keys(brandMap).map(function(id) {
      return {
        id: id,
        label: String(brandMap[id] || id),
      };
    }));
  });
}

function getPublishedFiles_(categoryId, brandId) {
  const normalizedCategoryId = normalizeId_(categoryId);
  const normalizedBrandId = normalizeId_(brandId);

  return withJsonCache_('files', [normalizedBrandId, normalizedCategoryId], function() {
    return getAllPublishedFiles_().filter(function(file) {
      const matchesCategory = !normalizedCategoryId || normalizeId_(file.categoryId) === normalizedCategoryId;
      const matchesBrand = !normalizedBrandId || normalizeId_(file.brandId) === normalizedBrandId;
      return matchesCategory && matchesBrand;
    });
  });
}

function getPublishedFileById_(fileId) {
  const normalizedFileId = String(fileId || '').trim();
  if (!normalizedFileId) return null;

  return withJsonCache_('file', [normalizedFileId], function() {
    const files = getAllPublishedFiles_();
    for (var i = 0; i < files.length; i++) {
      if (files[i].id === normalizedFileId) {
        return files[i];
      }
    }
    return null;
  });
}

function getAllPublishedFiles_() {
  if (allPublishedFilesMemo_) {
    return allPublishedFilesMemo_;
  }

  allPublishedFilesMemo_ = withJsonCache_('files-all', [], function() {
    const values = getSheetValues_(DOWNLOADS_SHEET_NAME);
    if (!values.length) {
      return [];
    }

    const headers = values[0] || [];
    const headerLookup = createHeaderLookup_(headers);

    return dedupeFiles_(values
      .slice(1)
      .filter(function(row) {
        return row[0];
      })
      .map(function(row) {
        return toFileRecord_(row, headerLookup);
      })
      .filter(function(file) {
        return normalizeId_(file.status) === 'published';
      }));
  });

  return allPublishedFilesMemo_;
}

function incrementDownloadCount_(fileId) {
  const normalizedFileId = String(fileId || '').trim();
  if (!normalizedFileId) {
    return { ok: false, message: 'Missing file id.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const sheet = getSpreadsheet_().getSheetByName(DOWNLOADS_SHEET_NAME);
    if (!sheet) {
      return { ok: false, message: 'Downloads sheet not found.' };
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2 || lastColumn < 1) {
      return { ok: false, message: 'Downloads sheet is empty.' };
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0] || [];
    const headerLookup = createHeaderLookup_(headers);
    const idIndex = getHeaderIndex_(headerLookup, 'id', 0);
    const downloadsIndex = getHeaderIndex_(headerLookup, 'downloads', 9);
    const updatedAtIndex = getHeaderIndex_(headerLookup, 'updated_at', 15);

    const idRange = sheet.getRange(2, idIndex + 1, lastRow - 1, 1);
    const match = idRange
      .createTextFinder(normalizedFileId)
      .matchEntireCell(true)
      .useRegularExpression(false)
      .findNext();

    if (!match) {
      return { ok: false, message: 'File id not found.' };
    }

    const rowNumber = match.getRow();
    const currentValue = Number(sheet.getRange(rowNumber, downloadsIndex + 1).getValue() || 0);
    const nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;

    sheet.getRange(rowNumber, downloadsIndex + 1).setValue(nextValue);

    if (updatedAtIndex >= 0) {
      sheet.getRange(rowNumber, updatedAtIndex + 1).setValue(new Date().toISOString());
    }

    allPublishedFilesMemo_ = null;
    delete sheetValuesMemo_[DOWNLOADS_SHEET_NAME];
    bumpCacheVersion_();

    return {
      ok: true,
      id: normalizedFileId,
      downloads: String(nextValue),
    };
  } finally {
    lock.releaseLock();
  }
}

function getSheetValues_(sheetName) {
  if (hasOwnProperty_.call(sheetValuesMemo_, sheetName)) {
    return sheetValuesMemo_[sheetName];
  }

  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    sheetValuesMemo_[sheetName] = [];
    return sheetValuesMemo_[sheetName];
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (!lastRow || !lastColumn) {
    sheetValuesMemo_[sheetName] = [];
    return sheetValuesMemo_[sheetName];
  }

  sheetValuesMemo_[sheetName] = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  return sheetValuesMemo_[sheetName];
}

function withJsonCache_(scope, keyParts, producer) {
  const cacheKey = getCacheKey_(scope, keyParts);
  const cachedValue = readCachedJson_(cacheKey);
  if (cachedValue !== null) {
    return cachedValue;
  }

  const value = producer();
  writeCachedJson_(cacheKey, value);
  return value;
}

function getCacheKey_(scope, keyParts) {
  const parts = (keyParts || []).map(function(part) {
    return normalizeId_(part) || 'all';
  });

  return [
    'aosunlocker',
    'public',
    getCacheVersion_(),
    String(scope || '').trim() || 'default',
    parts.join(':') || 'all',
  ].join(':');
}

function readCachedJson_(cacheKey) {
  const cached = CacheService.getScriptCache().get(cacheKey);
  if (!cached) {
    return null;
  }

  try {
    if (cached.indexOf('gz:') === 0) {
      const compressedBytes = Utilities.base64Decode(cached.slice(3));
      const text = Utilities.ungzip(Utilities.newBlob(compressedBytes)).getDataAsString();
      return JSON.parse(text);
    }

    return JSON.parse(cached);
  } catch (error) {
    return null;
  }
}

function writeCachedJson_(cacheKey, value) {
  const cache = CacheService.getScriptCache();
  const json = JSON.stringify(value);

  if (json.length <= MAX_CACHE_VALUE_LENGTH) {
    cache.put(cacheKey, json, CACHE_TTL_SECONDS);
    return;
  }

  try {
    const compressed = 'gz:' + Utilities.base64Encode(
      Utilities.gzip(Utilities.newBlob(json, 'application/json')).getBytes(),
    );

    if (compressed.length <= MAX_CACHE_VALUE_LENGTH) {
      cache.put(cacheKey, compressed, CACHE_TTL_SECONDS);
    }
  } catch (error) {
  }
}

function refreshPublicCache_(requestedVersion) {
  const fallbackVersion = String(getMetaValue_(PUBLIC_CACHE_VERSION_KEY) || '').trim();
  const nextVersion = String(requestedVersion || fallbackVersion || Date.now()).trim();

  setCacheVersion_(nextVersion, false);
  warmPublicCaches_();

  return {
    ok: true,
    cacheVersion: cacheVersionMemo_,
    warmedAt: new Date().toISOString(),
  };
}

function warmPublicCaches_() {
  getBrands_();
  getCategories_('');
  getAllPublishedFiles_();
  getPublishedFiles_('', '');
}

function getCacheVersion_() {
  if (cacheVersionMemo_) {
    return cacheVersionMemo_;
  }

  const runtimeCache = CacheService.getScriptCache();
  const cachedRuntimeVersion = String(runtimeCache.get(CACHE_VERSION_CACHE_KEY) || '').trim();
  if (cachedRuntimeVersion) {
    cacheVersionMemo_ = cachedRuntimeVersion;
    return cacheVersionMemo_;
  }

  const properties = PropertiesService.getScriptProperties();
  var version = String(properties.getProperty(CACHE_VERSION_PROPERTY) || '').trim();
  if (version) {
    version = syncCacheVersionFromMetaIfNeeded_(version, runtimeCache, properties);
    cacheVersionMemo_ = version;
    runtimeCache.put(CACHE_VERSION_CACHE_KEY, cacheVersionMemo_, CACHE_VERSION_LOOKUP_SECONDS);
    return cacheVersionMemo_;
  }

  const sheetVersion = String(getMetaValue_(PUBLIC_CACHE_VERSION_KEY) || '').trim();
  if (sheetVersion) {
    return setCacheVersion_(sheetVersion, false);
  }

  return setCacheVersion_(String(Date.now()), false);
}

function syncCacheVersionFromMetaIfNeeded_(currentVersion, runtimeCache, properties) {
  if (String(runtimeCache.get(CACHE_VERSION_META_SYNC_KEY) || '').trim()) {
    return currentVersion;
  }

  runtimeCache.put(CACHE_VERSION_META_SYNC_KEY, '1', CACHE_VERSION_META_SYNC_SECONDS);

  const sheetVersion = String(getMetaValue_(PUBLIC_CACHE_VERSION_KEY) || '').trim();
  if (!sheetVersion) {
    return currentVersion;
  }

  if (sheetVersion !== currentVersion) {
    properties.setProperty(CACHE_VERSION_PROPERTY, sheetVersion);
  }

  return sheetVersion;
}

function setCacheVersion_(version, updateMetaSheet) {
  const nextVersion = String(version || '').trim() || String(Date.now());

  cacheVersionMemo_ = nextVersion;
  PropertiesService.getScriptProperties().setProperty(CACHE_VERSION_PROPERTY, cacheVersionMemo_);

  const runtimeCache = CacheService.getScriptCache();
  runtimeCache.put(CACHE_VERSION_CACHE_KEY, cacheVersionMemo_, CACHE_VERSION_LOOKUP_SECONDS);
  runtimeCache.put(CACHE_VERSION_META_SYNC_KEY, '1', CACHE_VERSION_META_SYNC_SECONDS);

  if (updateMetaSheet) {
    setMetaValue_(PUBLIC_CACHE_VERSION_KEY, cacheVersionMemo_);
  }

  return cacheVersionMemo_;
}

function bumpCacheVersion_() {
  return setCacheVersion_(String(Date.now()), true);
}

function getMetaValue_(key) {
  const targetKey = String(key || '').trim();
  if (!targetKey) return '';

  const sheet = getSpreadsheet_().getSheetByName(META_SHEET_NAME);
  if (!sheet) {
    return '';
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return '';
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === targetKey) {
      return String(values[i][1] || '').trim();
    }
  }

  return '';
}

function setMetaValue_(key, value) {
  const targetKey = String(key || '').trim();
  if (!targetKey) return;

  const sheet = getSpreadsheet_().getSheetByName(META_SHEET_NAME);
  if (!sheet) {
    return;
  }

  const lastRow = sheet.getLastRow();
  const rowCount = Math.max(lastRow - 1, 1);
  const values = sheet.getRange(2, 1, rowCount, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === targetKey) {
      sheet.getRange(i + 2, 2).setValue(String(value || '').trim());
      return;
    }
  }

  sheet.appendRow([targetKey, String(value || '').trim()]);
}

function createHeaderLookup_(headers) {
  const lookup = {};

  (headers || []).forEach(function(header, index) {
    const key = String(header || '').trim();
    if (!key || hasOwnProperty_.call(lookup, key)) return;
    lookup[key] = index;
  });

  return lookup;
}

function hasHeader_(lookup, headerName) {
  return hasOwnProperty_.call(lookup || {}, String(headerName || '').trim());
}

function getHeaderIndex_(lookup, headerName, fallbackIndex) {
  return hasHeader_(lookup, headerName) ? lookup[headerName] : fallbackIndex;
}

function normalizeId_(value) {
  return String(value || '').trim().toLowerCase();
}

function toFileRecord_(row, headerLookup) {
  const getValue = function(name, fallbackIndex) {
    const index = getHeaderIndex_(headerLookup, name, fallbackIndex);
    return index >= 0 ? row[index] : '';
  };

  const looksLikeLegacyRow =
    !String(getValue('status', 13) || '').trim() &&
    /^https?:\/\//i.test(String(row[8] || '')) &&
    /^(true|false)$/i.test(String(row[9] || '')) &&
    /^(published|draft)$/i.test(String(row[10] || ''));

  if (looksLikeLegacyRow) {
    return {
      id: String(row[0] || ''),
      brandId: 'huawei',
      brandLabel: 'Huawei',
      categoryId: String(row[1] || ''),
      categoryLabel: String(row[2] || ''),
      title: String(row[3] || ''),
      subtitle: String(row[4] || ''),
      summary: String(row[5] || ''),
      date: '',
      size: String(row[6] || ''),
      visits: '0',
      downloads: '0',
      price: String(row[7] || ''),
      driveUrl: String(row[8] || ''),
      featured: String(row[9] || '').toUpperCase() === 'TRUE',
      status: String(row[10] || ''),
      createdAt: String(row[11] || ''),
      updatedAt: String(row[12] || ''),
    };
  }

  return {
    id: String(getValue('id', 0) || ''),
    brandId: String(getValue('brand_id', 1) || 'huawei'),
    brandLabel: String(getValue('brand_label', 2) || 'Huawei'),
    categoryId: String(getValue('category_id', 3) || getValue('category_id', 1) || ''),
    categoryLabel: String(getValue('category_label', 4) || getValue('category_label', 2) || ''),
    title: String(getValue('title', 5) || getValue('title', 3) || ''),
    subtitle: String(getValue('subtitle', 6) || getValue('subtitle', 4) || ''),
    summary: String(getValue('summary', 7) || getValue('summary', 5) || ''),
    date: String(getValue('date', 8) || getValue('date', 6) || ''),
    size: String(getValue('size', 9) || getValue('size', 7) || ''),
    visits: String(getValue('visits', 10) || getValue('visits', 8) || '0'),
    downloads: String(getValue('downloads', 11) || getValue('downloads', 9) || '0'),
    price: String(getValue('price', 12) || getValue('price', 10) || ''),
    driveUrl: String(getValue('drive_url', 13) || getValue('drive_url', 11) || ''),
    featured: String(getValue('featured', 14) || getValue('featured', 12) || '').toUpperCase() === 'TRUE',
    status: String(getValue('status', 15) || getValue('status', 13) || ''),
    createdAt: String(getValue('created_at', 16) || getValue('created_at', 14) || ''),
    updatedAt: String(getValue('updated_at', 17) || getValue('updated_at', 15) || ''),
  };
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function dedupeBrands_(items) {
  const seen = {};

  return items.filter(function(item) {
    const key = String((item && item.id) || '').trim().toLowerCase();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function dedupeCategories_(items) {
  const seen = {};

  return items.filter(function(item) {
    const brandKey = String((item && item.brandId) || '').trim().toLowerCase();
    const labelKey = String((item && (item.label || item.id)) || '').trim().toLowerCase();
    const key = brandKey + ':' + labelKey;
    if (!labelKey || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function dedupeFiles_(items) {
  const seen = {};

  return items.filter(function(item) {
    const key = String((item && item.id) || '').trim();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

const hasOwnProperty_ = Object.prototype.hasOwnProperty;
