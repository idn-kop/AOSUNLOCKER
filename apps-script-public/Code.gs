const SPREADSHEET_NAME = 'AOSUNLOCKER DATA';
const DOWNLOADS_SHEET_NAME = 'Downloads';
const SETTINGS_SHEET_NAME = 'Settings';
const BRANDS_SHEET_NAME = 'Brands';

function doGet(e) {
  const view = String((e && e.parameter && e.parameter.view) || 'catalog');

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
    files: getPublishedFiles_(''),
  });
}

function getSpreadsheet_() {
  if (!SPREADSHEET_NAME || SPREADSHEET_NAME === 'PASTE_YOUR_SPREADSHEET_NAME_HERE') {
    throw new Error('Spreadsheet name has not been configured.');
  }

  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (!files.hasNext()) {
    throw new Error('Spreadsheet not found. Make sure the name matches exactly.');
  }

  return SpreadsheetApp.openById(files.next().getId());
}

function getCategories_(brandId) {
  const sheet = getSpreadsheet_().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const hasBrandColumns = headers.indexOf('brand_id') >= 0;

  return values
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
      return !brandId || item.brandId === brandId;
    });
}

function getBrands_() {
  const sheet = getSpreadsheet_().getSheetByName(BRANDS_SHEET_NAME);

  if (sheet) {
    return sheet
      .getDataRange()
      .getValues()
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

  const categories = getCategories_('');
  const brandMap = {};
  categories.forEach(function(item) {
    if (!item.brandId) return;
    brandMap[item.brandId] = item.brandLabel || item.brandId;
  });

  return Object.keys(brandMap).map(function(id) {
    return {
      id: id,
      label: String(brandMap[id] || id),
    };
  });
}

function getPublishedFiles_(categoryId, brandId) {
  const sheet = getSpreadsheet_().getSheetByName(DOWNLOADS_SHEET_NAME);
  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];

  return values
    .slice(1)
    .filter(function(row) {
      return row[0];
    })
    .map(function(row) {
      return toFileRecord_(row, headers);
    })
    .filter(function(file) {
      const isPublished = String(file.status || '').toLowerCase() === 'published';
      const matchesCategory = !categoryId || file.categoryId === categoryId;
      const matchesBrand = !brandId || file.brandId === brandId;
      return isPublished && matchesCategory && matchesBrand;
    });
}

function getPublishedFileById_(fileId) {
  if (!fileId) return null;

  const files = getPublishedFiles_('');
  return files.find(function(file) {
    return file.id === fileId;
  }) || null;
}

function incrementDownloadCount_(fileId) {
  if (!fileId) {
    return { ok: false, message: 'Missing file id.' };
  }

  const sheet = getSpreadsheet_().getSheetByName(DOWNLOADS_SHEET_NAME);
  if (!sheet) {
    return { ok: false, message: 'Downloads sheet not found.' };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const idIndex = headers.indexOf('id') >= 0 ? headers.indexOf('id') : 0;
  const downloadsIndex = headers.indexOf('downloads') >= 0 ? headers.indexOf('downloads') : 9;
  const updatedAtIndex = headers.indexOf('updated_at') >= 0 ? headers.indexOf('updated_at') : 15;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[idIndex] || '').trim() !== fileId) continue;

    var currentValue = Number(row[downloadsIndex] || 0);
    var nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;

    sheet.getRange(i + 1, downloadsIndex + 1).setValue(nextValue);

    if (updatedAtIndex >= 0) {
      sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date().toISOString());
    }

    return {
      ok: true,
      id: fileId,
      downloads: String(nextValue),
    };
  }

  return { ok: false, message: 'File id not found.' };
}

function toFileRecord_(row, headers) {
  const getValue = function(name, fallbackIndex) {
    const headerIndex = headers.indexOf(name);
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
