const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'https://eamonnhanson.github.io',
  'https://courageous-centaur-f7d1ea.netlify.app',
  'https://map.planteenboom.nu',
  'https://ketso-uploader.pages.dev'
]);

export function isAllowedCorsOrigin(origin) {
  if (!origin || allowedOrigins.has(origin) || /\.netlify\.app$/.test(origin)) return true;
  try {
    const url = new URL(origin);
    // Only this project's immutable deployment URLs and the existing PR branch.
    // No wildcard permission for other Cloudflare Pages projects or subdomains.
    return url.protocol === 'https:' && url.origin === origin && !url.username && !url.password &&
      !url.port && /^(?:[a-f0-9]{8}|fix-academy-mobile-photo-upl)\.ketso-uploader\.pages\.dev$/.test(url.hostname);
  } catch { return false; }
}

export function corsOrigin(origin, callback) {
  if (isAllowedCorsOrigin(origin)) return callback(null,true);
  callback(new Error('Not allowed by CORS'));
}
