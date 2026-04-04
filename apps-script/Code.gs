const DOWNLOADS_SHEET_NAME = 'Downloads';
const SETTINGS_SHEET_NAME = 'Settings';
const BRANDS_SHEET_NAME = 'Brands';
const BRANDS_HEADERS = ['brand_id', 'brand_label'];
const SETTINGS_HEADERS = ['brand_id', 'brand_label', 'category_id', 'category_label'];

const DOWNLOADS_HEADERS = [
  'id',
  'brand_id',
  'brand_label',
  'category_id',
  'category_label',
  'title',
  'subtitle',
  'summary',
  'date',
  'size',
  'visits',
  'downloads',
  'price',
  'drive_url',
  'featured',
  'status',
  'created_at',
  'updated_at',
];

const DEFAULT_BRANDS = [
  { id: 'huawei', label: 'Huawei' },
  { id: 'honor', label: 'Honor' },
];

const DEFAULT_CATEGORIES = [
  { brandId: 'huawei', brandLabel: 'Huawei', id: 'huawei-removed-id', label: 'Removed ID' },
  { brandId: 'huawei', brandLabel: 'Huawei', id: 'repair-chip-damage', label: 'Repair Chip Damage' },
  { brandId: 'huawei', brandLabel: 'Huawei', id: 'fix-reboot', label: 'Fix Reboot' },
  { brandId: 'huawei', brandLabel: 'Huawei', id: 'xml-qualcomm', label: 'XML Qualcomm' },
  { brandId: 'honor', brandLabel: 'Honor', id: 'honor-removed-id', label: 'Removed ID' },
  { brandId: 'honor', brandLabel: 'Honor', id: 'honor-fix-reboot', label: 'Fix Reboot' },
  { brandId: 'honor', brandLabel: 'Honor', id: 'honor-otg-file', label: 'OTG File' },
  { brandId: 'honor', brandLabel: 'Honor', id: 'honor-repair-imei', label: 'Repair IMEI' },
];

