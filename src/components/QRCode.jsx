// QR generator + component — moved verbatim from Amelior8App.jsx.

const QR = (() => {
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x << 1) ^ (x >= 128 ? 0x11d : 0); } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const gfMul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;

  function rsEncode(data, ecLen) {
    let gen = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(gen.length + 1).fill(0);
      for (let j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= gfMul(gen[j], EXP[i]);
      }
      gen = next;
    }
    const msg = new Uint8Array(data.length + ecLen);
    msg.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef) for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coef);
    }
    return Array.from(msg.slice(data.length));
  }

  function encode(text) {
    const DATA_CW = 34, EC_CW = 10, SIZE = 25;
    const bytes = new TextEncoder().encode(text);
    let bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4);
    push(bytes.length, 8);
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, DATA_CW * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const pads = [0xEC, 0x11];
    let pi = 0;
    while (bits.length < DATA_CW * 8) { push(pads[pi % 2], 8); pi++; }
    const data = [];
    for (let i = 0; i < bits.length; i += 8)
      data.push(bits.slice(i, i + 8).reduce((a, b, j) => a | (b << (7 - j)), 0));
    const ec = rsEncode(new Uint8Array(data), EC_CW);
    const finalBits = [];
    for (const b of [...data, ...ec]) push.call(null, b, 8), finalBits.push(...bits.splice(bits.length - 8, 8));
    const allBits = [];
    const pushB = (val, len) => { for (let i = len - 1; i >= 0; i--) allBits.push((val >> i) & 1); };
    for (const b of [...data, ...ec]) pushB(b, 8);
    for (let i = 0; i < 7; i++) allBits.push(0);
    const M = Array.from({ length: SIZE }, () => new Int8Array(SIZE));
    const R = Array.from({ length: SIZE }, () => new Uint8Array(SIZE));
    const setFinder = (r, c) => {
      for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        M[rr][cc] = (inInner || (inOuter && onBorder)) ? 1 : 0;
        R[rr][cc] = 1;
      }
    };
    setFinder(0, 0); setFinder(0, SIZE - 7); setFinder(SIZE - 7, 0);
    const ac = 18;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      M[ac + dr][ac + dc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
      R[ac + dr][ac + dc] = 1;
    }
    for (let i = 8; i < SIZE - 8; i++) {
      M[6][i] = (i % 2 === 0) ? 1 : 0; R[6][i] = 1;
      M[i][6] = (i % 2 === 0) ? 1 : 0; R[i][6] = 1;
    }
    M[SIZE - 8][8] = 1; R[SIZE - 8][8] = 1;
    for (let i = 0; i < 9; i++) {
      if (i < SIZE) { R[8][i] = 1; R[i][8] = 1; }
    }
    for (let i = 0; i < 8; i++) {
      R[8][SIZE - 8 + i] = 1;
      R[SIZE - 8 + i][8] = 1;
    }
    let bitIdx = 0;
    let upward = true;
    for (let right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const rows = upward ? Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i) : Array.from({ length: SIZE }, (_, i) => i);
      for (const row of rows) {
        for (const col of [right, right - 1]) {
          if (!R[row][col]) {
            M[row][col] = bitIdx < allBits.length ? allBits[bitIdx] : 0;
            bitIdx++;
          }
        }
      }
      upward = !upward;
    }
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!R[r][c] && (r + c) % 2 === 0) M[r][c] ^= 1;
    const FORMAT_BITS = [1,1,1,0,1,1,1,1,1,0,0,0,1,0,0];
    const fmtPositions1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    const fmtPositions2 = [[SIZE-1,8],[SIZE-2,8],[SIZE-3,8],[SIZE-4,8],[SIZE-5,8],[SIZE-6,8],[SIZE-7,8],[8,SIZE-8],[8,SIZE-7],[8,SIZE-6],[8,SIZE-5],[8,SIZE-4],[8,SIZE-3],[8,SIZE-2],[8,SIZE-1]];
    for (let i = 0; i < 15; i++) {
      const [r1,c1] = fmtPositions1[i]; M[r1][c1] = FORMAT_BITS[i];
      const [r2,c2] = fmtPositions2[i]; M[r2][c2] = FORMAT_BITS[i];
    }
    return M;
  }

  return { encode };
})();

export function QRCode({ data, size = 160 }) {
  const matrix = QR.encode(data);
  const n = matrix.length;
  const cellSize = size / (n + 8);
  const offset = cellSize * 4;

  const rects = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (matrix[r][c])
        rects.push(
          <rect key={`${r}-${c}`} x={offset + c * cellSize} y={offset + r * cellSize}
            width={cellSize + 0.5} height={cellSize + 0.5} fill="#2C2C2A" rx="0.5" />
        );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
      <rect width={size} height={size} fill="#F0EBE1" rx="8" />
      {rects}
    </svg>
  );
}

// ============================================================
//  UNIQUE ID GENERATOR
