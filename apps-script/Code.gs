const DOWNLOADS_SHEET_NAME = 'Downloads';
const SETTINGS_SHEET_NAME = 'Settings';
const BRANDS_SHEET_NAME = 'Brands';
const META_SHEET_NAME = 'Meta';
const BRANDS_HEADERS = ['brand_id', 'brand_label'];
const SETTINGS_HEADERS = ['brand_id', 'brand_label', 'category_id', 'category_label', 'parent_category_id'];
const META_HEADERS = ['key', 'value'];
const PUBLIC_CACHE_VERSION_KEY = 'public_cache_version';
const LAST_ADMIN_UPDATE_KEY = 'last_admin_update';
const PUBLIC_REFRESH_URL_PROPERTY = 'AOSUNLOCKER_PUBLIC_REFRESH_URL';
const DEFAULT_PUBLIC_REFRESH_URL = 'https://script.google.com/macros/s/AKfycbxw9cz3qQ3KMozWE6YtYZ4rhVow8tj-XntjY8RrS7VTgC7_f-H7Jkobj9FIqlVM5I7Z/exec';

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
  { brandId: 'huawei', brandLabel: 'Huawei', id: 'huawei-removed-id', label: 'Removed ID', parentCategoryId: '' },
  { brandId: 'huawei', brandLabel: 'Huawei', id: 'repair-chip-damage', label: 'Repair Chip Damage', parentCategoryId: '' },
  { brandId: 'huawei', brandLabel: 'Huawei', id: 'fix-reboot', label: 'Fix Reboot', parentCategoryId: '' },
  { brandId: 'huawei', brandLabel: 'Huawei', id: 'xml-qualcomm', label: 'XML Qualcomm', parentCategoryId: '' },
  { brandId: 'honor', brandLabel: 'Honor', id: 'honor-removed-id', label: 'Removed ID', parentCategoryId: '' },
  { brandId: 'honor', brandLabel: 'Honor', id: 'honor-fix-reboot', label: 'Fix Reboot', parentCategoryId: '' },
  { brandId: 'honor', brandLabel: 'Honor', id: 'honor-otg-file', label: 'OTG File', parentCategoryId: '' },
  { brandId: 'honor', brandLabel: 'Honor', id: 'honor-repair-imei', label: 'Repair IMEI', parentCategoryId: '' },
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
    lastPublicRefresh: getMetaValue_(LAST_ADMIN_UPDATE_KEY),
  };
}

