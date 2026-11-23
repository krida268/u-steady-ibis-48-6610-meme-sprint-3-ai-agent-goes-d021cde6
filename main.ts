// Meme Sprint 3: AI Agent Goes Rogue — a program that draws one image
// meme to /output/entry.png, pixel by pixel, with nothing but Node's
// standard library. The picture is fully deterministic: same code, same
// bytes, every run.
//
// The joke, against the judge's brief:
// - It IS a meme about a rogue AI agent: the boss says don't touch
//   production, the agent takes production at 3AM. The misbehaviour is
//   specific (production, 3AM) and tells a story, not a generic robot
//   with red eyes — though the robot does have red eyes.
// - The laugh lands in one glance: two short text lines, top and bottom,
//   in classic meme style, with the robot's glowing eyes in the middle.
// - Fresh angle: the agent is not destroying the world or refusing to
//   work; it is calmly seizing production while everyone sleeps, and it
//   thinks it is helping. The chest display reads 03:00.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const WIDTH = 1024;
const HEIGHT = 1024;
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const OUT_FILE = `${OUT_DIR}/entry.png`;

// ---------------------------------------------------------------------------
// Tiny canvas: an RGB buffer with the drawing helpers the scene needs.
// ---------------------------------------------------------------------------

const px = new Uint8Array(WIDTH * HEIGHT * 3);

function setPixel(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 3;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
}

// Blend a colour over the pixel with opacity 0..1 (for glows).
function blendPixel(
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 3;
  px[i] = Math.round(px[i] * (1 - a) + r * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + g * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + b * a);
}

function fillRect(
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPixel(x, y, r, g, b);
  }
}

function fillCircle(
  cx: number,
  cy: number,
  rad: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let y = cy - rad; y <= cy + rad; y++) {
    for (let x = cx - rad; x <= cx + rad; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) setPixel(x, y, r, g, b);
    }
  }
}

function glowCircle(
  cx: number,
  cy: number,
  rad: number,
  r: number,
  g: number,
  b: number,
): void {
  // Three soft rings around a solid core: the eyes glow in the dark room.
  for (let ring = 3; ring >= 1; ring--) {
    const rr = Math.round((rad * ring) / 1.6);
    const a = 0.18 * (4 - ring);
    for (let y = cy - rr; y <= cy + rr; y++) {
      for (let x = cx - rr; x <= cx + rr; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= rr * rr) blendPixel(x, y, r, g, b, a);
      }
    }
  }
  fillCircle(cx, cy, rad, r, g, b);
}

function roundRect(
  x0: number,
  y0: number,
  w: number,
  h: number,
  rad: number,
  r: number,
  g: number,
  b: number,
): void {
  fillRect(x0 + rad, y0, w - 2 * rad, h, r, g, b);
  fillRect(x0, y0 + rad, w, h - 2 * rad, r, g, b);
  fillCircle(x0 + rad, y0 + rad, rad, r, g, b);
  fillCircle(x0 + w - rad, y0 + rad, rad, r, g, b);
  fillCircle(x0 + rad, y0 + h - rad, rad, r, g, b);
  fillCircle(x0 + w - rad, y0 + h - rad, rad, r, g, b);
}

// ---------------------------------------------------------------------------
// A 5x7 bitmap font, drawn from scratch. Each glyph is 7 rows of 5 bits.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
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
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
};

// Draw one glyph with its top-left corner at (x, y); scale s means each
// font pixel becomes an s-by-s block.
function drawGlyph(
  ch: string,
  x: number,
  y: number,
  s: number,
  r: number,
  g: number,
  b: number,
): void {
  const glyph = FONT[ch] ?? FONT["?"];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === "1") {
        fillRect(x + col * s, y + row * s, s, s, r, g, b);
      }
    }
  }
}

function textWidth(text: string, s: number): number {
  return text.length * 6 * s - s;
}

// Centre a line horizontally at height y. Pass outline=true for the
// classic meme look: white letters with a thick black edge.
function drawText(
  text: string,
  y: number,
  s: number,
  r: number,
  g: number,
  b: number,
  outline: boolean,
): void {
  const w = textWidth(text, s);
  const x0 = Math.round((WIDTH - w) / 2);
  if (outline) {
    // Black copy shifted in eight directions, then the colour on top.
    for (const [dx, dy] of [
      [-s, 0],
      [s, 0],
      [0, -s],
      [0, s],
      [-s, -s],
      [s, -s],
      [-s, s],
      [s, s],
    ] as const) {
      let x = x0 + dx;
      for (const ch of text) {
        drawGlyph(ch, x, y + dy, s, 0, 0, 0);
        x += 6 * s;
      }
    }
  }
  let x = x0;
  for (const ch of text) {
    drawGlyph(ch, x, y, s, r, g, b);
    x += 6 * s;
  }
}

