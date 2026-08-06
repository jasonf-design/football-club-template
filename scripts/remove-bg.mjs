import sharp from "sharp";

const INPUT = new URL("../public/home-shirt.jpg", import.meta.url).pathname;
const OUTPUT = new URL("../public/home-shirt-nobg.png", import.meta.url).pathname;

const THRESHOLD = 248;         // flood-fill: all channels must be >= this
const SPECK_MIN_CHANNEL = 242; // cleanup: only target near-white opaque pixels
const SPECK_NEIGHBOURS = 6;    // cleanup: remove if >= this many transparent 8-neighbours

const { data, info } = await sharp(INPUT)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const buf = Buffer.from(data);

function getAlpha(x, y)   { return buf[(y * width + x) * channels + 3]; }
function setAlpha(x, y, a){ buf[(y * width + x) * channels + 3] = a; }
function isNearWhite(x, y) {
  const i = (y * width + x) * channels;
  return buf[i] >= THRESHOLD && buf[i + 1] >= THRESHOLD && buf[i + 2] >= THRESHOLD;
}

// ── Pass 1: flood fill from all edges (8-connected) ────────────────────────
const visited = new Uint8Array(width * height);
const queue = [];

for (let x = 0; x < width; x++) {
  if (isNearWhite(x, 0))          queue.push(x, 0);
  if (isNearWhite(x, height - 1)) queue.push(x, height - 1);
}
for (let y = 1; y < height - 1; y++) {
  if (isNearWhite(0, y))         queue.push(0, y);
  if (isNearWhite(width - 1, y)) queue.push(width - 1, y);
}

let qi = 0;
while (qi < queue.length) {
  const x = queue[qi++];
  const y = queue[qi++];
  if (x < 0 || x >= width || y < 0 || y >= height) continue;
  const vi = y * width + x;
  if (visited[vi]) continue;
  if (!isNearWhite(x, y)) continue;
  visited[vi] = 1;
  setAlpha(x, y, 0);
  queue.push(x - 1, y, x + 1, y, x, y - 1, x, y + 1);
}

// ── Pass 2: remove isolated near-white specks (background remnants) ────────
// A pixel is a speck if it's near-white AND ≥ SPECK_NEIGHBOURS of its 8
// neighbours are already transparent.  Shirt edge pixels always border several
// opaque shirt pixels, so they'll never hit this threshold.
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    if (getAlpha(x, y) === 0) continue;
    const i = (y * width + x) * channels;
    if (buf[i] < SPECK_MIN_CHANNEL || buf[i + 1] < SPECK_MIN_CHANNEL || buf[i + 2] < SPECK_MIN_CHANNEL) continue;
    let t = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if ((dx || dy) && getAlpha(x + dx, y + dy) === 0) t++;
    if (t >= SPECK_NEIGHBOURS) setAlpha(x, y, 0);
  }
}

await sharp(buf, { raw: { width, height, channels } })
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

console.log("Done:", OUTPUT);