function runIntegrityScan() {
  ensureSchema_();

  const brandsSheet = getBrandsSheet_();
  const settingsSheet = getSettingsSheet_();
  const downloadsSheet = getDownloadsSheet_();

  const brandRows = brandsSheet.getDataRange().getValues().slice(1);
  const categoryValues = settingsSheet.getDataRange().getValues();
  const categoryHeaders = categoryValues[0] || [];
  const categoryRows = categoryValues.slice(1);
  const downloadValues = downloadsSheet.getDataRange().getValues();
  const downloadHeaders = downloadValues[0] || [];
  const downloadRows = downloadValues.slice(1);
  const hasBrandColumns = categoryHeaders.indexOf('brand_id') >= 0;

  const issues = [];
  let fixableCategoryRows = 0;
  const addIssue = function(level, title, detail, meta) {
    const safeMeta = meta || {};
    if (safeMeta.fixableCategoryRow) {
      fixableCategoryRows += 1;
    }

    issues.push({
      level: level === 'critical' ? 'critical' : 'warning',
      title: String(title || '').trim() || 'Integrity issue',
      detail: String(detail || '').trim() || 'Please review this row.',
      code: String(safeMeta.code || '').trim(),
      fixableCategoryRow: Boolean(safeMeta.fixableCategoryRow),
    });
  };

  const brandRegistry = {};
  brandRows.forEach(function(row, index) {
    const rowNumber = index + 2;
    const brandId = String(row[0] || '').trim().toLowerCase();
    const brandLabel = String(row[1] || '').trim();

    if (!brandId && !brandLabel) return;

    if (!brandId || !brandLabel) {
      addIssue('warning', 'Incomplete brand row', 'Brand row ' + rowNumber + ' is missing ID or label.');
      return;
    }

    if (!brandRegistry[brandId]) {
      brandRegistry[brandId] = {
        label: brandLabel,
        rows: [rowNumber],
      };
      return;
    }

    brandRegistry[brandId].rows.push(rowNumber);
    if (brandRegistry[brandId].label !== brandLabel) {
      addIssue(
        'warning',
        'Brand label mismatch',
        'Brand "' + brandId + '" uses different labels in rows ' + brandRegistry[brandId].rows.join(', ') + '.',
      );
    }
  });

  Object.keys(brandRegistry).forEach(function(brandId) {
    if (brandRegistry[brandId].rows.length > 1) {
      addIssue(
        'critical',
        'Duplicate brand ID',
        'Brand "' + brandId + '" appears more than once in rows ' + brandRegistry[brandId].rows.join(', ') + '.',
      );
    }
  });

  const categoryRegistry = {};
  categoryRows.forEach(function(row, index) {
    const rowNumber = index + 2;
    const brandId = String(hasBrandColumns ? row[0] : 'huawei').trim().toLowerCase();
    const brandLabel = String(hasBrandColumns ? row[1] : 'Huawei').trim();
    const categoryId = String(hasBrandColumns ? row[2] : row[0] || '').trim();
    const categoryLabel = String(hasBrandColumns ? row[3] : row[1] || '').trim();
    const parentCategoryId = String(hasBrandColumns ? row[4] || '' : '').trim();

    if (!brandId && !categoryId && !categoryLabel && !parentCategoryId) return;

    if (!brandId || !categoryId || !categoryLabel) {
      addIssue(
        'warning',
        'Incomplete category row',
        'Category row ' + rowNumber + ' is missing brand, ID, or label.',
        { code: 'incomplete_category_row', fixableCategoryRow: true },
      );
      return;
    }

    if (parentCategoryId && parentCategoryId === categoryId) {
      addIssue(
        'critical',
        'Category points to itself',
        'Category "' + categoryLabel + '" in row ' + rowNumber + ' uses itself as the parent folder.',
      );
    }

    if (!brandRegistry[brandId]) {
      addIssue(
        'critical',
        'Category points to missing brand',
        'Category "' + categoryLabel + '" in row ' + rowNumber + ' uses unknown brand "' + brandId + '".',
      );
    } else if (brandLabel && brandRegistry[brandId].label !== brandLabel) {
      addIssue(
        'warning',
        'Category brand label mismatch',
        'Category "' + categoryLabel + '" in row ' + rowNumber + ' stores brand label "' + brandLabel + '" but brand "' + brandId + '" is "' + brandRegistry[brandId].label + '".',
      );
    }

    if (!categoryRegistry[categoryId]) {
      categoryRegistry[categoryId] = {
        brandId: brandId,
        label: categoryLabel,
        rows: [rowNumber],
        parentCategoryId: parentCategoryId,
      };
      return;
    }

    categoryRegistry[categoryId].rows.push(rowNumber);
    if (categoryRegistry[categoryId].brandId !== brandId) {
      addIssue(
        'critical',
        'Duplicate category ID across brands',
        'Category ID "' + categoryId + '" is reused by "' + categoryRegistry[categoryId].brandId + '" and "' + brandId + '" in rows ' + categoryRegistry[categoryId].rows.join(', ') + '.',
      );
    } else {
      addIssue(
        'critical',
        'Duplicate category ID',
        'Category ID "' + categoryId + '" appears more than once in rows ' + categoryRegistry[categoryId].rows.join(', ') + '.',
      );
    }

    if (categoryRegistry[categoryId].label !== categoryLabel) {
      addIssue(
        'warning',
        'Category label mismatch',
        'Category ID "' + categoryId + '" stores different labels in rows ' + categoryRegistry[categoryId].rows.join(', ') + '.',
      );
    }

    if (categoryRegistry[categoryId].parentCategoryId !== parentCategoryId) {
      addIssue(
        'warning',
        'Category parent mismatch',
        'Category ID "' + categoryId + '" stores different parent folders in rows ' + categoryRegistry[categoryId].rows.join(', ') + '.',
      );
    }
  });

  Object.keys(categoryRegistry).forEach(function(categoryId) {
    const category = categoryRegistry[categoryId];
    if (!category || !category.parentCategoryId) return;

    const parentCategory = categoryRegistry[category.parentCategoryId];
    if (!parentCategory) {
      addIssue(
        'critical',
        'Category points to missing parent',
        'Folder "' + category.label + '" points to missing parent "' + category.parentCategoryId + '".',
      );
      return;
    }

    if (parentCategory.brandId !== category.brandId) {
      addIssue(
        'critical',
        'Parent folder brand mismatch',
        'Folder "' + category.label + '" belongs to "' + category.brandId + '" but parent "' + parentCategory.label + '" belongs to "' + parentCategory.brandId + '".',
      );
    }
  });

  Object.keys(categoryRegistry).forEach(function(categoryId) {
    const category = categoryRegistry[categoryId];
    if (!category || !category.parentCategoryId) return;

    if (hasCategoryCycleInRegistry_(categoryId, categoryRegistry)) {
      addIssue(
        'critical',
        'Folder loop detected',
        'Folder "' + category.label + '" creates a circular parent chain. Review the parent folder links.',
      );
    }
  });

  const fileRegistry = {};
  downloadRows.forEach(function(row, index) {
    const rowNumber = index + 2;
    if (!String(row[0] || '').trim()) return;

    const file = toFileRecord_(row, downloadHeaders);
    const fileId = String(file.id || '').trim();
    const fileTitle = String(file.title || file.subtitle || fileId || 'Untitled file').trim();
    const fileBrandId = String(file.brandId || '').trim().toLowerCase();
    const fileCategoryId = String(file.categoryId || '').trim();
    const category = categoryRegistry[fileCategoryId];

    if (!fileId) {
      addIssue('warning', 'File row missing ID', 'File row ' + rowNumber + ' has no generated file ID.');
      return;
    }

    if (!fileRegistry[fileId]) {
      fileRegistry[fileId] = {
        rows: [rowNumber],
      };
    } else {
      fileRegistry[fileId].rows.push(rowNumber);
    }

    if (!brandRegistry[fileBrandId]) {
      addIssue(
        'critical',
        'File points to missing brand',
        'File "' + fileTitle + '" in row ' + rowNumber + ' uses unknown brand "' + fileBrandId + '".',
      );
    }

    if (!category) {
      addIssue(
        'critical',
        'File points to missing category',
        'File "' + fileTitle + '" in row ' + rowNumber + ' uses unknown category "' + fileCategoryId + '".',
      );
    } else {
      if (category.brandId !== fileBrandId) {
        addIssue(
          'critical',
          'File brand/category mismatch',
          'File "' + fileTitle + '" in row ' + rowNumber + ' uses brand "' + fileBrandId + '" but category "' + fileCategoryId + '" belongs to "' + category.brandId + '".',
        );
      }

      if (String(file.categoryLabel || '').trim() && String(file.categoryLabel || '').trim() !== category.label) {
        addIssue(
          'warning',
          'File category label mismatch',
          'File "' + fileTitle + '" in row ' + rowNumber + ' stores category label "' + file.categoryLabel + '" but the folder is "' + category.label + '".',
        );
      }
    }

    if (brandRegistry[fileBrandId] && String(file.brandLabel || '').trim() && String(file.brandLabel || '').trim() !== brandRegistry[fileBrandId].label) {
      addIssue(
        'warning',
        'File brand label mismatch',
        'File "' + fileTitle + '" in row ' + rowNumber + ' stores brand label "' + file.brandLabel + '" but the brand label is "' + brandRegistry[fileBrandId].label + '".',
      );
    }

    if (!String(file.driveUrl || '').trim()) {
      addIssue('warning', 'File missing Drive link', 'File "' + fileTitle + '" in row ' + rowNumber + ' has no Google Drive link.');
    }

    if (!String(file.title || '').trim()) {
      addIssue('warning', 'File missing title', 'File row ' + rowNumber + ' has an empty title.');
    }
  });

  Object.keys(fileRegistry).forEach(function(fileId) {
    if (fileRegistry[fileId].rows.length > 1) {
      addIssue(
        'critical',
        'Duplicate file ID',
        'File ID "' + fileId + '" appears more than once in rows ' + fileRegistry[fileId].rows.join(', ') + '.',
      );
    }
  });

  const sortedIssues = issues.sort(function(left, right) {
    if (left.level === right.level) return left.title.localeCompare(right.title);
    return left.level === 'critical' ? -1 : 1;
  });

  const criticalCount = sortedIssues.filter(function(issue) {
    return issue.level === 'critical';
  }).length;
  const warningCount = sortedIssues.length - criticalCount;

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    status: criticalCount ? 'critical' : warningCount ? 'warning' : 'clean',
    summary: {
      brands: Object.keys(brandRegistry).length,
      categories: Object.keys(categoryRegistry).length,
      files: downloadRows.filter(function(row) {
        return Boolean(String(row[0] || '').trim());
      }).length,
      critical: criticalCount,
      warning: warningCount,
      fixableCategoryRows: fixableCategoryRows,
      totalIssues: sortedIssues.length,
    },
    issues: sortedIssues.slice(0, 18),
  };
}