function doGet(e) {
  ensureSchema_();

  if (e && e.parameter && e.parameter.api === '1') {
    return handleApiGet_(e);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('AOSUNLOCKER Admin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getBootstrapData() {
  ensureSchema_();

  return {
    brands: getBrands_(),
    categories: getCategories_(),
    recentFiles: getRecentFiles_(),
    sheetName: DOWNLOADS_SHEET_NAME,
  };
}

function addBrand(payload) {
  ensureSchema_();

  const brandId = String(payload && payload.brandId ? payload.brandId : '')
    .trim()
    .toLowerCase();
  const brandLabel = String(payload && payload.brandLabel ? payload.brandLabel : '').trim();

  if (!brandId) throw new Error('Brand ID is required.');
  if (!brandLabel) throw new Error('Brand label is required.');
  if (!/^[a-z0-9-]+$/.test(brandId)) {
    throw new Error('Brand ID can only contain lowercase letters, numbers, and dashes.');
  }

  const brands = getBrands_();
  const exists = brands.some(function(item) {
    return item.id === brandId;
  });

  if (exists) {
    throw new Error('Brand ID already exists.');
  }

  getBrandsSheet_().appendRow([brandId, brandLabel]);

  return {
    ok: true,
    message: 'Brand created successfully.',
    brands: getBrands_(),
    categories: getCategories_(),
  };
}

function addCategory(payload) {
  ensureSchema_();

  if (!payload) {
    throw new Error('Missing category payload.');
  }

  const brandId = String(payload.brandId || '').trim().toLowerCase();
  const brandLabel = getBrandLabel_(brandId);
  const categoryLabel = String(payload.categoryLabel || '').trim();
  const customCategoryId = String(payload.categoryId || '').trim();

  if (!brandId) throw new Error('Brand is required.');
  if (!categoryLabel) throw new Error('Category label is required.');

  const categoryId = customCategoryId || buildCategoryId_(brandId, categoryLabel);
  const categories = getCategories_();
  const exists = categories.some(function(item) {
    return String(item.id || '').trim() === categoryId;
  });

  if (exists) {
    throw new Error('Category ID already exists.');
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  sheet.appendRow([brandId, brandLabel, categoryId, categoryLabel]);

  return {
    ok: true,
    message: 'Category created successfully.',
    brands: getBrands_(),
    categories: getCategories_(),
  };
}

function updateCategory(payload) {
  ensureSchema_();

  if (!payload) {
    throw new Error('Missing category payload.');
  }

  const originalCategoryId = String(payload.originalCategoryId || '').trim();
  const brandId = String(payload.brandId || '').trim().toLowerCase();
  const brandLabel = getBrandLabel_(brandId);
  const categoryLabel = String(payload.categoryLabel || '').trim();
  const customCategoryId = String(payload.categoryId || '').trim();

  if (!originalCategoryId) throw new Error('Original category ID is missing.');
  if (!brandId) throw new Error('Brand is required.');
  if (!categoryLabel) throw new Error('Category label is required.');

  const nextCategoryId = customCategoryId || buildCategoryId_(brandId, categoryLabel);
  const settingsSheet = getSettingsSheet_();
  const values = settingsSheet.getDataRange().getValues();
  const rowIndex = values.findIndex(function(row, index) {
    if (index === 0) return false;
    return String(row[2] || row[0] || '').trim() === originalCategoryId;
  });

  if (rowIndex === -1) {
    throw new Error('Category row not found.');
  }

  const categories = getCategories_();
  const duplicate = categories.some(function(item) {
    return item.id === nextCategoryId && item.id !== originalCategoryId;
  });

  if (duplicate) {
    throw new Error('Category ID already exists.');
  }

  settingsSheet.getRange(rowIndex + 1, 1, 1, 4).setValues([[brandId, brandLabel, nextCategoryId, categoryLabel]]);
  syncDownloadsCategoryUpdate_(originalCategoryId, nextCategoryId, categoryLabel, brandId, brandLabel);

  return {
    ok: true,
    message: 'Category updated successfully.',
    brands: getBrands_(),
    categories: getCategories_(),
  };
}

function deleteCategory(categoryId) {
  ensureSchema_();

  const targetId = String(categoryId || '').trim();
  if (!targetId) {
    throw new Error('Category ID is missing.');
  }

  const settingsSheet = getSettingsSheet_();
  const values = settingsSheet.getDataRange().getValues();
  const rowIndex = values.findIndex(function(row, index) {
    if (index === 0) return false;
    return String(row[2] || row[0] || '').trim() === targetId;
  });

  if (rowIndex === -1) {
    throw new Error('Category row not found.');
  }

  const hasLinkedFiles = hasFilesForCategory_(targetId);

  if (hasLinkedFiles) {
    throw new Error('This category still has files. Move or remove those files first.');
  }

  settingsSheet.deleteRow(rowIndex + 1);

  return {
    ok: true,
    message: 'Category deleted successfully.',
    brands: getBrands_(),
    categories: getCategories_(),
  };
}

function deleteDownloadFile(fileId) {
  ensureSchema_();

  const targetId = String(fileId || '').trim();
  if (!targetId) {
    throw new Error('File ID is missing.');
  }

  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex(function(row, index) {
    return index > 0 && String(row[0] || '').trim() === targetId;
  });

  if (rowIndex === -1) {
    throw new Error('File row was not found.');
  }

  sheet.deleteRow(rowIndex + 1);

  return {
    ok: true,
    message: 'File deleted successfully.',
    recentFiles: getRecentFiles_(),
  };
}

function handleApiGet_(e) {
  const view = String((e.parameter && e.parameter.view) || 'catalog');

  if (view === 'categories') {
    return jsonOutput_({
      ok: true,
      categories: getCategories_(),
    });
  }

  if (view === 'files') {
    const categoryId = String((e.parameter && e.parameter.category) || '').trim();
    return jsonOutput_({
      ok: true,
      categoryId: categoryId,
      files: getPublishedFiles_(categoryId),
    });
  }

  if (view === 'file') {
    const fileId = String((e.parameter && e.parameter.id) || '').trim();
    const file = getPublishedFileById_(fileId);
    return jsonOutput_({
      ok: !!file,
      file: file,
    });
  }

  return jsonOutput_({
    ok: true,
    categories: getCategories_(),
    files: getPublishedFiles_(''),
  });
}

function getDriveFileMeta(driveUrl) {
  ensureSchema_();

  const fileId = extractDriveFileId_(String(driveUrl || '').trim());
  if (!fileId) {
    throw new Error('Google Drive link could not be read.');
  }

  const file = DriveApp.getFileById(fileId);

  return {
    id: file.getId(),
    name: file.getName(),
    size: formatBytes_(file.getSize()),
    url: file.getUrl(),
  };
}

function addDownloadFile(payload) {
  ensureSchema_();

  const clean = sanitizePayload_(payload);
  const now = new Date().toISOString();
  const row = [
    clean.id,
    clean.brandId,
    clean.brandLabel,
    clean.categoryId,
    clean.categoryLabel,
    clean.title,
    clean.subtitle,
    clean.summary,
    clean.date,
    clean.size,
    clean.visits,
    clean.downloads,
    clean.price,
    clean.driveUrl,
    clean.featured ? 'TRUE' : 'FALSE',
    clean.status,
    now,
    now,
  ];

  const sheet = getDownloadsSheet_();
  sheet.appendRow(row);

  return {
    ok: true,
    message: 'File saved successfully.',
    file: toFileRecord_(row),
    recentFiles: getRecentFiles_(),
  };
}

function updateDownloadFile(payload) {
  ensureSchema_();

  const originalId = String(payload && payload.originalId ? payload.originalId : '').trim();
  if (!originalId) {
    throw new Error('Original file ID is missing.');
  }

  const clean = sanitizePayload_(payload);
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex(function(row, index) {
    return index > 0 && String(row[0] || '').trim() === originalId;
  });

  if (rowIndex === -1) {
    throw new Error('File row was not found.');
  }

  const existing = values[rowIndex];
  const legacyRow = isLegacyRow_(existing);
  const createdAt = legacyRow ? existing[11] || new Date().toISOString() : existing[14] || new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const row = [
    clean.id,
    clean.brandId,
    clean.brandLabel,
    clean.categoryId,
    clean.categoryLabel,
    clean.title,
    clean.subtitle,
    clean.summary,
    clean.date,
    clean.size,
    clean.visits,
    clean.downloads,
    clean.price,
    clean.driveUrl,
    clean.featured ? 'TRUE' : 'FALSE',
    clean.status,
    createdAt,
    updatedAt,
  ];

  sheet.getRange(rowIndex + 1, 1, 1, row.length).setValues([row]);

  return {
    ok: true,
    message: 'File updated successfully.',
    file: toFileRecord_(row),
    recentFiles: getRecentFiles_(),
  };
}

function ensureSchema_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const brandsSheet = getOrCreateSheet_(spreadsheet, BRANDS_SHEET_NAME);
  const settingsSheet = getOrCreateSheet_(spreadsheet, SETTINGS_SHEET_NAME);
  const downloadsSheet = getOrCreateSheet_(spreadsheet, DOWNLOADS_SHEET_NAME);

  ensureHeaders_(brandsSheet, BRANDS_HEADERS);
  ensureHeaders_(downloadsSheet, DOWNLOADS_HEADERS);

  if (brandsSheet.getLastRow() === 1) {
    const brandRows = DEFAULT_BRANDS.map(function(item) {
      return [item.id, item.label];
    });
    brandsSheet.getRange(2, 1, brandRows.length, BRANDS_HEADERS.length).setValues(brandRows);
  } else {
    ensureDefaultBrands_(brandsSheet);
  }

  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.getRange(1, 1, 1, SETTINGS_HEADERS.length).setValues([SETTINGS_HEADERS]);
  } else {
    migrateLegacySettingsSheet_(settingsSheet);
    ensureHeaders_(settingsSheet, SETTINGS_HEADERS);
  }

  if (settingsSheet.getLastRow() === 1) {
    const rows = DEFAULT_CATEGORIES.map((item) => [item.brandId, item.brandLabel, item.id, item.label]);
    settingsSheet.getRange(2, 1, rows.length, 4).setValues(rows);
  } else {
    ensureDefaultCategories_(settingsSheet);
  }
}

function getCategories_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const hasBrandColumns = headers.indexOf('brand_id') >= 0;

  return values
    .slice(1)
    .map(function(row) {
      if (hasBrandColumns && row[0] && row[2] && row[3]) {
        return {
          brandId: String(row[0]).trim(),
          brandLabel: String(row[1]).trim(),
          id: String(row[2]).trim(),
          label: String(row[3]).trim(),
        };
      }

      if (row[0] && row[1]) {
        return {
          brandId: 'huawei',
          brandLabel: 'Huawei',
          id: String(row[0]).trim(),
          label: String(row[1]).trim(),
        };
      }

      return null;
    })
    .filter(function(item) {
      return item && item.id && item.label;
    });
}

