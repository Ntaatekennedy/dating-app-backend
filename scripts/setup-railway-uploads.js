/**
 * Create and attach a persistent Railway volume for profile photo uploads.
 * Usage: npm run railway:setup-uploads
 */
require('dotenv').config();
const { spawnSync } = require('child_process');

const mountPath = process.env.UPLOAD_DIR || '/app/uploads';

function run(args) {
  const result = spawnSync('railway', args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Linking api service...');
run(['service', 'link', 'api']);

console.log(`\nCreating upload volume at ${mountPath} (skip if already exists)...`);
const add = spawnSync(
  'railway',
  ['volume', 'add', '--mount-path', mountPath],
  { stdio: 'inherit', shell: true },
);
if (add.status !== 0) {
  console.warn('Volume add returned non-zero — it may already exist. Continuing...');
}

console.log(`\nSetting UPLOAD_DIR=${mountPath} on api service...`);
run(['variable', 'set', `UPLOAD_DIR=${mountPath}`, '--service', 'api']);

console.log('\nVolumes:');
run(['volume', 'list']);

console.log('\nDone. Redeploy the api service: railway up --service api');
console.log('Uploaded photos will persist across redeploys.');
