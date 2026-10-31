// Makes a ZIP file (in memory) from a folder, with no extra package. Entries are deflated; names are relative to the folder.
// Used for the extension downloads, so a person gets a ZIP with manifest.json at its top, ready to unzip and "Load unpacked".
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// All files under dir, as { name: 'a/b.js', file: '/full/a/b.js' }, in a steady order. Hidden files are left out.
function listFiles(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, base), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, rel));
    else out.push({ name: rel, file: path.join(dir, rel) });
  }
  return out;
}

function zipFolder(dir) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, file } of listFiles(dir)) {
    const data = fs.readFileSync(file);
    const packed = zlib.deflateRawSync(data);
    const nm = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(0x6000, 10); head.writeUInt16LE(0x5a21, 12); // fixed time and date: the same folder always gives the same ZIP
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nm.length, 26);
    const rec = Buffer.alloc(46);
    rec.writeUInt32LE(0x02014b50, 0); rec.writeUInt16LE(20, 4); rec.writeUInt16LE(20, 6); rec.writeUInt16LE(0x0800, 8); rec.writeUInt16LE(8, 10);
    rec.writeUInt16LE(0x6000, 12); rec.writeUInt16LE(0x5a21, 14);
    rec.writeUInt32LE(crc, 16); rec.writeUInt32LE(packed.length, 20); rec.writeUInt32LE(data.length, 24); rec.writeUInt16LE(nm.length, 28);
    rec.writeUInt32LE(offset, 42);
    parts.push(head, nm, packed);
    central.push(rec, nm);
    offset += head.length + nm.length + packed.length;
  }
  const dirBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(dirBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dirBuf, end]);
}

module.exports = { zipFolder, listFiles };