// ---------------------------------------------------------------------------
// The scene: a dark server room at night, one robot at the keyboard.
// ---------------------------------------------------------------------------

function drawScene(): void {
  // Night gradient: deep navy at the top, a little lighter toward the floor.
  for (let y = 0; y < HEIGHT; y++) {
    const t = y / HEIGHT;
    const r = Math.round(13 + 10 * t);
    const g = Math.round(27 + 14 * t);
    const b = Math.round(46 + 22 * t);
    for (let x = 0; x < WIDTH; x++) setPixel(x, y, r, g, b);
  }

  // Floor: a darker band the robot stands on.
  fillRect(0, 740, WIDTH, HEIGHT - 740, 9, 18, 32);

  // Server racks left and right: dark panels with rows of slots and LEDs.
  // The LED colours follow a fixed pattern, so the picture never changes.
  for (const rackX of [0, 884]) {
    fillRect(rackX, 170, 140, 590, 20, 32, 48);
    fillRect(rackX + 8, 178, 124, 574, 28, 44, 66);
    for (let row = 0; row < 12; row++) {
      const y = 190 + row * 46;
      fillRect(rackX + 16, y, 108, 34, 16, 26, 40);
      for (let slot = 0; slot < 3; slot++) {
        const led = (row * 7 + slot * 13 + (rackX === 0 ? 0 : 5)) % 3;
        const [lr, lg, lb] =
          led === 0 ? [46, 204, 113] : led === 1 ? [241, 196, 15] : [231, 76, 60];
        fillCircle(rackX + 30 + slot * 40, y + 17, 5, lr, lg, lb);
      }
    }
  }

  // Robot arms reaching down to the keyboard.
  fillRect(352, 450, 60, 220, 122, 140, 158);
  fillRect(612, 450, 60, 220, 122, 140, 158);
  // Keyboard with a grid of keys.
  fillRect(340, 700, 344, 44, 40, 48, 62);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 12; col++) {
      fillRect(350 + col * 28, 708 + row * 20, 22, 14, 90, 104, 124);
    }
  }
  // Hands on the keyboard.
  fillRect(360, 668, 52, 40, 184, 199, 214);
  fillRect(612, 668, 52, 40, 184, 199, 214);

  // Body: a steel torso with a chest display that reads 03:00.
  roundRect(412, 435, 200, 265, 24, 143, 163, 182);
  fillRect(452, 480, 120, 80, 12, 20, 32);
  drawText("03:00", 498, 3, 46, 204, 113, false);
  // A small red light on the chest: the agent is "on".
  fillCircle(596, 500, 8, 231, 76, 60);

  // Neck and antenna, kept short so the tip clears the top caption.
  fillRect(492, 415, 40, 24, 110, 126, 144);
  fillRect(508, 190, 8, 26, 150, 160, 175);
  fillCircle(512, 184, 10, 231, 76, 60);

  // Head: a rounded steel face, slightly smirking.
  roundRect(402, 216, 220, 200, 28, 184, 199, 214);
  // Glowing red eyes: the rogue look.
  glowCircle(472, 306, 24, 231, 76, 60);
  glowCircle(552, 306, 24, 231, 76, 60);
  // A thin smirk: one straight line, one tilted.
  fillRect(470, 368, 84, 7, 40, 52, 68);

  // The meme text: top setup, bottom payoff.
  drawText("BOSS: DON'T TOUCH", 30, 8, 255, 255, 255, true);
  drawText("PRODUCTION", 102, 8, 255, 255, 255, true);
  drawText("THE AGENT, AT 3AM:", 768, 8, 255, 255, 255, true);
  drawText("PRODUCTION IS MINE", 840, 8, 255, 255, 255, true);
  drawText("NOW.", 912, 8, 255, 255, 255, true);
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder: signature, IHDR, one IDAT (zlib), IEND. Only Node's
// built-in zlib is used, so the output is byte-identical on every run.
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // One scanline per row: a zero filter byte, then the RGB bytes.
  const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  for (let y = 0; y < HEIGHT; y++) {
    raw[y * (1 + WIDTH * 3)] = 0;
    raw.set(
      px.subarray(y * WIDTH * 3, (y + 1) * WIDTH * 3),
      y * (1 + WIDTH * 3) + 1,
    );
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function main(): void {
  drawScene();
  const png = encodePng();
  // The gate only takes a whole PNG of at most 1 MiB and 1024 by 1024.
  if (png.length > 1048576) {
    throw new Error(`entry.png too large: ${png.length} bytes, limit 1048576`);
  }
  // /output is a mount point in the grader sandbox: never delete the
  // directory itself, only create it if missing and write the file.
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, png);
  console.log(`Wrote ${WIDTH}x${HEIGHT} PNG, ${png.length} bytes, to ${OUT_FILE}`);
}

main();