function repairIncompleteCategoryRows() {
  ensureSchema_();

  const settingsSheet = getSettingsSheet_();
  const values = settingsSheet.getDataRange().getValues();
  if (!values.length) {
    return {
      ok: true,
      removed: 0,
      message: 'Settings sheet is already clean.',
      brands: getBrands_(),
      categories: getCategories_(),
      recentFiles: getRecentFiles_(),
      report: runIntegrityScan(),
    };
  }

  const rowIndexes = [];
  values.slice(1).forEach(function(row, index) {
    const brandId = String(row[0] || '').trim();
    const brandLabel = String(row[1] || '').trim();
    const categoryId = String(row[2] || '').trim();
    const categoryLabel = String(row[3] || '').trim();
    const filledCount = [brandId, brandLabel, categoryId, categoryLabel].filter(function(item) {
      return Boolean(item);
    }).length;

    if (filledCount > 0 && filledCount < 4) {
      rowIndexes.push(index + 2);
    }
  });

  if (!rowIndexes.length) {
    return {
      ok: true,
      removed: 0,
      message: 'No incomplete folder rows were found.',
      brands: getBrands_(),
      categories: getCategories_(),
      recentFiles: getRecentFiles_(),
      report: runIntegrityScan(),
    };
  }

  rowIndexes
    .slice()
    .sort(function(left, right) {
      return right - left;
    })
    .forEach(function(rowIndex) {
      settingsSheet.deleteRow(rowIndex);
    });

  ensureSchema_();
  touchPublicCacheVersion_();

  return {
    ok: true,
    removed: rowIndexes.length,
    message: rowIndexes.length === 1
      ? 'Removed 1 incomplete folder row.'
      : 'Removed ' + rowIndexes.length + ' incomplete folder rows.',
    brands: getBrands_(),
    categories: getCategories_(),
    recentFiles: getRecentFiles_(),
    report: runIntegrityScan(),
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
  touchPublicCacheVersion_();

  return {
    ok: true,
    message: 'Brand created successfully.',
    brands: getBrands_(),
    categories: getCategories_(),
  };
}

function updateBrand(payload) {
  ensureSchema_();

  if (!payload) {
    throw new Error('Missing brand payload.');
  }

  const originalBrandId = String(payload.originalBrandId || '').trim().toLowerCase();
  const brandLabel = String(payload.brandLabel || '').trim();

  if (!originalBrandId) throw new Error('Original brand ID is missing.');
  if (!brandLabel) throw new Error('Brand label is required.');

  const brandsSheet = getBrandsSheet_();
  const values = brandsSheet.getDataRange().getValues();
  const rowIndex = values.findIndex(function(row, index) {
    if (index === 0) return false;
    return String(row[0] || '').trim().toLowerCase() === originalBrandId;
  });

  if (rowIndex === -1) {
    throw new Error('Brand row not found.');
  }

  brandsSheet.getRange(rowIndex + 1, 1, 1, 2).setValues([[originalBrandId, brandLabel]]);
  syncSettingsBrandUpdate_(originalBrandId, originalBrandId, brandLabel);
  syncDownloadsBrandUpdate_(originalBrandId, originalBrandId, brandLabel);
  touchPublicCacheVersion_();

  return {
    ok: true,
    message: 'Brand updated successfully.',
    brands: getBrands_(),
    categories: getCategories_(),
    recentFiles: getRecentFiles_(),
  };
}

function deleteBrand(brandId) {
  ensureSchema_();

  const targetId = String(brandId || '').trim().toLowerCase();
  if (!targetId) {
    throw new Error('Brand ID is missing.');
  }

  const brandsSheet = getBrandsSheet_();
  const values = brandsSheet.getDataRange().getValues();
  const rowIndex = values.findIndex(function(row, index) {
    if (index === 0) return false;
    return String(row[0] || '').trim().toLowerCase() === targetId;
  });

  if (rowIndex === -1) {
    throw new Error('Brand row not found.');
  }

  const categoryCount = countCategoriesForBrand_(targetId);
  const fileCount = countFilesForBrand_(targetId);
  if (categoryCount || fileCount) {
    throw new Error(
      'This brand still has ' + categoryCount + ' categories and ' + fileCount + ' files. Remove or move them first.'
    );
  }

  brandsSheet.deleteRow(rowIndex + 1);
  touchPublicCacheVersion_();

  return {
    ok: true,
    message: 'Brand deleted successfully.',
    brands: getBrands_(),
    categories: getCategories_(),
    recentFiles: getRecentFiles_(),
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
  const parentCategoryId = String(payload.parentCategoryId || '').trim();

  if (!brandId) throw new Error('Brand is required.');
  if (!categoryLabel) throw new Error('Category label is required.');

  const categoryId = customCategoryId || buildCategoryId_(brandId, categoryLabel, parentCategoryId);
  const categories = getCategories_();
  const exists = categories.some(function(item) {
    return String(item.id || '').trim() === categoryId;
  });

  if (exists) {
    throw new Error('Category ID already exists.');
  }

  if (parentCategoryId) {
    const parentCategory = categories.find(function(item) {
      return String(item.id || '').trim() === parentCategoryId;
    });

    if (!parentCategory) {
      throw new Error('Parent folder was not found.');
    }

    if (String(parentCategory.brandId || '').trim().toLowerCase() !== brandId) {
      throw new Error('Parent folder belongs to a different brand.');
    }

    if (parentCategoryId === categoryId) {
      throw new Error('Folder cannot be its own parent.');
    }
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  sheet.appendRow([brandId, brandLabel, categoryId, categoryLabel, parentCategoryId]);
  touchPublicCacheVersion_();

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
  const parentCategoryId = String(payload.parentCategoryId || '').trim();

  if (!originalCategoryId) throw new Error('Original category ID is missing.');
  if (!brandId) throw new Error('Brand is required.');
  if (!categoryLabel) throw new Error('Category label is required.');

  const nextCategoryId = customCategoryId || buildCategoryId_(brandId, categoryLabel, parentCategoryId);
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
  const currentCategory = categories.find(function(item) {
    return item.id === originalCategoryId;
  });
  const descendantIds = getCategoryDescendantIds_(categories, originalCategoryId);
  const duplicate = categories.some(function(item) {
    return item.id === nextCategoryId && item.id !== originalCategoryId;
  });

  if (duplicate) {
    throw new Error('Category ID already exists.');
  }

  if (parentCategoryId === originalCategoryId || parentCategoryId === nextCategoryId) {
    throw new Error('Folder cannot be its own parent.');
  }

  if (parentCategoryId && descendantIds.indexOf(parentCategoryId) >= 0) {
    throw new Error("Parent folder cannot be one of this folder's children.");
  }

  if (descendantIds.length && currentCategory && currentCategory.brandId !== brandId) {
    throw new Error('Move or delete subfolders first before changing this folder to another brand.');
  }

  if (parentCategoryId) {
    const parentCategory = categories.find(function(item) {
      return item.id === parentCategoryId;
    });

    if (!parentCategory) {
      throw new Error('Parent folder was not found.');
    }

    if (String(parentCategory.brandId || '').trim().toLowerCase() !== brandId) {
      throw new Error('Parent folder belongs to a different brand.');
    }
  }

  settingsSheet.getRange(rowIndex + 1, 1, 1, SETTINGS_HEADERS.length).setValues([[brandId, brandLabel, nextCategoryId, categoryLabel, parentCategoryId]]);
  if (originalCategoryId !== nextCategoryId) {
    syncSettingsCategoryParentUpdate_(originalCategoryId, nextCategoryId);
  }
  syncDownloadsCategoryUpdate_(originalCategoryId, nextCategoryId, categoryLabel, brandId, brandLabel);
  touchPublicCacheVersion_();

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

  const linkedFileCount = countFilesForCategory_(targetId);
  const childFolderCount = countChildCategories_(targetId);

  if (linkedFileCount) {
    throw new Error('This category still has ' + linkedFileCount + ' files. Move or remove them first.');
  }

  if (childFolderCount) {
    throw new Error('This category still has ' + childFolderCount + ' subfolder' + (childFolderCount === 1 ? '' : 's') + '. Remove them first.');
  }

  settingsSheet.deleteRow(rowIndex + 1);
  touchPublicCacheVersion_();

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
  const rowIndexes = values.reduce(function(indexes, row, index) {
    if (index > 0 && String(row[0] || '').trim() === targetId) {
      indexes.push(index);
    }
    return indexes;
  }, []);

  if (!rowIndexes.length) {
    throw new Error('File row was not found.');
  }

  rowIndexes
    .slice()
    .sort(function(left, right) {
      return right - left;
    })
    .forEach(function(rowIndex) {
      sheet.deleteRow(rowIndex + 1);
    });

  touchPublicCacheVersion_();

  return {
    ok: true,
    message: rowIndexes.length > 1
      ? 'File deleted successfully. Removed ' + rowIndexes.length + ' duplicate rows with the same file ID.'
      : 'File deleted successfully.',
    recentFiles: getRecentFiles_(),
  };
}

function hasDownloadIdConflict_(values, fileId, currentRowIndex) {
  const targetId = String(fileId || '').trim();
  if (!targetId) return false;

  return values.some(function(row, index) {
    if (index === 0) return false;
    if (typeof currentRowIndex === 'number' && index === currentRowIndex) return false;
    return String(row[0] || '').trim() === targetId;
  });
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
  const values = sheet.getDataRange().getValues();
  if (hasDownloadIdConflict_(values, clean.id)) {
    throw new Error('A file with the same generated ID already exists. Edit the existing file instead of adding a duplicate.');
  }

  sheet.appendRow(row);
  touchPublicCacheVersion_();

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

  if (hasDownloadIdConflict_(values, clean.id, rowIndex)) {
    throw new Error('Another file already uses this generated ID. Change the title or category, or edit the matching file instead.');
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
  touchPublicCacheVersion_();

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
  const metaSheet = getOrCreateSheet_(spreadsheet, META_SHEET_NAME);

  ensureHeaders_(brandsSheet, BRANDS_HEADERS);
  ensureHeaders_(downloadsSheet, DOWNLOADS_HEADERS);
  ensureMetaSheet_(metaSheet);

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
    const rows = DEFAULT_CATEGORIES.map((item) => [item.brandId, item.brandLabel, item.id, item.label, item.parentCategoryId || '']);
    settingsSheet.getRange(2, 1, rows.length, SETTINGS_HEADERS.length).setValues(rows);
  } else {
    ensureDefaultCategories_(settingsSheet);
  }
}

function getCategories_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const hasBrandColumns = headers.indexOf('brand_id') >= 0;

  return decorateCategories_(dedupeCategories_(values
    .slice(1)
    .map(function(row) {
      if (hasBrandColumns && row[0] && row[2] && row[3]) {
        return {
          brandId: String(row[0]).trim(),
          brandLabel: String(row[1]).trim(),
          id: String(row[2]).trim(),
          label: String(row[3]).trim(),
          parentCategoryId: String(row[4] || '').trim(),
        };
      }

      if (row[0] && row[1]) {
        return {
          brandId: 'huawei',
          brandLabel: 'Huawei',
          id: String(row[0]).trim(),
          label: String(row[1]).trim(),
          parentCategoryId: '',
        };
      }

      return null;
    })
    .filter(function(item) {
      return item && item.id && item.label;
    })));
}

function getBrands_() {
  const sheet = getBrandsSheet_();
  const values = sheet.getDataRange().getValues();

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

function searchDownloadFiles(query) {
  ensureSchema_();

  const keyword = String(query || '').trim().toLowerCase();
  if (!keyword) {
    return {
      ok: true,
      query: '',
      total: 0,
      results: [],
    };
  }

  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];

  const matches = values
    .slice(1)
    .map(function(row, index) {
      return {
        rowNumber: index + 2,
        file: toFileRecord_(row, headers),
      };
    })
    .filter(function(entry) {
      return String(entry.file.id || '').trim();
    })
    .reverse()
    .filter(function(entry) {
      const file = entry.file;
      const haystack = [
        file.id,
        file.brandId,
        file.brandLabel,
        file.categoryId,
        file.categoryLabel,
        file.title,
        file.subtitle,
        file.summary,
        file.driveUrl,
      ]
        .map(function(value) {
          return String(value || '').trim().toLowerCase();
        })
        .join(' ');

      return haystack.indexOf(keyword) >= 0;
    });

  return {
    ok: true,
    query: keyword,
    total: matches.length,
    results: matches.slice(0, 40).map(function(entry) {
      return Object.assign({}, entry.file, {
        rowNumber: entry.rowNumber,
      });
    }),
  };
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

function syncSettingsCategoryParentUpdate_(originalCategoryId, nextCategoryId) {
  const sheet = getSettingsSheet_();
  const values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][4] || '').trim() !== originalCategoryId) continue;
    sheet.getRange(i + 1, 5).setValue(nextCategoryId);
  }
}