function getBrands_() {
  const sheet = getBrandsSheet_();
  const values = sheet.getDataRange().getValues();

  return values
    .slice(1)
    .map(function(row) {
      return {
        id: String(row[0] || '').trim(),
        label: String(row[1] || '').trim(),
      };
    })
    .filter(function(item) {
      return item.id && item.label;
    });
}

function getRecentFiles_() {
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];

  return values
    .slice(1)
    .filter((row) => row[0])
    .map((row) => toFileRecord_(row, headers))
    .reverse()
    .slice(0, 12);
}

function syncDownloadsCategoryUpdate_(originalCategoryId, nextCategoryId, categoryLabel, brandId, brandLabel) {
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const categoryIdIndex = headers.indexOf('category_id') >= 0 ? headers.indexOf('category_id') : 3;
  const categoryLabelIndex = headers.indexOf('category_label') >= 0 ? headers.indexOf('category_label') : 4;
  const brandIdIndex = headers.indexOf('brand_id') >= 0 ? headers.indexOf('brand_id') : 1;
  const brandLabelIndex = headers.indexOf('brand_label') >= 0 ? headers.indexOf('brand_label') : 2;
  const updatedAtIndex = headers.indexOf('updated_at') >= 0 ? headers.indexOf('updated_at') : 17;

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][categoryIdIndex] || '').trim() !== originalCategoryId) continue;

    sheet.getRange(i + 1, categoryIdIndex + 1).setValue(nextCategoryId);
    sheet.getRange(i + 1, categoryLabelIndex + 1).setValue(categoryLabel);
    sheet.getRange(i + 1, brandIdIndex + 1).setValue(brandId);
    sheet.getRange(i + 1, brandLabelIndex + 1).setValue(brandLabel);
    if (updatedAtIndex >= 0) {
      sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date().toISOString());
    }
  }
}

