import sharp from "sharp";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const SRC = path.join(OUT, "khalil_deco_platre_logo_trans.png");
const CREAM = "#f3efe6";

// 1) Extract the K + roof symbol (excludes the vertical divider and the text).
const symbol = await sharp(SRC).extract({ left: 171, top: 74, width: 168, height: 143 }).png().toBuffer();

// 2) Build a rounded 512 master tile with the symbol centered.
const SIZE = 512;
const RADIUS = 118;
const symbolW = 316;
const symbolH = Math.round((143 / 168) * symbolW);
const bg = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="${CREAM}"/></svg>`
);
const left = Math.round((SIZE - symbolW) / 2);
const top = Math.round((SIZE - symbolH) / 2);
const symbolResized = await sharp(symbol).resize(symbolW, symbolH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const master = await sharp(bg).composite([{ input: symbolResized, left, top }]).png().toBuffer();
writeFileSync(`${OUT}/icon-512.png`, master);

// 3) Raster sizes.
const writePng = async (size, file) => {
  const buf = await sharp(master).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  writeFileSync(`${OUT}/${file}`, buf);
  return buf;
};
const png16 = await writePng(16, "_tmp16.png");
const png32 = await writePng(32, "favicon.png");
const png48 = await writePng(48, "_tmp48.png");
await writePng(192, "icon-192.png");
await writePng(180, "apple-touch-icon.png");

// 4) Manual ICO container (PNG-compressed entries: 16, 32, 48).
const icoEntries = [
  { size: 16, data: png16 },
  { size: 32, data: png32 },
  { size: 48, data: png48 },
];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoEntries.length, 4);
let offset = 6 + 16 * icoEntries.length;
const directory = Buffer.alloc(16 * icoEntries.length);
const bodies = [];
icoEntries.forEach((entry, index) => {
  const base = index * 16;
  directory.writeUInt8(entry.size === 256 ? 0 : entry.size, base);
  directory.writeUInt8(entry.size === 256 ? 0 : entry.size, base + 1);
  directory.writeUInt8(0, base + 2);
  directory.writeUInt8(0, base + 3);
  directory.writeUInt16LE(1, base + 4);
  directory.writeUInt16LE(32, base + 6);
  directory.writeUInt32LE(entry.data.length, base + 8);
  directory.writeUInt32LE(offset, base + 12);
  offset += entry.data.length;
  bodies.push(entry.data);
});
writeFileSync(`${OUT}/favicon.ico`, Buffer.concat([header, directory, ...bodies]));

// 5) Vector favicon.svg (rounded tile + embedded symbol for brand fidelity).
const symbolB64 = symbolResized.toString("base64");
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">` +
  `<rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="${CREAM}"/>` +
  `<image x="${left}" y="${top}" width="${symbolW}" height="${symbolH}" href="data:image/png;base64,${symbolB64}"/>` +
  `</svg>`;
writeFileSync(`${OUT}/favicon.svg`, svg);

console.log("favicon assets generated");