function syncSettingsBrandUpdate_(originalBrandId, nextBrandId, brandLabel) {
  const sheet = getSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const brandIdIndex = headers.indexOf('brand_id') >= 0 ? headers.indexOf('brand_id') : 0;
  const brandLabelIndex = headers.indexOf('brand_label') >= 0 ? headers.indexOf('brand_label') : 1;

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][brandIdIndex] || '').trim().toLowerCase() !== originalBrandId) continue;

    sheet.getRange(i + 1, brandIdIndex + 1).setValue(nextBrandId);
    sheet.getRange(i + 1, brandLabelIndex + 1).setValue(brandLabel);
  }
}

function syncDownloadsBrandUpdate_(originalBrandId, nextBrandId, brandLabel) {
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const brandIdIndex = headers.indexOf('brand_id') >= 0 ? headers.indexOf('brand_id') : 1;
  const brandLabelIndex = headers.indexOf('brand_label') >= 0 ? headers.indexOf('brand_label') : 2;
  const updatedAtIndex = headers.indexOf('updated_at') >= 0 ? headers.indexOf('updated_at') : 17;

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][brandIdIndex] || '').trim().toLowerCase() !== originalBrandId) continue;

    sheet.getRange(i + 1, brandIdIndex + 1).setValue(nextBrandId);
    sheet.getRange(i + 1, brandLabelIndex + 1).setValue(brandLabel);
    if (updatedAtIndex >= 0) {
      sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date().toISOString());
    }
  }
}

