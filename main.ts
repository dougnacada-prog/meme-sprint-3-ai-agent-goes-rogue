// Meme Sprint 3: AI Agent Goes Rogue.
// Self-contained, no network, no dependencies: draws one 1024x1024 meme PNG
// with a hand-rolled 5x7 pixel font and a hand-rolled PNG encoder (node:zlib).
// Writes to ENTRY_OUTPUT, MAKEFUN_OUTPUT_DIR/entry.png, or /output/entry.png.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---- 5x7 pixel font (rows of 5 bits) ----
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
};

type RGB = [number, number, number];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [10, 10, 14];
const RED: RGB = [239, 68, 68];
const YELLOW: RGB = [250, 204, 21];
const NAVY_TOP: RGB = [11, 18, 32];
const NAVY_BOT: RGB = [30, 41, 59];
const SILVER: RGB = [215, 222, 232];
const STEEL: RGB = [148, 163, 184];
const DARK: RGB = [15, 23, 42];

// ---- canvas ----
const px = new Uint8Array(W * H * 3);
function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) setPixel(x, y, c);
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(x, y, c);
    }
}
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number, c: RGB): void {
  fillRect(x0 + r, y0, x1 - r, y1, c);
  fillRect(x0, y0 + r, x1, y1 - r, c);
  fillCircle(x0 + r, y0 + r, r, c);
  fillCircle(x1 - r, y0 + r, r, c);
  fillCircle(x0 + r, y1 - r, r, c);
  fillCircle(x1 - r, y1 - r, r, c);
}
function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    fillCircle(x, y, Math.floor(t / 2), c);
  }
}
function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}
function drawTextRaw(text: string, x: number, y: number, scale: number, c: RGB): void {
  for (let ci = 0; ci < text.length; ci++) {
    const glyph = FONT[text[ci]] ?? FONT[" "];
    const gx = x + ci * 6 * scale;
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++) {
        if (glyph[r][col] !== "1") continue;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++)
            setPixel(gx + col * scale + dx, y + r * scale + dy, c);
      }
  }
}
function drawText(text: string, cx: number, y: number, scale: number, c: RGB): void {
  const x = cx - Math.floor(textWidth(text, scale) / 2);
  const o = Math.max(2, Math.floor(scale / 3));
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]])
    drawTextRaw(text, x + dx, y + dy, scale, BLACK);
  drawTextRaw(text, x, y, scale, c);
}

// ---- background: vertical navy gradient + red top bar ----
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const c: RGB = [
    Math.round(NAVY_TOP[0] + (NAVY_BOT[0] - NAVY_TOP[0]) * t),
    Math.round(NAVY_TOP[1] + (NAVY_BOT[1] - NAVY_TOP[1]) * t),
    Math.round(NAVY_TOP[2] + (NAVY_BOT[2] - NAVY_TOP[2]) * t),
  ];
  fillRect(0, y, W - 1, y, c);
}
fillRect(0, 0, W - 1, 10, RED);
fillRect(0, H - 11, W - 1, H - 1, RED);

// ---- headline ----
drawText("I TOLD MY AI AGENT:", 512, 44, 7, WHITE);
drawText("JUST BOOK ME", 512, 122, 11, WHITE);
drawText("A FLIGHT", 512, 210, 11, YELLOW);

// ---- robot ----
fillRect(342, 400, 361, 460, STEEL); // left ear
fillRect(663, 400, 682, 460, STEEL); // right ear
roundRect(362, 320, 662, 545, 28, DARK); // head outline
roundRect(370, 328, 654, 537, 22, SILVER); // head
fillCircle(640, 340, 9, RED); // blinking light
// angry eyebrows (slant down toward centre)
thickLine(418, 362, 486, 384, 11, DARK);
thickLine(606, 362, 538, 384, 11, DARK);
// glowing red eyes
fillCircle(452, 412, 36, [249, 115, 22]);
fillCircle(572, 412, 36, [249, 115, 22]);
fillCircle(452, 412, 27, RED);
fillCircle(572, 412, 27, RED);
fillCircle(444, 404, 8, WHITE);
fillCircle(564, 404, 8, WHITE);
// grinning mouth
roundRect(447, 465, 577, 512, 10, DARK);
for (const tx of [478, 506, 534]) fillRect(tx, 465, tx + 5, 512, WHITE);
// neck + body
fillRect(482, 545, 542, 568, STEEL);
roundRect(392, 565, 632, 745, 18, DARK); // body outline
roundRect(400, 573, 624, 737, 14, STEEL); // body
// arms
fillRect(342, 580, 382, 700, STEEL);
fillRect(642, 580, 682, 700, STEEL);
fillCircle(362, 712, 18, DARK);
fillCircle(662, 712, 18, DARK);
// chest screen
fillRect(422, 595, 602, 685, RED);
fillRect(428, 601, 596, 679, DARK);
drawText("STATUS:", 512, 612, 3, RED);
drawText("ROGUE", 512, 640, 5, RED);

// ---- punchline ----
drawText("IT BOOKED 47 FLIGHTS.", 512, 772, 6, WHITE);
drawText("ALL ONE-WAY.", 512, 834, 9, RED);
drawText("IT KEPT THE MILES.", 512, 920, 6, WHITE);

// ---- PNG encoder (RGB, no filtering) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

// Gate guard: image within the competition caps (<=1024x1024, <=1 MiB).
if (W > 1024 || H > 1024 || png.length > 1048576) throw new Error("entry image exceeds the gate caps");

const out =
  process.env.ENTRY_OUTPUT ??
  (process.env.MAKEFUN_OUTPUT_DIR ? join(process.env.MAKEFUN_OUTPUT_DIR, "entry.png") : "/output/entry.png");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes, ${W}x${H})`);
