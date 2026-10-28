const fs = require('fs');
const path = require('path');

/** Persistent upload directory (Railway volume at /app/uploads in production). */
function getUploadDir() {
  const dir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '../../uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function uploadsPublicPath(filename) {
  return `/uploads/${filename}`;
}

function resolveStoredFilePath(url) {
  if (!url || !url.startsWith('/uploads/')) return null;
  const filename = path.basename(url);
  return path.join(getUploadDir(), filename);
}

module.exports = {
  getUploadDir,
  uploadsPublicPath,
  resolveStoredFilePath,
};