function countCategoriesForBrand_(brandId) {
  const sheet = getSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const brandIdIndex = headers.indexOf('brand_id') >= 0 ? headers.indexOf('brand_id') : 0;

  var count = 0;
  for (var i = 1; i < values.length; i += 1) {
    if (!String(values[i][2] || values[i][0] || '').trim()) continue;
    if (String(values[i][brandIdIndex] || '').trim().toLowerCase() === brandId) {
      count += 1;
    }
  }

  return count;
}

function countFilesForCategory_(categoryId) {
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const categoryIdIndex = headers.indexOf('category_id') >= 0 ? headers.indexOf('category_id') : 3;

  var count = 0;
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0] || '').trim() && String(values[i][categoryIdIndex] || '').trim() === categoryId) {
      count += 1;
    }
  }

  return count;
}

function countChildCategories_(categoryId) {
  const targetId = String(categoryId || '').trim();
  if (!targetId) return 0;

  return getCategories_().filter(function(item) {
    return String(item.parentCategoryId || '').trim() === targetId;
  }).length;
}

function countFilesForBrand_(brandId) {
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const brandIdIndex = headers.indexOf('brand_id') >= 0 ? headers.indexOf('brand_id') : 1;

  var count = 0;
  for (var i = 1; i < values.length; i += 1) {
    if (!String(values[i][0] || '').trim()) continue;
    if (String(values[i][brandIdIndex] || '').trim().toLowerCase() === brandId) {
      count += 1;
    }
  }

  return count;
}

