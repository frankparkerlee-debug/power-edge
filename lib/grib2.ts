import { inflateSync } from "node:zlib";

/**
 * Just enough GRIB2 to read NOAA's MRMS MESH (radar hail size) files without
 * native libraries: a regular lat/lon grid (template 3.0) packed as a PNG
 * image (template 5.41), no bitmap. Anything else throws, so a format change
 * at NOAA fails loudly instead of loading wrong numbers.
 *
 * Only the rows we ask for are kept: the full CONUS grid is 7000 x 3500, and
 * DFW is 165 rows of it.
 */

export type Grib2Grid = {
  ni: number; // columns
  nj: number; // rows
  lat0: number; // first (north-west) point
  lon0: number; // in -180..180
  di: number; // degrees per column
  dj: number; // degrees per row
};

/** GRIB2 signed integers keep the sign in the top bit. */
function signed(n: number, bits: number) {
  const top = 2 ** (bits - 1);
  return n >= top ? -(n - top) : n;
}

function sections(buf: Buffer) {
  if (buf.toString("latin1", 0, 4) !== "GRIB" || buf[7] !== 2) throw new Error("not a GRIB2 message");
  const out: Record<number, Buffer> = {};
  let p = 16;
  while (p < buf.length - 4) {
    if (buf.toString("latin1", p, p + 4) === "7777") break;
    const len = buf.readUInt32BE(p);
    const num = buf[p + 4];
    out[num] = buf.subarray(p, p + len);
    p += len;
  }
  return out;
}

/** Decode the PNG in section 7, keeping rows rowFrom..rowTo (inclusive). */
function pngRows(png: Buffer, rowFrom: number, rowTo: number) {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error("section 7 is not a PNG");
  let p = 8;
  let width = 0, height = 0, depth = 0, color = -1, interlace = 0;
  const idat: Buffer[] = [];
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const type = png.toString("latin1", p + 4, p + 8);
    const data = png.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      color = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (color !== 0 || interlace !== 0 || (depth !== 8 && depth !== 16)) {
    throw new Error(`unsupported PNG: color ${color}, depth ${depth}, interlace ${interlace}`);
  }
  const bpp = depth / 8;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < height * (stride + 1)) throw new Error("PNG data is short");

  let prev = Buffer.alloc(stride);
  let cur = Buffer.alloc(stride);
  const kept: Uint16Array[] = [];
  const last = Math.min(rowTo, height - 1);
  for (let y = 0; y <= last; y++) {
    const off = y * (stride + 1);
    const f = raw[off];
    for (let x = 0; x < stride; x++) {
      const v = raw[off + 1 + x];
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let out: number;
      switch (f) {
        case 0: out = v; break;
        case 1: out = v + a; break;
        case 2: out = v + b; break;
        case 3: out = v + ((a + b) >> 1); break;
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`bad PNG filter ${f}`);
      }
      cur[x] = out & 0xff;
    }
    if (y >= rowFrom) {
      const row = new Uint16Array(width);
      for (let x = 0; x < width; x++) row[x] = depth === 16 ? (cur[2 * x] << 8) | cur[2 * x + 1] : cur[x];
      kept.push(row);
    }
    [prev, cur] = [cur, prev];
  }
  return { width, rows: kept };
}

/** The grid a message is on, read from section 3 without touching the data. */
export function gridOf(msg: Buffer): Grib2Grid {
  const s3 = sections(msg)[3];
  if (!s3) throw new Error("missing GRIB2 grid section");
  if (s3.readUInt16BE(12) !== 0) throw new Error(`grid template ${s3.readUInt16BE(12)}, expected 0`);
  if (s3[71] !== 0) throw new Error(`scanning mode ${s3[71]}, expected 0`);
  return {
    ni: s3.readUInt32BE(30),
    nj: s3.readUInt32BE(34),
    lat0: signed(s3.readUInt32BE(46), 32) / 1e6,
    lon0: ((s3.readUInt32BE(50) / 1e6 + 180) % 360) - 180,
    di: s3.readUInt32BE(63) / 1e6,
    dj: s3.readUInt32BE(67) / 1e6,
  };
}

/**
 * Values for a window of the grid: rows r0..r0+nr-1, columns c0..c0+nc-1,
 * row 0 being the grid's northern edge. Returns the grid description too, so
 * the caller can check the window lines up with what it expects.
 */
export function decodeWindow(msg: Buffer, r0: number, nr: number, c0: number, nc: number) {
  const s = sections(msg);
  const s5 = s[5], s6 = s[6], s7 = s[7];
  if (!s5 || !s7) throw new Error("missing GRIB2 sections");
  const grid = gridOf(msg);
  if (s5.readUInt16BE(9) !== 41) throw new Error(`packing template ${s5.readUInt16BE(9)}, expected 41 (PNG)`);
  if (s6 && s6[5] !== 255) throw new Error("bitmaps are not supported");
  const R = s5.readFloatBE(11);
  const E = signed(s5.readUInt16BE(15), 16);
  const D = signed(s5.readUInt16BE(17), 16);
  const { width, rows } = pngRows(s7.subarray(5), r0, r0 + nr - 1);
  if (width !== grid.ni) throw new Error("PNG width does not match the grid");
  const scale = 2 ** E, div = 10 ** D;
  const values: number[][] = rows.map((row) => {
    const out: number[] = [];
    for (let c = c0; c < c0 + nc; c++) out.push((R + row[c] * scale) / div);
    return out;
  });
  return { grid, values };
}
