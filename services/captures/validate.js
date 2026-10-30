// Checks and cleans what the team extension uploads. Anything wrong is a 400 with a clear message.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

class UploadError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

// Does the start of the file look like the type it claims to be?
function looksLike(type, b) {
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/png') return b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG';
  return b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';
}

function parseUpload(body) {
  if (!body || typeof body !== 'object') throw new UploadError('Send a JSON body');
  const mimeType = String(body.mimeType || '');
  if (!TYPES[mimeType]) throw new UploadError('mimeType must be image/jpeg, image/png or image/webp');
  const raw = String(body.image || '').replace(/^data:[^,]*,/, '');
  const image = Buffer.from(raw, 'base64');
  if (image.length < 100) throw new UploadError('The image is missing or too small');
  if (image.length > MAX_IMAGE_BYTES) throw new UploadError('The image is larger than 3 MB');
  if (!looksLike(mimeType, image)) throw new UploadError('The file is not really a ' + mimeType);

  const target = body.target && typeof body.target === 'object' ? {
    label: text(body.target.label, 80),
    box: { x: num(body.target.box?.x), y: num(body.target.box?.y), width: num(body.target.box?.width), height: num(body.target.box?.height) },
  } : null;
  const labels = (Array.isArray(body.labels) ? body.labels : []).slice(0, 120).map((l) => text(l, 60)).filter(Boolean);
  const page = body.page && typeof body.page === 'object' ? {
    host: text(body.page.host, 100),
    path: text(body.page.path, 200).split('?')[0], // never keep a query string
    title: text(body.page.title, 120),
    width: num(body.page.width),
    height: num(body.page.height),
  } : null;

  return {
    project: text(body.project, 40).replace(/[^\p{L}\p{N} ._-]/gu, '').trim() || 'general',
    note: text(body.note, 500),
    target,
    labels,
    page,
    image,
    mimeType,
    ext: TYPES[mimeType],
  };
}

module.exports = { parseUpload, UploadError, MAX_IMAGE_BYTES };