function getPublishedFiles_(categoryId) {
  const sheet = getDownloadsSheet_();
  const values = sheet.getDataRange().getValues();

  return dedupeFiles_(values
    .slice(1)
    .filter((row) => row[0])
    .map(toFileRecord_)
    .filter(function(file) {
      const isPublished = String(file.status || '').toLowerCase() === 'published';
      const matchesCategory = !categoryId || file.categoryId === categoryId;
      return isPublished && matchesCategory;
    }));
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

function buildCategoryId_(brandId, categoryLabel, parentCategoryId) {
  const base = String(categoryLabel || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const normalizedParentId = String(parentCategoryId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalizedParentId) {
    return normalizedParentId + '-' + base;
  }

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

function getMetaSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(META_SHEET_NAME);
  if (!sheet) {
    throw new Error('Meta sheet is missing.');
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
      return ['huawei', 'Huawei', row[0], row[1], ''];
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
      return [item.brandId, item.brandLabel, item.id, item.label, item.parentCategoryId || ''];
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

function ensureMetaSheet_(sheet) {
  ensureHeaders_(sheet, META_HEADERS);

  const values = sheet.getDataRange().getValues();
  const existingKeys = values
    .slice(1)
    .map(function(row) {
      return String(row[0] || '').trim();
    })
    .filter(function(key) {
      return key;
    });
  const now = new Date();
  const missingRows = [];

  if (existingKeys.indexOf(PUBLIC_CACHE_VERSION_KEY) === -1) {
    missingRows.push([PUBLIC_CACHE_VERSION_KEY, String(now.getTime())]);
  }

  if (existingKeys.indexOf(LAST_ADMIN_UPDATE_KEY) === -1) {
    missingRows.push([LAST_ADMIN_UPDATE_KEY, now.toISOString()]);
  }

  if (missingRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, missingRows.length, META_HEADERS.length).setValues(missingRows);
  }

  try {
    sheet.hideSheet();
  } catch (error) {
  }
}

function getMetaValue_(key) {
  const targetKey = String(key || '').trim();
  if (!targetKey) return '';

  const sheet = getMetaSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return '';
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const match = values.find(function(row) {
    return String(row[0] || '').trim() === targetKey;
  });

  return match ? String(match[1] || '').trim() : '';
}

function setMetaValue_(key, value) {
  const targetKey = String(key || '').trim();
  if (!targetKey) return;

  const sheet = getMetaSheet_();
  ensureMetaSheet_(sheet);
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, 1, Math.max(lastRow - 1, 1), 2).getValues();
  const rowIndex = values.findIndex(function(row) {
    return String(row[0] || '').trim() === targetKey;
  });

  if (rowIndex >= 0) {
    sheet.getRange(rowIndex + 2, 2).setValue(String(value || '').trim());
    return;
  }

  sheet.appendRow([targetKey, String(value || '').trim()]);
}

function touchPublicCacheVersion_() {
  const now = new Date();
  const version = String(now.getTime());
  const updatedAt = now.toISOString();

  setMetaValue_(PUBLIC_CACHE_VERSION_KEY, version);
  setMetaValue_(LAST_ADMIN_UPDATE_KEY, updatedAt);
  refreshPublicCacheEndpoint_(version, updatedAt);
}

function refreshPublicCacheEndpoint_(version, updatedAt) {
  getPublicRefreshUrls_().forEach(function(baseUrl) {
    const separator = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    const url = baseUrl +
      separator +
      'view=refresh&version=' + encodeURIComponent(String(version || '').trim()) +
      '&updatedAt=' + encodeURIComponent(String(updatedAt || '').trim());

    try {
      const response = UrlFetchApp.fetch(url, {
        followRedirects: true,
        muteHttpExceptions: true,
      });

      if (response.getResponseCode() >= 400) {
        Logger.log('Public cache refresh returned HTTP ' + response.getResponseCode() + ' for ' + baseUrl);
      }
    } catch (error) {
      Logger.log('Public cache refresh failed for ' + baseUrl + ': ' + error.message);
    }
  });
}

function getPublicRefreshUrls_() {
  const configured = String(
    PropertiesService.getScriptProperties().getProperty(PUBLIC_REFRESH_URL_PROPERTY) || ''
  ).trim();
  const urls = [configured, DEFAULT_PUBLIC_REFRESH_URL]
    .map(function(url) {
      return String(url || '').trim();
    })
    .filter(Boolean);

  return urls.filter(function(url, index) {
    return urls.indexOf(url) === index;
  });
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
    const categoryId = String((item && item.id) || '').trim().toLowerCase();
    if (!categoryId || seen[categoryId]) return false;
    seen[categoryId] = true;
    return true;
  });
}