function hasFilesForCategory_(categoryId) {
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const categoryIdIndex = headers.indexOf('category_id') >= 0 ? headers.indexOf('category_id') : 3;

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0] || '').trim() && String(values[i][categoryIdIndex] || '').trim() === categoryId) {
      return true;
    }
  }

  return false;
}

function getPublishedFiles_(categoryId) {
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();

  return values
    .slice(1)
    .filter((row) => row[0])
    .map(toFileRecord_)
    .filter(function(file) {
      const isPublished = String(file.status || '').toLowerCase() === 'published';
      const matchesCategory = !categoryId || file.categoryId === categoryId;
      return isPublished && matchesCategory;
    });
}

function getPublishedFileById_(fileId) {
  if (!fileId) return null;

  const files = getPublishedFiles_('');
  return files.find(function(file) {
    return file.id === fileId;
  }) || null;
}

function sanitizePayload_(payload) {
  if (!payload) {
    throw new Error('Missing payload.');
  }

  const categoryId = String(payload.categoryId || '').trim();
  const brandId = String(payload.brandId || '').trim().toLowerCase();
  const title = String(payload.title || '').trim();
  const subtitle = String(payload.subtitle || '').trim();
  const summary = String(payload.summary || '').trim();
  const date = String(payload.date || '').trim();
  const size = String(payload.size || '').trim();
  const visits = String(payload.visits || '').trim();
  const downloads = String(payload.downloads || '').trim();
  const price = String(payload.price || '').trim();
  const driveUrl = String(payload.driveUrl || '').trim();
  const status = String(payload.status || 'draft').trim().toLowerCase();
  const featured = payload.featured === true;

  if (!brandId) throw new Error('Brand is required.');
  if (!categoryId) throw new Error('Category is required.');
  if (!title) throw new Error('Title is required.');
  if (!driveUrl) throw new Error('Google Drive link is required.');

  const category = getCategories_().find((item) => item.id === categoryId && item.brandId === brandId);
  if (!category) throw new Error('Selected category is not registered.');

  const driveMeta = getDriveMetaSafe_(driveUrl);

  return {
    id: buildId_(categoryId, title),
    brandId: category.brandId,
    brandLabel: category.brandLabel,
    categoryId: category.id,
    categoryLabel: category.label,
    title: title,
    subtitle: subtitle || driveMeta.name || title,
    summary: summary || subtitle || driveMeta.name || title,
    date: date || formatDateDisplay_(new Date()),
    size: size || driveMeta.size || '-',
    visits: visits || '0',
    downloads: downloads || '0',
    price: price || 'Free',
    driveUrl: driveMeta.url || driveUrl,
    featured: featured,
    status: status || 'draft',
  };
}

