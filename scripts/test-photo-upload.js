require('dotenv').config();

const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
  'base64',
);

async function upload(path, token, label) {
  const form = new FormData();
  form.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), `${label}.jpg`);

  const res = await fetch(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json();
  console.log(`${label}:`, res.status, body.url || body.error);
  return body;
}

async function main() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sophia@example.com', password: 'password123' }),
  });
  const login = await loginRes.json();
  if (!login.token) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(login)}`);
  }

  const primary = await upload('/api/profile/photo', login.token, 'primary');
  const gallery = await upload('/api/profile/photos', login.token, 'gallery');

  const listRes = await fetch(`http://localhost:3000/api/profile/photos/${login.user.id}`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  const photos = await listRes.json();
  console.log('Total photos:', photos.length);

  for (const photo of photos) {
    const imgRes = await fetch(photo.url);
    console.log('GET image', photo.url, '->', imgRes.status, imgRes.headers.get('content-type'));
  }

  if (!primary.url || !gallery.url || photos.length < 1) {
    process.exit(1);
  }
  console.log('Photo upload test OK');
}

main().catch((err) => {
  console.error('Photo upload test FAILED:', err.message);
  process.exit(1);
});
