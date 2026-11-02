// ---------------------------------------------------------------------------------------------
// Python-compatible primitives. The generator must give exactly the same house for the same seed
// as the original Python version, so randomness, hashing and rounding follow CPython bit for bit.
// ---------------------------------------------------------------------------------------------

// round(): round half to even (Python 3)
function pyRound(x, nd) {
  if (nd) { const m = Math.pow(10, nd); return pyRound(x * m) / m; }
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
// a // b and a % b with Python semantics (floor)
function fdiv(a, b) {
  if (Number.isInteger(a) && Number.isInteger(b)) return Math.floor(a / b);
  // CPython float_floor_div
  let mod = a % b, div = (a - mod) / b;
  if (mod && ((b < 0) !== (mod < 0))) { mod += b; div -= 1; }
  let fl;
  if (div) { fl = Math.floor(div); if (div - fl > 0.5) fl += 1; } else fl = 0 * a / b;
  return fl;
}
function pmod(a, b) { const m = a % b; return (m && ((m < 0) !== (b < 0))) ? m + b : m; }
// f"{x:.Nf}": exact-decimal rounding, ties to even (only exact binary ties matter)
function fmt(x, n = 1) {
  const ex = Math.abs(x).toFixed(80), dot = ex.indexOf('.'), rest = ex.slice(dot + 1 + n);
  if (/^50*$/.test(rest)) {                          // exact binary tie: Python rounds half to even
    const m = Math.pow(10, n), t = Math.trunc(Math.abs(x) * m), r = (t % 2 === 0 ? t : t + 1) / m;
    return (x < 0 ? '-' : '') + r.toFixed(n);
  }
  return x.toFixed(n);
}
// repr() of a tuple of ints / bigints / strings (what _h hashes)
function reprStr(s) {
  const q = (s.includes("'") && !s.includes('"')) ? '"' : "'";
  let o = q;
  for (const ch of s) {
    if (ch === '\\') o += '\\\\';
    else if (ch === q) o += '\\' + q;
    else if (ch === '\n') o += '\\n';
    else if (ch === '\t') o += '\\t';
    else if (ch === '\r') o += '\\r';
    else o += ch;
  }
  return o + q;
}
function reprVal(v) {
  if (typeof v === 'string') return reprStr(v);
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) throw new Error('reprVal: float not supported');
    return Object.is(v, -0) ? '0' : String(v);
  }
  throw new Error('reprVal: ' + typeof v);
}
function reprTuple(vals) { return vals.length === 1 ? '(' + reprVal(vals[0]) + ',)' : '(' + vals.map(reprVal).join(', ') + ')'; }

const utf8 = s => new TextEncoder().encode(s);

// ---- SHA-256 ----
const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
function sha256(bytes) {
  const l = bytes.length, nb = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(nb);
  m.set(bytes); m[l] = 0x80;
  const bits = l * 8; for (let i = 0; i < 8; i++) m[nb - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < nb; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = H[i] >>> 16; out[4 * i + 2] = H[i] >>> 8; out[4 * i + 3] = H[i]; }
  return out;
}

// ---- BLAKE2b (64-bit words as uint32 pairs), digest size 8 ----
const B2_IV = new Uint32Array([0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a, 0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c, 0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19]);
const SIGMA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3, 11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4, 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8, 9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13, 2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9, 12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11, 13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10, 6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5, 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3].map(x => x * 2);
const V = new Uint32Array(32), M = new Uint32Array(32);
function add64(a, b) { const o0 = V[a] + V[b]; let o1 = V[a + 1] + V[b + 1]; if (o0 >= 0x100000000) o1++; V[a] = o0; V[a + 1] = o1; }
function add64c(a, b0, b1) { let o0 = V[a] + b0; if (b0 < 0) o0 += 0x100000000; let o1 = V[a + 1] + b1; if (o0 >= 0x100000000) o1++; V[a] = o0; V[a + 1] = o1; }
function B2G(a, b, c, d, ix, iy) {
  const x0 = M[ix], x1 = M[ix + 1], y0 = M[iy], y1 = M[iy + 1];
  add64(a, b); add64c(a, x0, x1);
  let t0 = V[d] ^ V[a], t1 = V[d + 1] ^ V[a + 1]; V[d] = t1; V[d + 1] = t0;
  add64(c, d);
  t0 = V[b] ^ V[c]; t1 = V[b + 1] ^ V[c + 1]; V[b] = (t0 >>> 24) ^ (t1 << 8); V[b + 1] = (t1 >>> 24) ^ (t0 << 8);
  add64(a, b); add64c(a, y0, y1);
  t0 = V[d] ^ V[a]; t1 = V[d + 1] ^ V[a + 1]; V[d] = (t0 >>> 16) ^ (t1 << 16); V[d + 1] = (t1 >>> 16) ^ (t0 << 16);
  add64(c, d);
  t0 = V[b] ^ V[c]; t1 = V[b + 1] ^ V[c + 1]; V[b] = (t1 >>> 31) ^ (t0 << 1); V[b + 1] = (t0 >>> 31) ^ (t1 << 1);
}
function b2compress(h, block, t, last) {
  for (let i = 0; i < 16; i++) { V[i] = h[i]; V[i + 16] = B2_IV[i]; }
  V[24] ^= t; V[25] ^= (t / 0x100000000);
  if (last) { V[28] = ~V[28]; V[29] = ~V[29]; }
  for (let i = 0; i < 32; i++) M[i] = block[i * 4] ^ (block[i * 4 + 1] << 8) ^ (block[i * 4 + 2] << 16) ^ (block[i * 4 + 3] << 24);
  for (let i = 0; i < 12; i++) {
    const s = SIGMA, o = i * 16;
    B2G(0, 8, 16, 24, s[o + 0], s[o + 1]); B2G(2, 10, 18, 26, s[o + 2], s[o + 3]); B2G(4, 12, 20, 28, s[o + 4], s[o + 5]); B2G(6, 14, 22, 30, s[o + 6], s[o + 7]);
    B2G(0, 10, 20, 30, s[o + 8], s[o + 9]); B2G(2, 12, 22, 24, s[o + 10], s[o + 11]); B2G(4, 14, 16, 26, s[o + 12], s[o + 13]); B2G(6, 8, 18, 28, s[o + 14], s[o + 15]);
  }
  for (let i = 0; i < 16; i++) h[i] = h[i] ^ V[i] ^ V[i + 16];
}
function blake2b8(bytes) {
  const h = new Uint32Array(B2_IV);
  h[0] ^= 0x01010000 ^ 8;           // digest 8, key 0, fanout 1, depth 1
  const block = new Uint8Array(128);
  let t = 0, off = 0;
  while (bytes.length - off > 128) { block.set(bytes.subarray(off, off + 128)); t += 128; b2compress(h, block, t, false); off += 128; }
  block.fill(0); block.set(bytes.subarray(off)); t += bytes.length - off; b2compress(h, block, t, true);
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) out[i] = h[i >> 2] >>> (8 * (i & 3));
  return out;
}