function toFileRecord_(row, headers) {
  const safeHeaders = headers || [];
  const isBrandedSchema = safeHeaders.indexOf('brand_id') >= 0 || row.length >= 18;
  const getValue = function(name, fallbackIndex) {
    const headerIndex = safeHeaders.indexOf(name);
    const index = headerIndex >= 0 ? headerIndex : fallbackIndex;
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
    brandId: String(getValue('brand_id', isBrandedSchema ? 1 : -1) || 'huawei'),
    brandLabel: String(getValue('brand_label', isBrandedSchema ? 2 : -1) || 'Huawei'),
    categoryId: String(getValue('category_id', isBrandedSchema ? 3 : 1) || ''),
    categoryLabel: String(getValue('category_label', isBrandedSchema ? 4 : 2) || ''),
    title: String(getValue('title', isBrandedSchema ? 5 : 3) || ''),
    subtitle: String(getValue('subtitle', isBrandedSchema ? 6 : 4) || ''),
    summary: String(getValue('summary', isBrandedSchema ? 7 : 5) || ''),
    date: String(getValue('date', isBrandedSchema ? 8 : 6) || ''),
    size: String(getValue('size', isBrandedSchema ? 9 : 7) || ''),
    visits: String(getValue('visits', isBrandedSchema ? 10 : 8) || '0'),
    downloads: String(getValue('downloads', isBrandedSchema ? 11 : 9) || '0'),
    price: String(getValue('price', isBrandedSchema ? 12 : 10) || ''),
    driveUrl: String(getValue('drive_url', isBrandedSchema ? 13 : 11) || ''),
    featured: String(getValue('featured', isBrandedSchema ? 14 : 12) || '').toUpperCase() === 'TRUE',
    status: String(getValue('status', isBrandedSchema ? 15 : 13) || ''),
    createdAt: String(getValue('created_at', isBrandedSchema ? 16 : 14) || ''),
    updatedAt: String(getValue('updated_at', isBrandedSchema ? 17 : 15) || ''),
  };
}

function buildId_(categoryId, title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return categoryId + '-' + base;
}

