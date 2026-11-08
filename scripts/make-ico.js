// 手写真正的多尺寸 ICO（内嵌 PNG，Vista+ 全支持）
// 零依赖 ICO 格式：6 字节头 + 16 字节/尺寸 目录条目 + 每个条目对应 PNG 数据
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.resolve(process.argv[2] ||
  'C:\\Users\\gt219\\Documents\\Tencent Files\\3471395427\\nt_qq\\nt_data\\Pic\\2026-11\\Ori\\57daab0838996dbe04633b167d0cb61d.png');
const OUT_DIR = path.resolve(__dirname, '..', 'build');
const OUT_ICO = path.join(OUT_DIR, 'icon.ico');
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];

// ICO 里尺寸字段 0 表示 256
function dimByte(s) { return s >= 256 ? 0 : s; }

async function main() {
  if (!fs.existsSync(SOURCE)) { console.error('Source not found:', SOURCE); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  console.log('Source:', SOURCE);
  console.log('Original:', meta.width, 'x', meta.height);

  // 生成所有尺寸 PNG buffer
  const pngs = []; // { size, buf }
  for (const size of SIZES) {
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: 'cover', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngs.push({ size, buf });
    console.log('  ', size, 'x', size, '->', buf.length, 'bytes');
  }

  // 组装 ICO
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type = 1 (ICO)
  header.writeUInt16LE(count, 4); // image count

  // 目录条目起始偏移 = 6 + count * 16
  let dataOffset = 6 + count * 16;
  const entries = [];
  for (const { size, buf } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(dimByte(size), 0);     // width
    entry.writeUInt8(dimByte(size), 1);     // height
    entry.writeUInt8(0, 2);                // color palette
    entry.writeUInt8(0, 3);                // reserved
    entry.writeUInt16LE(1, 4);             // color planes
    entry.writeUInt16LE(32, 6);            // bpp
    entry.writeUInt32LE(buf.length, 8);    // size of image data
    entry.writeUInt32LE(dataOffset, 12);   // offset
    entries.push(entry);
    dataOffset += buf.length;
  }

  // 拼接：header + entries + png buffers
  const out = Buffer.concat([
    header,
    Buffer.concat(entries),
    ...pngs.map(p => p.buf)
  ]);

  fs.writeFileSync(OUT_ICO, out);
  console.log('\nICO written:', OUT_ICO, '(' + out.length + ' bytes, ' + count + ' sizes)');
  console.log('Magic:', out.slice(0, 2).toString('hex'), out.slice(2, 4).toString('hex'), '-> should be 0000 0100');
}

main().catch(e => { console.error(e); process.exit(1); });
