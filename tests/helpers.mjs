// Minimal NBT + Anvil writers, only for building fixtures in tests.
import { deflateSync } from 'node:zlib';

export const tag = {
  byte: (v) => ({ t: 1, v }), int: (v) => ({ t: 3, v }), long: (v) => ({ t: 4, v }),
  string: (v) => ({ t: 8, v }), list: (type, v) => ({ t: 9, type, v }), compound: (v) => ({ t: 10, v }),
  longArray: (v) => ({ t: 12, v }),
};

function payload(parts, { t, v, type }) {
  const b = (n) => { const x = Buffer.alloc(n); parts.push(x); return x; };
  const str = (s) => { const s8 = Buffer.from(s, 'utf8'); b(2).writeUInt16BE(s8.length); parts.push(s8); };
  switch (t) {
    case 1: b(1).writeInt8(v); break;
    case 3: b(4).writeInt32BE(v); break;
    case 4: b(8).writeBigInt64BE(BigInt(v)); break;
    case 8: str(v); break;
    case 9: b(1).writeInt8(type); b(4).writeInt32BE(v.length); for (const e of v) payload(parts, { t: type, ...e }); break;
    case 10:
      for (const [k, e] of Object.entries(v)) { b(1).writeInt8(e.t); str(k); payload(parts, e); }
      b(1).writeInt8(0);
      break;
    case 12: b(4).writeInt32BE(v.length); for (const x of v) b(8).writeBigInt64BE(BigInt.asIntN(64, x)); break;
    default: throw new Error(`fixture writer: tag ${t}`);
  }
}

export function writeNbt(root) {
  const parts = [Buffer.from([10, 0, 0])];
  payload(parts, { t: 10, v: root });
  return Buffer.concat(parts);
}

// Packs values `bits` wide, never straddling longs.
export function pack(values, bits) {
  const per = Math.floor(64 / bits);
  const out = new Array(Math.ceil(values.length / per)).fill(0n);
  values.forEach((v, i) => { out[Math.floor(i / per)] |= BigInt(v) << BigInt((i % per) * bits); });
  return out;
}

// One region file with the given chunks: [{ cx, cz, nbt }], zlib-compressed.
export function writeRegion(chunks) {
  const header = Buffer.alloc(8192);
  const bodies = [];
  let sector = 2;
  for (const { cx, cz, nbt } of chunks) {
    const data = deflateSync(writeNbt(nbt));
    const body = Buffer.alloc(Math.ceil((data.length + 5) / 4096) * 4096);
    body.writeUInt32BE(data.length + 1, 0);
    body[4] = 2;
    data.copy(body, 5);
    header.writeUInt32BE((sector << 8) | (body.length / 4096), (cz * 32 + cx) * 4);
    sector += body.length / 4096;
    bodies.push(body);
  }
  return Buffer.concat([header, ...bodies]);
}