function buildCategoryId_(brandId, categoryLabel) {
  const base = String(categoryLabel || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return brandId === 'huawei' && (base === 'fix-reboot' || base === 'repair-chip-damage' || base === 'xml-qualcomm')
    ? base
    : brandId + '-' + base;
}

function getBrandLabel_(brandId) {
  const brands = getBrands_();
  const found = brands.find(function(item) {
    return item.id === brandId;
  });

  return found ? found.label : brandId;
}

function getDriveMetaSafe_(driveUrl) {
  const fileId = extractDriveFileId_(driveUrl);
  if (!fileId) {
    return {
      name: '',
      size: '',
      url: driveUrl,
    };
  }

  try {
    const file = DriveApp.getFileById(fileId);
    return {
      name: file.getName(),
      size: formatBytes_(file.getSize()),
      url: file.getUrl(),
    };
  } catch (error) {
    return {
      name: '',
      size: '',
      url: driveUrl,
    };
  }
}

function extractDriveFileId_(driveUrl) {
  if (!driveUrl) return '';

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (var i = 0; i < patterns.length; i += 1) {
    const match = driveUrl.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
}

function formatBytes_(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes || 0);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value = value / 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 ? 0 : 2;
  return value.toFixed(decimals) + ' ' + units[unitIndex];
}

function formatDateDisplay_(date) {
  const day = ('0' + date.getDate()).slice(-2);
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const year = date.getFullYear();
  return day + '-' + month + '-' + year;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDownloadsSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DOWNLOADS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Downloads sheet is missing.');
  }
  return sheet;
}

function getSettingsSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Settings sheet is missing.');
  }
  return sheet;
}

function getBrandsSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BRANDS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Brands sheet is missing.');
  }
  return sheet;
}

function migrateLegacySettingsSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return;

  const headers = values[0] || [];
  const isLegacyHeader =
    headers[0] === 'category_id' &&
    headers[1] === 'category_label' &&
    headers[2] !== 'category_id';

  if (!isLegacyHeader) return;

  const migratedRows = values
    .slice(1)
    .filter(function(row) {
      return row[0] && row[1];
    })
    .map(function(row) {
      return ['huawei', 'Huawei', row[0], row[1]];
    });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, SETTINGS_HEADERS.length).setValues([SETTINGS_HEADERS]);

  if (migratedRows.length) {
    sheet.getRange(2, 1, migratedRows.length, SETTINGS_HEADERS.length).setValues(migratedRows);
  }
}

function ensureDefaultCategories_(sheet) {
  const values = sheet.getDataRange().getValues();
  const existingIds = values
    .slice(1)
    .map(function(row) {
      return String(row[2] || '').trim();
    })
    .filter(function(id) {
      return id;
    });

  const missingRows = DEFAULT_CATEGORIES
    .filter(function(item) {
      return existingIds.indexOf(item.id) === -1;
    })
    .map(function(item) {
      return [item.brandId, item.brandLabel, item.id, item.label];
    });

  if (!missingRows.length) return;

  sheet.getRange(sheet.getLastRow() + 1, 1, missingRows.length, SETTINGS_HEADERS.length).setValues(missingRows);
}

function ensureDefaultBrands_(sheet) {
  const values = sheet.getDataRange().getValues();
  const existingIds = values
    .slice(1)
    .map(function(row) {
      return String(row[0] || '').trim();
    })
    .filter(function(id) {
      return id;
    });

  const missingRows = DEFAULT_BRANDS
    .filter(function(item) {
      return existingIds.indexOf(item.id) === -1;
    })
    .map(function(item) {
      return [item.id, item.label];
    });

  if (!missingRows.length) return;

  sheet.getRange(sheet.getLastRow() + 1, 1, missingRows.length, BRANDS_HEADERS.length).setValues(missingRows);
}

function getOrCreateSheet_(spreadsheet, name) {
  const existing = spreadsheet.getSheetByName(name);
  return existing || spreadsheet.insertSheet(name);
}

function isLegacyRow_(row) {
  return Array.isArray(row) && row.length < DOWNLOADS_HEADERS.length;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsUpdate = headers.some(function(header, index) {
    return currentHeaders[index] !== header;
  });

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}
