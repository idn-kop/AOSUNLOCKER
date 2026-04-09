import fs from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'permissions-policy',
  'referrer-policy',
  'x-content-type-options',
  'x-frame-options',
];

const ADMIN_HEADERS = ['cache-control', 'x-robots-tag'];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = ''] = arg.split('=');
    return [key, value];
  }),
);

const cwd = process.cwd();
const baseUrl = new URL(args.get('--base-url') || process.env.AOS_SITE_URL || 'https://aosunlocker.com');

function stripJsonComments(input) {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function printSection(title) {
  console.log(`\n${title}`);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function warn(message) {
  console.log(`[WARN] ${message}`);
}

async function loadWranglerConfig() {
  const filePath = path.join(cwd, 'wrangler.jsonc');
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(stripJsonComments(raw));
}

async function checkWranglerConfig() {
  printSection('Wrangler config');

  let config;

  try {
    config = await loadWranglerConfig();
  } catch (error) {
    warn(`Gagal membaca wrangler.jsonc: ${error.message}`);
    return false;
  }

  const database = config?.d1_databases?.[0];

  if (!database) {
    warn('Binding D1 tidak ditemukan di wrangler.jsonc.');
    return false;
  }

  const productionId = database.database_id;
  const previewId = database.preview_database_id;

  if (!productionId || !previewId) {
    warn('database_id atau preview_database_id belum lengkap.');
    return false;
  }

  if (productionId === previewId) {
    warn('preview_database_id masih sama dengan database_id production. Preview masih berisiko menulis ke database live.');
    return false;
  }

  pass(`Preview database sudah dipisah. Production=${productionId} Preview=${previewId}`);
  return true;
}

async function fetchHeaders(pathname) {
  const target = new URL(pathname, baseUrl);
  const response = await fetch(target, {
    method: 'GET',
    redirect: 'manual',
  });

  return {
    target,
    status: response.status,
    headers: response.headers,
  };
}

function findMissingHeaders(headers, names) {
  return names.filter((name) => !headers.get(name));
}

function checkAdminReachability(pathname, status) {
  if (pathname === '/admin' && status === 200) {
    warn('/admin masih bisa dibuka publik tanpa Cloudflare Access. Ini belum jebol, tapi belum terkunci maksimal.');
    return;
  }

  if (pathname === '/api/admin/bootstrap') {
    if (status === 200) {
      warn('/api/admin/bootstrap membalas 200 tanpa proteksi. Ini tidak normal.');
      return;
    }

    if ([401, 403, 302].includes(status)) {
      pass(`/api/admin/bootstrap masih terlindungi dengan status ${status}.`);
      return;
    }

    warn(`/api/admin/bootstrap membalas status ${status}. Tolong cek lagi proteksi admin di deployment.`);
  }
}

async function checkEndpoint(pathname, extraHeaders = []) {
  try {
    const { target, status, headers } = await fetchHeaders(pathname);
    const missing = findMissingHeaders(headers, [...REQUIRED_HEADERS, ...extraHeaders]);

    if (missing.length === 0) {
      pass(`${target.href} memuat header penting. Status=${status}`);
    } else {
      warn(`${target.href} masih kurang header: ${missing.join(', ')}. Status=${status}`);
    }

    checkAdminReachability(pathname, status);
  } catch (error) {
    warn(`Gagal mengecek ${pathname}: ${error.message}`);
  }
}

async function main() {
  console.log(`Base URL: ${baseUrl.href}`);

  const configOk = await checkWranglerConfig();

  printSection('Live deployment');
  await checkEndpoint('/');
  await checkEndpoint('/admin', ADMIN_HEADERS);
  await checkEndpoint('/api/admin/bootstrap', ADMIN_HEADERS);

  printSection('Summary');

  if (!configOk) {
    warn('Pisahkan database preview sebelum mengandalkan preview deploy untuk testing.');
  }

  warn('Kalau /admin masih status 200, lanjutkan hardening dengan Cloudflare Access untuk /admin* dan /api/admin*.');
}

await main();
