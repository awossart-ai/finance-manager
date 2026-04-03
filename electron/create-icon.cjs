'use strict'
/**
 * Génère un icône .icns pour macOS — carré arrondi style macOS avec "F" blanc sur fond violet.
 * Usage : node electron/create-icon.cjs
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ── CRC32 & PNG helpers ───────────────────────────────────────────────────────

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[i] = c
    }
    return t
  })()
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return ((crc ^ 0xffffffff) >>> 0)
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcVal])
}

/**
 * Génère un PNG RGBA (avec canal alpha pour coins transparents).
 * drawFn(x, y, size) → [r, g, b, a]
 */
function makePNG(size, drawFn) {
  // IHDR — color type 6 = RGBA
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA

  // Raw pixel data (4 bytes per pixel + 1 filter byte per row)
  const bytesPerRow = 1 + size * 4
  const raw = Buffer.alloc(size * bytesPerRow, 0)

  for (let y = 0; y < size; y++) {
    raw[y * bytesPerRow] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = drawFn(x, y, size)
      const off = y * bytesPerRow + 1 + x * 4
      raw[off]     = r
      raw[off + 1] = g
      raw[off + 2] = b
      raw[off + 3] = a
    }
  }

  const idat = zlib.deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Icon drawing function ─────────────────────────────────────────────────────

/**
 * Rounded rectangle test — macOS uses ~22% corner radius.
 * Returns true if pixel (x,y) is inside the rounded rectangle.
 */
function inRoundedRect(x, y, size) {
  const r = size * 0.22  // corner radius
  const margin = 0       // no border

  if (x < margin || x >= size - margin || y < margin || y >= size - margin) return false

  const ix = x - margin
  const iy = y - margin
  const w = size - 2 * margin

  // Top-left corner
  if (ix < r && iy < r) {
    return Math.sqrt((ix - r) ** 2 + (iy - r) ** 2) <= r
  }
  // Top-right corner
  if (ix > w - r - 1 && iy < r) {
    return Math.sqrt((ix - (w - r - 1)) ** 2 + (iy - r) ** 2) <= r
  }
  // Bottom-left corner
  if (ix < r && iy > w - r - 1) {
    return Math.sqrt((ix - r) ** 2 + (iy - (w - r - 1)) ** 2) <= r
  }
  // Bottom-right corner
  if (ix > w - r - 1 && iy > w - r - 1) {
    return Math.sqrt((ix - (w - r - 1)) ** 2 + (iy - (w - r - 1)) ** 2) <= r
  }

  return true
}

/**
 * Smooth anti-aliased edge at distance `d` from the boundary.
 * Returns alpha 0–255.
 */
function edgeAlpha(x, y, size) {
  const r = size * 0.22
  const margin = 0
  const ix = x - margin
  const iy = y - margin
  const w = size - 2 * margin

  let minDist = Infinity

  if (ix < r && iy < r) {
    minDist = Math.abs(Math.sqrt((ix - r) ** 2 + (iy - r) ** 2) - r)
  } else if (ix > w - r - 1 && iy < r) {
    minDist = Math.abs(Math.sqrt((ix - (w - r - 1)) ** 2 + (iy - r) ** 2) - r)
  } else if (ix < r && iy > w - r - 1) {
    minDist = Math.abs(Math.sqrt((ix - r) ** 2 + (iy - (w - r - 1)) ** 2) - r)
  } else if (ix > w - r - 1 && iy > w - r - 1) {
    minDist = Math.abs(Math.sqrt((ix - (w - r - 1)) ** 2 + (iy - (w - r - 1)) ** 2) - r)
  } else {
    // Not in corner — interior is fully opaque
    return 255
  }

  // Sub-pixel anti-aliasing
  const aa = 1.5
  if (minDist < aa) return Math.round(255 * (1 - minDist / aa))
  return 0
}

function drawIcon(x, y, size) {
  // Outside rounded rect → transparent
  if (!inRoundedRect(x, y, size)) {
    // Check if we're close to the edge for anti-aliasing
    const a = edgeAlpha(x, y, size)
    if (a === 0) return [0, 0, 0, 0]
    // Blend background color with transparency
    const t = y / size
    const r = Math.round(249 + (234 - 249) * t)
    const g = Math.round(115 + (88 - 115) * t)
    const b = Math.round(22 + (12 - 22) * t)
    return [r, g, b, a]
  }

  // Background gradient: orange-500 (#f97316) → orange-600 (#ea580c)
  const t = y / size
  const bgR = Math.round(249 + (234 - 249) * t)  // 249→234
  const bgG = Math.round(115 + (88 - 115) * t)   // 115→88
  const bgB = Math.round(22 + (12 - 22) * t)     // 22→12

  // Normalize coords
  const nx = x / size
  const ny = y / size

  // ── Draw "F" letter ──────────────────────────────────────────────
  // The F occupies roughly x: 0.27–0.70, y: 0.20–0.80
  // Vertical bar: x 0.27–0.40, y 0.20–0.80 (full height)
  // Top horizontal bar: x 0.27–0.70, y 0.20–0.33
  // Middle horizontal bar: x 0.27–0.60, y 0.47–0.59

  const strokeW = 0.005  // anti-aliasing softness in normalized units

  // Vertical bar
  const inVertBar = nx >= 0.27 && nx <= 0.42 && ny >= 0.19 && ny <= 0.81

  // Top horizontal bar
  const inTopBar = nx >= 0.27 && nx <= 0.71 && ny >= 0.19 && ny <= 0.34

  // Middle horizontal bar
  const inMidBar = nx >= 0.27 && nx <= 0.61 && ny >= 0.47 && ny <= 0.59

  if (inVertBar || inTopBar || inMidBar) {
    // White letter with slight inner shadow for depth
    const edgeFactor = 1.0
    return [255, 255, 255, Math.round(255 * edgeFactor)]
  }

  // Subtle inner glow at the bottom for depth
  const depthT = Math.pow(ny, 2) * 0.15
  const finalR = Math.min(255, Math.round(bgR + depthT * 30))
  const finalG = Math.min(255, Math.round(bgG + depthT * 10))
  const finalB = Math.min(255, Math.round(bgB + depthT * 5))

  return [finalR, finalG, finalB, 255]
}

// ── Generate icons ────────────────────────────────────────────────────────────

const assetsDir = path.join(__dirname, '../build')
const iconsetDir = path.join(assetsDir, 'icon.iconset')

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })
if (!fs.existsSync(iconsetDir)) fs.mkdirSync(iconsetDir, { recursive: true })

const sizes = [16, 32, 64, 128, 256, 512, 1024]
console.log('🎨 Génération de l\'icône Finance Manager (F orange — pré-commercial)...')

for (const s of sizes) {
  const png = makePNG(s, drawIcon)
  fs.writeFileSync(path.join(iconsetDir, `icon_${s}x${s}.png`), png)
  if (s <= 512) {
    fs.writeFileSync(path.join(iconsetDir, `icon_${s}x${s}@2x.png`), makePNG(s * 2, drawIcon))
  }
  process.stdout.write(`  ✓ ${s}x${s}\n`)
}

try {
  const icnsPath = path.join(assetsDir, 'icon.icns')
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`)
  console.log(`\n✅ Icône générée : ${icnsPath}`)
} catch (e) {
  console.log('\n⚠️  iconutil non disponible — PNGs générés dans build/icon.iconset/')
}
