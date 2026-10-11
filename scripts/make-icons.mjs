// Renders public/icon.svg into the PNG sizes browsers and phones need.
import sharp from "sharp";
import fs from "fs";

const svg = fs.readFileSync("public/icon.svg");
const out = [
  ["public/icon-192.png", 192, 0],
  ["public/icon-512.png", 512, 0],
  ["public/apple-touch-icon.png", 180, 0],
  ["public/favicon-32.png", 32, 0],
  // Maskable icons need padding so Android's crop doesn't cut the artwork.
  ["public/icon-maskable-512.png", 512, 56],
];
for (const [file, size, pad] of out) {
  const inner = await sharp(svg).resize(size - pad * 2, size - pad * 2).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: pad ? "#1d3a5f" : { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, top: pad, left: pad }])
    .png()
    .toFile(file);
  console.log("wrote", file);
}