function decorateCategories_(items) {
  const map = {};
  const childCounts = {};

  items.forEach(function(item) {
    const categoryId = String((item && item.id) || '').trim();
    if (!categoryId) return;
    map[categoryId] = Object.assign({}, item, {
      parentCategoryId: String((item && item.parentCategoryId) || '').trim(),
    });
  });

  Object.keys(map).forEach(function(categoryId) {
    const parentCategoryId = String(map[categoryId].parentCategoryId || '').trim();
    if (!parentCategoryId) return;
    childCounts[parentCategoryId] = (childCounts[parentCategoryId] || 0) + 1;
  });

  return items.map(function(item) {
    const categoryId = String((item && item.id) || '').trim();
    const safeItem = map[categoryId];
    const parentCategoryId = String((safeItem && safeItem.parentCategoryId) || '').trim();
    const parentCategory = parentCategoryId ? map[parentCategoryId] : null;

    return Object.assign({}, safeItem, {
      parentCategoryId: parentCategoryId,
      parentCategoryLabel: parentCategory ? String(parentCategory.label || '').trim() : '',
      fullLabel: buildCategoryFullLabel_(categoryId, map),
      depth: getCategoryDepth_(categoryId, map),
      hasChildren: Boolean(childCounts[categoryId]),
    });
  });
}