// ---- Mersenne Twister with Python's random.Random API ----
class PyRandom {
  constructor(seed) {
    this.mt = new Uint32Array(624); this.mti = 625;
    let n = typeof seed === 'bigint' ? seed : BigInt(seed);
    if (n < 0n) n = -n;
    const key = [];
    do { key.push(Number(n & 0xffffffffn)); n >>= 32n; } while (n > 0n);
    this._initArray(key);
  }
  _init(s) {
    const mt = this.mt; mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) { const p = mt[i - 1] ^ (mt[i - 1] >>> 30); mt[i] = (Math.imul(1812433253, p) + i) >>> 0; }
    this.mti = 624;
  }
  _initArray(key) {
    this._init(19650218); const mt = this.mt; let i = 1, j = 0;
    for (let k = Math.max(624, key.length); k; k--) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(p, 1664525)) + key[j] + j) >>> 0; i++; j++;
      if (i >= 624) { mt[0] = mt[623]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k; k--) {
      const p = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(p, 1566083941)) - i) >>> 0; i++;
      if (i >= 624) { mt[0] = mt[623]; i = 1; }
    }
    mt[0] = 0x80000000;
  }
  _u32() {
    const mt = this.mt; let y;
    if (this.mti >= 624) {
      let k = 0;
      for (; k < 624 - 397; k++) { y = (mt[k] & 0x80000000) | (mt[k + 1] & 0x7fffffff); mt[k] = mt[k + 397] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0); }
      for (; k < 623; k++) { y = (mt[k] & 0x80000000) | (mt[k + 1] & 0x7fffffff); mt[k] = mt[k - 227] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0); }
      y = (mt[623] & 0x80000000) | (mt[0] & 0x7fffffff); mt[623] = mt[396] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      this.mti = 0;
    }
    y = mt[this.mti++];
    y ^= y >>> 11; y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= y >>> 18;
    return y >>> 0;
  }
  random() { const a = this._u32() >>> 5, b = this._u32() >>> 6; return (a * 67108864 + b) / 9007199254740992; }
  getrandbits(k) { if (k <= 0) return 0; if (k > 32) throw new Error('getrandbits > 32'); return this._u32() >>> (32 - k); }
  _randbelow(n) { const k = Math.floor(Math.log2(n)) + 1; let r = this.getrandbits(k); while (r >= n) r = this.getrandbits(k); return r; }
  randint(a, b) { return a + this._randbelow(b - a + 1); }
  choice(seq) { if (!seq.length) throw new Error('choice from empty sequence'); return seq[this._randbelow(seq.length)]; }
  shuffle(x) { for (let i = x.length - 1; i > 0; i--) { const j = this._randbelow(i + 1); const t = x[i]; x[i] = x[j]; x[j] = t; } }
}

function deriveSeed(seed, aspect) {
  const d = sha256(utf8(`${seed}:${aspect}`));
  let n = 0n; for (let i = 0; i < 8; i++) n = (n << 8n) | BigInt(d[i]);
  return n;
}
function _h(...vals) {
  const d = blake2b8(utf8(reprTuple(vals)));
  // int.from_bytes(d, "big") / 2**64 : correctly rounded division of a 64-bit integer
  let n = 0n; for (let i = 0; i < 8; i++) n = (n << 8n) | BigInt(d[i]);
  return Number(n) / 18446744073709551616;
}
