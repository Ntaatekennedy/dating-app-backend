function resolvePhotoUrl(baseUrl, rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http')) return rawUrl;
  return `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}

module.exports = { resolvePhotoUrl };