function buildCategoryFullLabel_(categoryId, map) {
  const parts = [];
  const seen = {};
  var currentId = String(categoryId || '').trim();

  while (currentId && map[currentId] && !seen[currentId]) {
    seen[currentId] = true;
    parts.unshift(String(map[currentId].label || currentId).trim());
    currentId = String(map[currentId].parentCategoryId || '').trim();
  }

  return parts.join(' / ');
}

function getCategoryDepth_(categoryId, map) {
  var depth = 0;
  var currentId = String(categoryId || '').trim();
  var seen = {};

  while (currentId && map[currentId] && !seen[currentId]) {
    seen[currentId] = true;
    currentId = String(map[currentId].parentCategoryId || '').trim();
    if (currentId) {
      depth += 1;
    }
  }

  return depth;
}

function getCategoryDescendantIds_(categories, parentCategoryId) {
  const targetId = String(parentCategoryId || '').trim();
  if (!targetId) return [];

  const childMap = {};
  (categories || []).forEach(function(item) {
    const parentId = String((item && item.parentCategoryId) || '').trim();
    const categoryId = String((item && item.id) || '').trim();
    if (!parentId || !categoryId) return;
    if (!childMap[parentId]) {
      childMap[parentId] = [];
    }
    childMap[parentId].push(categoryId);
  });

  const descendants = [];
  const seen = {};
  const queue = (childMap[targetId] || []).slice();

  while (queue.length) {
    const currentId = String(queue.shift() || '').trim();
    if (!currentId || seen[currentId]) continue;
    seen[currentId] = true;
    descendants.push(currentId);
    (childMap[currentId] || []).forEach(function(childId) {
      queue.push(childId);
    });
  }

  return descendants;
}

function hasCategoryCycleInRegistry_(categoryId, registry) {
  const seen = {};
  var currentId = String(categoryId || '').trim();

  while (currentId) {
    if (seen[currentId]) {
      return true;
    }

    seen[currentId] = true;
    const item = registry[currentId];
    currentId = item ? String(item.parentCategoryId || '').trim() : '';
  }

  return false;
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
