import { useState, useEffect, useRef } from "react";

const screens = {
  HOME: "home",
  CAUSE: "cause",
  COUNTRY: "country",
  PARTNER: "partner",
  AMOUNT: "amount",
  DONOR_INFO: "donor_info",
  CONFIRM: "confirm",
  PROCESSING: "processing",
  QR_READY: "qr_ready",
  TRACKING: "tracking",
  VIDEO: "video",
  SHARE: "share",
};

// ============================================================
//  FIREBASE CONFIG
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB8r_o3Vgxnu6ClOZ52RVoTnP7OyVAL37s",
  authDomain: "amelior8it.firebaseapp.com",
  projectId: "amelior8it",
  storageBucket: "amelior8it.firebasestorage.app",
};

let firebaseApp = null;
let db = null;

function initFirebase() {
  if (firebaseApp) return true;
  if (!FIREBASE_CONFIG.apiKey) return false;
  try {
    if (typeof firebase !== "undefined" && !firebase.apps.length) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      return true;
    }
    return false;
  } catch (e) {
    console.error("Firebase init error:", e);
    return false;
  }
}

// ============================================================
//  QR CODE GENERATOR
// ============================================================
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

function QRCode({ data, size = 160 }) {
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
            width={cellSize + 0.5} height={cellSize + 0.5} fill="#1a1a2e" rx="0.5" />
        );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
      <rect width={size} height={size} fill="rgba(255,255,255,0.85)" rx="8" />
      {rects}
    </svg>
  );
}

// ============================================================
//  UNIQUE ID GENERATOR
// ============================================================
function generateDonorId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "DON-";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// ============================================================
//  ICONS — minimal inline SVGs
// ============================================================
const Icon = {
  droplet: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" fill={c} fillOpacity="0.15" />
    </svg>
  ),
  book: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  heart: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c} fillOpacity="0.15" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  wheat: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 22L16 8" /><path d="M3.47 12.53L5 11l1.53 1.53a3.5 3.5 0 010 4.94L5 19l-1.53-1.53a3.5 3.5 0 010-4.94z" />
      <path d="M7.47 8.53L9 7l1.53 1.53a3.5 3.5 0 010 4.94L9 15l-1.53-1.53a3.5 3.5 0 010-4.94z" />
      <path d="M11.47 4.53L13 3l1.53 1.53a3.5 3.5 0 010 4.94L13 11l-1.53-1.53a3.5 3.5 0 010-4.94z" />
    </svg>
  ),
  globe: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  shield: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
  lock: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  video: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  bell: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  mail: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  send: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  copy: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  chat: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  check: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  arrowLeft: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  chevronRight: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  tag: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  package: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  cpu: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  play: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  ),
  share: (s = 20, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
};

// ============================================================
//  DESIGN TOKENS
// ============================================================
const glass = {
  panel: {
    background: "rgba(255, 255, 255, 0.45)",
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    border: "1px solid rgba(255, 255, 255, 0.55)",
    borderRadius: "20px",
    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
  },
  panelLight: {
    background: "rgba(255, 255, 255, 0.3)",
    backdropFilter: "blur(16px) saturate(150%)",
    WebkitBackdropFilter: "blur(16px) saturate(150%)",
    border: "1px solid rgba(255, 255, 255, 0.4)",
    borderRadius: "16px",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.03)",
  },
  panelAccent: {
    background: "rgba(224, 107, 60, 0.08)",
    backdropFilter: "blur(16px) saturate(150%)",
    WebkitBackdropFilter: "blur(16px) saturate(150%)",
    border: "1px solid rgba(224, 107, 60, 0.15)",
    borderRadius: "16px",
  },
  panelSuccess: {
    background: "rgba(52, 199, 89, 0.08)",
    backdropFilter: "blur(16px) saturate(150%)",
    WebkitBackdropFilter: "blur(16px) saturate(150%)",
    border: "1px solid rgba(52, 199, 89, 0.15)",
    borderRadius: "16px",
  },
};

const colors = {
  accent: "#d4603a",
  accentLight: "rgba(212, 96, 58, 0.12)",
  accentGlow: "rgba(212, 96, 58, 0.25)",
  text: "#1a1a2e",
  textSecondary: "rgba(0, 0, 0, 0.48)",
  textTertiary: "rgba(0, 0, 0, 0.3)",
  success: "#34c759",
  successText: "#1b5e30",
  white60: "rgba(255,255,255,0.6)",
  white40: "rgba(255,255,255,0.4)",
  divider: "rgba(0,0,0,0.06)",
};

const fonts = {
  system: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', sans-serif",
  mono: "'SF Mono', 'Fira Code', 'Courier New', monospace",
};

// ============================================================
//  INPUT FIELD
// ============================================================
function InputField({ label, value, onChange, placeholder, type = "text", error }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={{
        display: "block", fontSize: "11px", fontWeight: 600,
        color: colors.textSecondary, marginBottom: "5px",
        letterSpacing: "0.02em", fontFamily: fonts.system,
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: "14px",
          border: error ? "1.5px solid #ef4444" : "1px solid rgba(255,255,255,0.5)",
          fontSize: "14px", fontFamily: fonts.system,
          background: "rgba(255, 255, 255, 0.45)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: colors.text, outline: "none",
          boxSizing: "border-box",
          transition: "all 0.2s ease",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = colors.accent;
          e.target.style.boxShadow = `0 0 0 3px ${colors.accentGlow}, 0 2px 8px rgba(0,0,0,0.03)`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "#ef4444" : "rgba(255,255,255,0.5)";
          e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)";
        }}
      />
      {error && <p style={{ fontSize: "11px", color: "#ef4444", margin: "4px 0 0", fontWeight: 600, fontFamily: fonts.system }}>{error}</p>}
    </div>
  );
}

export default function Amelior8App() {
  const [screen, setScreen] = useState(screens.HOME);
  const [selectedCause, setSelectedCause] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [donorInfo, setDonorInfo] = useState({ name: "", email: "", phone: "" });
  const [donorId, setDonorId] = useState(null);
  const [processingDone, setProcessingDone] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [history, setHistory] = useState([]);
  const [errors, setErrors] = useState({});

  const causes = [
    { icon: "droplet", label: "Water", color: "#3b82f6" },
    { icon: "book", label: "Education", color: "#8b5cf6" },
    { icon: "heart", label: "Health", color: "#ef4444" },
    { icon: "wheat", label: "Food", color: "#f59e0b" },
  ];

  const countries = [
    { code: "KE", name: "Kenya", projects: 12 },
    { code: "UG", name: "Uganda", projects: 8 },
    { code: "NG", name: "Nigeria", projects: 15 },
    { code: "TZ", name: "Tanzania", projects: 6 },
  ];

  const partners = {
    Water: [
      { name: "Maji Safi Initiative", location: "Kisumu", verified: true, funded: "82%" },
      { name: "Clean Wells Project", location: "Nairobi", verified: true, funded: "45%" },
    ],
    Education: [
      { name: "Bright Futures Academy", location: "Kampala", verified: true, funded: "67%" },
      { name: "Read Africa", location: "Lagos", verified: true, funded: "33%" },
    ],
    Health: [
      { name: "Rural Health Kenya", location: "Mombasa", verified: true, funded: "55%" },
      { name: "MedAid Uganda", location: "Entebbe", verified: true, funded: "71%" },
    ],
    Food: [
      { name: "Harvest Hope", location: "Dar es Salaam", verified: true, funded: "40%" },
      { name: "Feed the Future NGO", location: "Abuja", verified: true, funded: "60%" },
    ],
  };

  const amounts = [20, 50, 100, 250];

  const navigate = (next) => {
    setHistory((h) => [...h, screen]);
    setScreen(next);
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setScreen(prev);
    }
  };

  const resetAll = () => {
    setSelectedCause(null);
    setSelectedCountry(null);
    setSelectedPartner(null);
    setSelectedAmount(null);
    setDonorInfo({ name: "", email: "", phone: "" });
    setDonorId(null);
    setProcessingDone(false);
    setProcessingStep(0);
    setVideoProgress(0);
    setIsPlaying(false);
    setShowNotification(false);
    setErrors({});
    setHistory([]);
    setScreen(screens.HOME);
  };

  // ============================================================
  //  DONATION PROCESSING
  // ============================================================
  async function processDonation() {
    const newDonorId = generateDonorId();
    setDonorId(newDonorId);

    setProcessingStep(1);
    await new Promise((r) => setTimeout(r, 800));

    const donorDoc = {
      name: donorInfo.name,
      email: donorInfo.email,
      phone: donorInfo.phone || null,
      item: selectedCause?.label || "Gift",
      cause: selectedCause?.label,
      country: selectedCountry?.name,
      partner: selectedPartner?.name,
      partnerLocation: selectedPartner?.location,
      amount: selectedAmount,
      currency: "USD",
      donatedAt: new Date().toISOString(),
      status: "pending_delivery",
      videoURL: null,
      videoSentAt: null,
    };

    if (initFirebase() && db) {
      try {
        await db.collection("donors").doc(newDonorId).set(donorDoc);
        console.log("Donor saved to Firestore:", newDonorId);
      } catch (err) {
        console.error("Firestore write error:", err);
      }
    } else {
      console.log("Firebase not configured — donor record (local only):", newDonorId, donorDoc);
    }

    setProcessingStep(2);
    await new Promise((r) => setTimeout(r, 600));

    setProcessingStep(3);
    await new Promise((r) => setTimeout(r, 600));

    setProcessingDone(true);
    await new Promise((r) => setTimeout(r, 600));
    navigate(screens.QR_READY);
  }

  useEffect(() => {
    if (screen === screens.PROCESSING) {
      processDonation();
    }
  }, [screen]);

  useEffect(() => {
    if (isPlaying && videoProgress < 100) {
      const t = setInterval(() => {
        setVideoProgress((p) => {
          if (p >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return p + 2;
        });
      }, 100);
      return () => clearInterval(t);
    }
  }, [isPlaying, videoProgress]);

  useEffect(() => {
    if (screen === screens.TRACKING) {
      const t = setTimeout(() => setShowNotification(true), 1500);
      return () => clearTimeout(t);
    } else {
      setShowNotification(false);
    }
  }, [screen]);

  // ============================================================
  //  VALIDATION
  // ============================================================
  function validateDonorInfo() {
    const errs = {};
    if (!donorInfo.name.trim()) errs.name = "Name is required";
    if (!donorInfo.email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorInfo.email)) {
      errs.email = "Enter a valid email";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ============================================================
  //  HELPER — render cause icon
  // ============================================================
  const renderIcon = (iconName, size = 20, color = "currentColor") => {
    const fn = Icon[iconName];
    return fn ? fn(size, color) : null;
  };

  // ============================================================
  //  SHARED COMPONENTS
  // ============================================================
  const Header = ({ title, showBack = true, rightAction }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 0 14px", borderBottom: `1px solid ${colors.divider}`, marginBottom: "16px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {showBack && history.length > 0 && (
          <div onClick={goBack} style={{
            cursor: "pointer", color: colors.accent, lineHeight: 1,
            width: "28px", height: "28px", borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: colors.accentLight,
            transition: "all 0.2s ease",
          }}>{Icon.arrowLeft(16, colors.accent)}</div>
        )}
        <span style={{ fontSize: "15px", fontWeight: 700, color: colors.text, fontFamily: fonts.system, letterSpacing: "-0.01em" }}>{title}</span>
      </div>
      {rightAction || (
        <span style={{ fontSize: "10px", color: colors.accent, fontWeight: 700, letterSpacing: "0.12em", fontFamily: fonts.system }}>AMELIOR8</span>
      )}
    </div>
  );

  const Btn = ({ children, onClick, primary = true, disabled = false, style: s = {} }) => (
    <div onClick={disabled ? undefined : onClick} style={{
      padding: "14px", borderRadius: "16px", textAlign: "center",
      fontWeight: 700, fontSize: "14px", cursor: disabled ? "default" : "pointer",
      fontFamily: fonts.system, letterSpacing: "-0.01em",
      background: primary
        ? `linear-gradient(135deg, ${colors.accent}, #b84a28)`
        : "rgba(255, 255, 255, 0.45)",
      backdropFilter: primary ? "none" : "blur(20px)",
      WebkitBackdropFilter: primary ? "none" : "blur(20px)",
      color: primary ? "white" : colors.text,
      border: primary ? "none" : "1px solid rgba(255,255,255,0.5)",
      transition: "all 0.25s ease",
      opacity: disabled ? 0.4 : 1,
      boxShadow: primary
        ? `0 4px 20px ${colors.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.2)`
        : "0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
      ...s
    }}>{children}</div>
  );

  // ============================================================
  //  SCREENS
  // ============================================================
  const renderScreen = () => {
    switch (screen) {

      // ==================== HOME ====================
      case screens.HOME:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
                <div style={{
                  width: "60px", height: "60px", borderRadius: "18px",
                  background: `linear-gradient(135deg, ${colors.accent}, #e8845c)`,
                  margin: "0 auto 14px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 8px 28px ${colors.accentGlow}`,
                }}>
                  {Icon.globe(28, "rgba(255,255,255,0.95)")}
                </div>
                <h1 style={{
                  fontFamily: fonts.system, fontSize: "28px", fontWeight: 800,
                  color: colors.text, margin: "0 0 4px", letterSpacing: "-0.03em",
                }}>amelior8</h1>
                <p style={{ fontSize: "13px", color: colors.textSecondary, fontStyle: "italic", margin: 0, fontFamily: fonts.system }}>Making giving visible.</p>
              </div>

              <div style={{
                ...glass.panelAccent,
                padding: "14px 16px", margin: "0 0 14px",
              }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: colors.accent, margin: "0 0 4px", fontFamily: fonts.system }}>Direct. Transparent. Verified.</p>
                <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, lineHeight: 1.5, fontFamily: fonts.system }}>
                  Donate directly to local NGOs. Receive AI-verified video proof of your impact. No intermediaries.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                {[
                  { n: "0%", l: "Middlemen" },
                  { n: "100%", l: "Transparent" },
                  { n: "AI", l: "Verified" },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: "center",
                    ...glass.panelLight,
                    padding: "12px 6px",
                  }}>
                    <p style={{ fontSize: "18px", fontWeight: 800, color: colors.text, margin: "0 0 2px", fontFamily: fonts.system }}>{s.n}</p>
                    <p style={{ fontSize: "10px", color: colors.textTertiary, margin: 0, fontFamily: fonts.system }}>{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Btn onClick={() => navigate(screens.CAUSE)}>Start Giving</Btn>
              <Btn primary={false} onClick={() => { navigate(screens.TRACKING); }}>View My Donations</Btn>
            </div>
          </div>
        );

      // ==================== CAUSE ====================
      case screens.CAUSE:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="Choose a Cause" />
            <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 14px", lineHeight: 1.5, fontFamily: fonts.system }}>What problem do you care about? Pick a cause to support directly.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
              {causes.map((c, i) => (
                <div key={i} onClick={() => { setSelectedCause(c); navigate(screens.COUNTRY); }} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  ...glass.panel,
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "14px",
                    background: `${c.color}12`,
                    border: `1px solid ${c.color}20`,
                    display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0
                  }}>{renderIcon(c.icon, 22, c.color)}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.system }}>{c.label}</p>
                    <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.system }}>Support {c.label.toLowerCase()} projects worldwide</p>
                  </div>
                  <span style={{ color: colors.textTertiary }}>{Icon.chevronRight(16, colors.textTertiary)}</span>
                </div>
              ))}
            </div>
          </div>
        );

      // ==================== COUNTRY ====================
      case screens.COUNTRY:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="Pick a Region" />
            <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 14px", fontFamily: fonts.system }}>Where do you want your donation to go?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", flex: 1, alignContent: "start" }}>
              {countries.map((c, i) => (
                <div key={i} onClick={() => { setSelectedCountry(c); navigate(screens.PARTNER); }} style={{
                  ...glass.panel,
                  padding: "18px 14px",
                  textAlign: "center", cursor: "pointer",
                  transition: "all 0.2s ease",
                }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "14px",
                    background: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 10px",
                    fontSize: "16px", fontWeight: 800, color: colors.text,
                    fontFamily: fonts.system, letterSpacing: "0.04em",
                  }}>{c.code}</div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.system }}>{c.name}</p>
                  <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.system }}>{c.projects} active projects</p>
                </div>
              ))}
            </div>
          </div>
        );

      // ==================== PARTNER ====================
      case screens.PARTNER: {
        const causePartners = partners[selectedCause?.label] || partners.Water;
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="Local Partners" />
            <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 14px", fontFamily: fonts.system }}>
              {selectedCause?.label} partners in {selectedCountry?.name}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
              {causePartners.map((p, i) => (
                <div key={i} onClick={() => { setSelectedPartner(p); navigate(screens.AMOUNT); }} style={{
                  ...glass.panel,
                  padding: "16px",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px" }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: colors.text, margin: "0 0 2px", fontFamily: fonts.system }}>{p.name}</p>
                      <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.system }}>{p.location}, {selectedCountry?.name}</p>
                    </div>
                    {p.verified && (
                      <div style={{
                        ...glass.panelSuccess,
                        borderRadius: "20px", padding: "3px 10px",
                        display: "flex", alignItems: "center", gap: "4px"
                      }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: colors.success }} />
                        <span style={{ fontSize: "10px", fontWeight: 700, color: colors.successText, fontFamily: fonts.system }}>Verified</span>
                      </div>
                    )}
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.35)", borderRadius: "8px", height: "6px", overflow: "hidden",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{
                      height: "100%", width: p.funded,
                      background: `linear-gradient(90deg, ${colors.accent}, #e8845c)`,
                      borderRadius: "8px",
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                  <p style={{ fontSize: "10px", color: colors.textTertiary, margin: "4px 0 0", fontFamily: fonts.system }}>{p.funded} funded this month</p>
                </div>
              ))}
            </div>

            <div style={{
              ...glass.panelAccent,
              padding: "12px",
              display: "flex", alignItems: "center", gap: "8px", marginTop: "12px",
            }}>
              {Icon.shield(16, colors.accent)}
              <p style={{ fontSize: "11px", color: colors.accent, fontWeight: 600, margin: 0, fontFamily: fonts.system }}>No intermediaries — funds go direct</p>
            </div>
          </div>
        );
      }

      // ==================== AMOUNT ====================
      case screens.AMOUNT:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="Choose Amount" />
            <div style={{
              ...glass.panel,
              padding: "14px", marginBottom: "14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: `${selectedCause?.color}12`,
                  border: `1px solid ${selectedCause?.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{renderIcon(selectedCause?.icon, 20, selectedCause?.color)}</div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: colors.text, margin: "0 0 1px", fontFamily: fonts.system }}>{selectedPartner?.name}</p>
                  <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.system }}>{selectedPartner?.location}, {selectedCountry?.name}</p>
                </div>
              </div>
            </div>

            <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 12px", fontFamily: fonts.system }}>How much would you like to give?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              {amounts.map((a, i) => (
                <div key={i} onClick={() => setSelectedAmount(a)} style={{
                  padding: "18px", borderRadius: "16px", textAlign: "center",
                  cursor: "pointer", transition: "all 0.25s ease",
                  background: selectedAmount === a
                    ? `linear-gradient(135deg, ${colors.accent}, #b84a28)`
                    : "rgba(255, 255, 255, 0.45)",
                  backdropFilter: selectedAmount === a ? "none" : "blur(20px)",
                  WebkitBackdropFilter: selectedAmount === a ? "none" : "blur(20px)",
                  color: selectedAmount === a ? "white" : colors.text,
                  border: selectedAmount === a ? "none" : "1px solid rgba(255,255,255,0.5)",
                  boxShadow: selectedAmount === a
                    ? `0 4px 20px ${colors.accentGlow}`
                    : "0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
                }}>
                  <span style={{ fontSize: "22px", fontWeight: 800, fontFamily: fonts.system }}>${a}</span>
                </div>
              ))}
            </div>

            <div style={{
              ...glass.panelLight,
              padding: "12px", marginBottom: "14px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.system }}>To partner</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: colors.text, fontFamily: fonts.system }}>{selectedAmount ? `$${(selectedAmount * 0.95).toFixed(2)}` : "--"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.system }}>Platform fee (5%)</span>
                <span style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.system }}>{selectedAmount ? `$${(selectedAmount * 0.05).toFixed(2)}` : "--"}</span>
              </div>
              <div style={{ height: "1px", background: colors.divider, margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: colors.text, fontFamily: fonts.system }}>Total</span>
                <span style={{ fontSize: "13px", fontWeight: 800, color: colors.accent, fontFamily: fonts.system }}>{selectedAmount ? `$${selectedAmount}` : "--"}</span>
              </div>
            </div>

            <div style={{ marginTop: "auto" }}>
              <Btn onClick={() => selectedAmount && navigate(screens.DONOR_INFO)} disabled={!selectedAmount}>
                Continue
              </Btn>
            </div>
          </div>
        );

      // ==================== DONOR INFO ====================
      case screens.DONOR_INFO:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="Your Details" />

            <div style={{
              ...glass.panelAccent,
              padding: "12px",
              display: "flex", alignItems: "center", gap: "10px",
              marginBottom: "16px",
            }}>
              {Icon.lock(16, colors.accent)}
              <p style={{ fontSize: "11px", color: colors.accent, fontWeight: 600, margin: 0, lineHeight: 1.4, fontFamily: fonts.system }}>
                We need your info to send you verified video proof of your donation's impact.
              </p>
            </div>

            <InputField
              label="Full Name"
              value={donorInfo.name}
              onChange={(v) => { setDonorInfo({ ...donorInfo, name: v }); setErrors({ ...errors, name: null }); }}
              placeholder="e.g. Sarah Johnson"
              error={errors.name}
            />

            <InputField
              label="Email Address"
              type="email"
              value={donorInfo.email}
              onChange={(v) => { setDonorInfo({ ...donorInfo, email: v }); setErrors({ ...errors, email: null }); }}
              placeholder="you@example.com"
              error={errors.email}
            />

            <InputField
              label="Phone (optional)"
              type="tel"
              value={donorInfo.phone}
              onChange={(v) => setDonorInfo({ ...donorInfo, phone: v })}
              placeholder="+1 (555) 000-0000"
            />

            <div style={{
              ...glass.panel,
              padding: "12px", marginBottom: "14px",
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: colors.textSecondary, margin: "0 0 6px", fontFamily: fonts.system }}>Your donation summary</p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
                <span style={{ color: colors.textSecondary, fontFamily: fonts.system }}>{selectedCause?.label}</span>
                <span style={{ fontWeight: 700, color: colors.accent, fontFamily: fonts.system }}>${selectedAmount}</span>
              </div>
              <div style={{ fontSize: "11px", color: colors.textTertiary, fontFamily: fonts.system }}>
                {selectedPartner?.name} -- {selectedCountry?.name}
              </div>
            </div>

            <div style={{ marginTop: "auto" }}>
              <Btn onClick={() => {
                if (validateDonorInfo()) navigate(screens.CONFIRM);
              }}>
                Review Donation
              </Btn>
            </div>
          </div>
        );

      // ==================== CONFIRM ====================
      case screens.CONFIRM:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="Confirm Donation" />
            <div style={{ textAlign: "center", padding: "8px 0 18px" }}>
              <div style={{
                width: "52px", height: "52px", borderRadius: "50%",
                background: colors.accentLight, margin: "0 auto 10px",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid rgba(212, 96, 58, 0.15)`,
              }}>{renderIcon(selectedCause?.icon, 26, colors.accent)}</div>
              <p style={{ fontSize: "32px", fontWeight: 800, color: colors.text, margin: "0 0 4px", fontFamily: fonts.system, letterSpacing: "-0.03em" }}>${selectedAmount}</p>
              <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0, fontFamily: fonts.system }}>to {selectedPartner?.name}</p>
            </div>

            <div style={{
              ...glass.panel,
              padding: "14px", marginBottom: "14px",
            }}>
              {[
                { l: "Donor", v: donorInfo.name },
                { l: "Email", v: donorInfo.email },
                { l: "Cause", v: selectedCause?.label },
                { l: "Region", v: `${selectedCountry?.code} -- ${selectedCountry?.name}` },
                { l: "Partner", v: selectedPartner?.name },
                { l: "Amount", v: `$${selectedAmount}`, bold: true },
              ].map((r, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", padding: "7px 0",
                  borderBottom: i < 5 ? `1px solid ${colors.divider}` : "none"
                }}>
                  <span style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.system }}>{r.l}</span>
                  <span style={{
                    fontSize: "12px", fontWeight: r.bold ? 800 : 600,
                    color: r.bold ? colors.accent : colors.text,
                    maxWidth: "170px", textAlign: "right", wordBreak: "break-word",
                    fontFamily: fonts.system,
                  }}>{r.v}</span>
                </div>
              ))}
            </div>

            <div style={{
              ...glass.panelSuccess,
              padding: "12px",
              display: "flex", alignItems: "center", gap: "10px",
              marginBottom: "14px",
            }}>
              {Icon.video(18, colors.successText)}
              <p style={{ fontSize: "12px", color: colors.successText, margin: 0, lineHeight: 1.4, fontFamily: fonts.system }}>
                You'll receive <strong>AI-verified video proof</strong> at <strong>{donorInfo.email}</strong> when your donation is delivered.
              </p>
            </div>

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Btn onClick={() => navigate(screens.PROCESSING)}>
                Confirm & Donate ${selectedAmount}
              </Btn>
              <Btn primary={false} onClick={goBack}>Go Back</Btn>
            </div>
          </div>
        );

      // ==================== PROCESSING ====================
      case screens.PROCESSING:
        const steps = [
          { label: "Creating donor record...", done: processingStep >= 1 },
          { label: "Generating QR code...", done: processingStep >= 2 },
          { label: "Sending to partner...", done: processingStep >= 3 },
        ];
        return (
          <div style={{
            display: "flex", flexDirection: "column", height: "100%",
            alignItems: "center", justifyContent: "center", textAlign: "center"
          }}>
            {!processingDone ? (
              <>
                <div style={{
                  width: "60px", height: "60px", borderRadius: "50%",
                  border: "3px solid rgba(212, 96, 58, 0.15)",
                  borderTopColor: colors.accent,
                  animation: "spin 0.8s linear infinite", marginBottom: "24px",
                  boxShadow: `0 0 20px ${colors.accentGlow}`,
                }} />
                <p style={{ fontSize: "16px", fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: fonts.system }}>Processing donation...</p>

                <div style={{ width: "100%", maxWidth: "220px", textAlign: "left" }}>
                  {steps.map((s, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      marginBottom: "10px", opacity: processingStep >= i ? 1 : 0.3,
                      transition: "opacity 0.4s ease"
                    }}>
                      <div style={{
                        width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                        background: s.done ? colors.success : "rgba(255,255,255,0.3)",
                        border: s.done ? "none" : "1px solid rgba(255,255,255,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.3s ease",
                        boxShadow: s.done ? "0 2px 8px rgba(52, 199, 89, 0.3)" : "none",
                      }}>
                        {s.done && Icon.check(12, "white")}
                      </div>
                      <span style={{ fontSize: "12px", color: s.done ? colors.text : colors.textTertiary, fontWeight: 600, fontFamily: fonts.system }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: "60px", height: "60px", borderRadius: "50%",
                  background: `linear-gradient(135deg, ${colors.success}, #2ebd52)`,
                  marginBottom: "20px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 24px rgba(52, 199, 89, 0.3)",
                }}>
                  {Icon.check(28, "white")}
                </div>
                <p style={{ fontSize: "16px", fontWeight: 700, color: colors.text, margin: "0 0 6px", fontFamily: fonts.system }}>Donation sent!</p>
                <p style={{ fontSize: "12px", color: colors.textTertiary, margin: 0, fontFamily: fonts.system }}>Preparing your QR code...</p>
              </>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        );

      // ==================== QR READY ====================
      case screens.QR_READY:
        const qrData = donorId || "UNKNOWN";
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="QR Code Ready" showBack={false} />

            <div style={{ textAlign: "center", marginBottom: "12px" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "50%",
                background: "rgba(52, 199, 89, 0.1)", margin: "0 auto 10px",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid rgba(52, 199, 89, 0.15)",
              }}>{Icon.check(22, colors.success)}</div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: colors.text, margin: "0 0 4px", fontFamily: fonts.system }}>
                Donation confirmed!
              </p>
              <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0, fontFamily: fonts.system }}>
                ${selectedAmount} to {selectedPartner?.name}
              </p>
            </div>

            <div style={{
              ...glass.panel,
              padding: "18px", margin: "0 auto 12px",
              textAlign: "center", width: "fit-content",
              border: `1px solid rgba(212, 96, 58, 0.2)`,
            }}>
              <QRCode data={qrData} size={150} />
              <div style={{ height: "10px" }} />
              <p style={{
                fontSize: "13px", fontWeight: 800, color: colors.text,
                fontFamily: fonts.mono, letterSpacing: "0.08em", margin: 0
              }}>{qrData}</p>
            </div>

            <div style={{
              ...glass.panelAccent,
              padding: "12px", marginBottom: "10px",
            }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: colors.accent, margin: "0 0 4px", fontFamily: fonts.system }}>
                Print this QR code & attach it to the gift
              </p>
              <p style={{ fontSize: "11px", color: colors.textSecondary, margin: 0, lineHeight: 1.5, fontFamily: fonts.system }}>
                When the partner scans this code at the Beacon, the system will automatically record the handoff and email you the video at <strong>{donorInfo.email}</strong>.
              </p>
            </div>

            <div style={{
              ...glass.panelSuccess,
              padding: "10px 12px", marginBottom: "10px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              {Icon.mail(14, colors.successText)}
              <p style={{ fontSize: "11px", color: colors.successText, margin: 0, fontWeight: 600, fontFamily: fonts.system }}>
                A copy of this QR code has been sent to the partner.
              </p>
            </div>

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Btn onClick={() => navigate(screens.TRACKING)}>
                Track My Donation
              </Btn>
              <Btn primary={false} onClick={resetAll}>Back to Home</Btn>
            </div>
          </div>
        );

      // ==================== TRACKING ====================
      case screens.TRACKING:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
            <Header title="My Donations" showBack={true}
              rightAction={<div style={{
                width: "28px", height: "28px", borderRadius: "10px",
                background: colors.accentLight,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
              }}>
                {Icon.bell(14, colors.accent)}
                {showNotification && <div style={{
                  position: "absolute", top: "-2px", right: "-2px",
                  width: "10px", height: "10px", borderRadius: "50%",
                  background: colors.accent,
                  border: "2px solid rgba(255,255,255,0.8)",
                  boxShadow: `0 0 6px ${colors.accentGlow}`,
                }} />}
              </div>}
            />

            {showNotification && (
              <div onClick={() => { setShowNotification(false); navigate(screens.VIDEO); }} style={{
                ...glass.panel,
                padding: "14px", marginBottom: "12px", cursor: "pointer",
                border: `1px solid rgba(212, 96, 58, 0.25)`,
                boxShadow: `0 4px 24px ${colors.accentGlow}`,
                animation: "slideDown 0.3s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {Icon.video(20, colors.accent)}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: colors.accent, margin: "0 0 2px", fontFamily: fonts.system }}>Video proof ready!</p>
                    <p style={{ fontSize: "11px", color: colors.textSecondary, margin: 0, fontFamily: fonts.system }}>Tap to watch your impact</p>
                  </div>
                  {Icon.chevronRight(16, colors.accent)}
                </div>
              </div>
            )}

            <div onClick={() => navigate(screens.VIDEO)} style={{
              ...glass.panel,
              padding: "16px", marginBottom: "10px", cursor: "pointer",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "12px",
                    background: `${selectedCause?.color || "#3b82f6"}12`,
                    border: `1px solid ${selectedCause?.color || "#3b82f6"}20`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{renderIcon(selectedCause?.icon || "droplet", 20, selectedCause?.color || "#3b82f6")}</div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: colors.text, margin: "0 0 1px", fontFamily: fonts.system }}>{selectedPartner?.name || "Maji Safi Initiative"}</p>
                    <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.system }}>{selectedCountry?.name || "Kenya"} -- {selectedCause?.label || "Water"}</p>
                  </div>
                </div>
                <span style={{ fontSize: "15px", fontWeight: 800, color: colors.accent, fontFamily: fonts.system }}>${selectedAmount || 100}</span>
              </div>

              {donorId && (
                <div style={{
                  ...glass.panelLight,
                  borderRadius: "10px", padding: "6px 10px",
                  marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px"
                }}>
                  {Icon.tag(12, colors.textSecondary)}
                  <span style={{ fontSize: "11px", fontWeight: 700, color: colors.textSecondary, fontFamily: fonts.mono }}>
                    {donorId}
                  </span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "4px" }}>
                {["Sent", "Received", "Delivered", "Verified"].map((s, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "50%",
                      background: i <= 3 ? `linear-gradient(135deg, ${colors.success}, #2ebd52)` : "rgba(255,255,255,0.35)",
                      border: i <= 3 ? "none" : "1px solid rgba(255,255,255,0.5)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: "4px",
                      boxShadow: i <= 3 ? "0 2px 6px rgba(52, 199, 89, 0.25)" : "none",
                    }}>
                      {Icon.check(12, i <= 3 ? "white" : colors.textTertiary)}
                    </div>
                    <span style={{ fontSize: "9px", color: i <= 3 ? colors.successText : colors.textTertiary, fontWeight: 600, fontFamily: fonts.system }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              ...glass.panel,
              padding: "16px", opacity: 0.55,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: "#8b5cf612", border: "1px solid #8b5cf620",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{Icon.book(20, "#8b5cf6")}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: colors.text, margin: "0 0 1px", fontFamily: fonts.system }}>Bright Futures Academy</p>
                  <p style={{ fontSize: "11px", color: colors.textTertiary, margin: 0, fontFamily: fonts.system }}>Uganda -- Education</p>
                </div>
                <span style={{ fontSize: "15px", fontWeight: 800, color: colors.textTertiary, fontFamily: fonts.system }}>$50</span>
              </div>
            </div>

            <div style={{ marginTop: "auto" }}>
              <Btn onClick={() => { resetAll(); }}>Give Again</Btn>
            </div>

            <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }`}</style>
          </div>
        );

      // ==================== VIDEO ====================
      case screens.VIDEO:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="Impact Proof" />

            <div onClick={() => { if (!isPlaying && videoProgress < 100) setIsPlaying(true); }} style={{
              borderRadius: "18px", overflow: "hidden", marginBottom: "12px",
              position: "relative", height: "175px",
              cursor: "pointer",
              background: "linear-gradient(135deg, #0f1a2e, #1a2e1a)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}>
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                {!isPlaying && videoProgress === 0 && (
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  }}>
                    {Icon.play(20, "rgba(255,255,255,0.95)")}
                  </div>
                )}
                {isPlaying && (
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600, fontFamily: fonts.system }}>
                    Recording playback...
                  </p>
                )}
                {videoProgress >= 100 && !isPlaying && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "50%",
                      background: "rgba(52, 199, 89, 0.2)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(52, 199, 89, 0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 6px",
                    }}>{Icon.check(20, "white")}</div>
                    <p style={{ color: "white", fontSize: "13px", fontWeight: 600, margin: 0, fontFamily: fonts.system }}>Delivery Verified</p>
                  </div>
                )}
              </div>

              <div style={{
                position: "absolute", top: "10px", right: "10px",
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderRadius: "20px",
                padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px",
                border: "1px solid rgba(255,255,255,0.2)",
              }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: colors.success }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: fonts.system }}>AI Verified</span>
              </div>

              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: "3px", background: "rgba(255,255,255,0.15)",
              }}>
                <div style={{
                  height: "100%", width: `${videoProgress}%`,
                  background: `linear-gradient(90deg, ${colors.accent}, #e8845c)`,
                  transition: "width 0.1s linear",
                  boxShadow: `0 0 8px ${colors.accentGlow}`,
                }} />
              </div>
            </div>

            <div style={{
              ...glass.panel,
              padding: "14px", marginBottom: "10px",
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: colors.textSecondary, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fonts.system }}>Delivery Details</p>
              {[
                { l: "Recipient", v: "Joseph M." },
                { l: "Donor", v: donorInfo.name || "You" },
                { l: "Donor ID", v: donorId || "--", mono: true },
                { l: "Project", v: selectedCause?.label || "Water Well" },
                { l: "Partner", v: selectedPartner?.name || "Maji Safi Initiative" },
                { l: "Location", v: `${selectedPartner?.location || "Kisumu"}, ${selectedCountry?.name || "Kenya"}` },
                { l: "Your Donation", v: `$${selectedAmount || 100}`, accent: true },
              ].map((r, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", padding: "5px 0",
                }}>
                  <span style={{ fontSize: "12px", color: colors.textSecondary, fontFamily: fonts.system }}>{r.l}</span>
                  <span style={{
                    fontSize: "12px", fontWeight: 600,
                    color: r.accent ? colors.accent : colors.text,
                    fontFamily: r.mono ? fonts.mono : fonts.system,
                  }}>{r.v}</span>
                </div>
              ))}
            </div>

            <div style={{
              ...glass.panelSuccess,
              padding: "10px 12px",
              display: "flex", alignItems: "center", gap: "10px",
              marginBottom: "10px",
            }}>
              {Icon.cpu(16, colors.successText)}
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: colors.successText, margin: 0, fontFamily: fonts.system }}>Amelior8 AI Verified</p>
                <p style={{ fontSize: "10px", color: "rgba(27, 94, 48, 0.7)", margin: 0, fontFamily: fonts.system }}>Handoff confirmed -- Recipient present</p>
              </div>
            </div>

            <div style={{ marginTop: "auto", display: "flex", gap: "8px" }}>
              <Btn onClick={() => navigate(screens.SHARE)} primary={false} style={{ flex: 1 }}>Share Proof</Btn>
              <Btn onClick={resetAll} style={{ flex: 1 }}>Give Again</Btn>
            </div>
          </div>
        );

      // ==================== SHARE ====================
      case screens.SHARE:
        return (
          <div style={{
            display: "flex", flexDirection: "column", height: "100%",
            alignItems: "center", justifyContent: "center", textAlign: "center"
          }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%",
              background: `linear-gradient(135deg, rgba(212, 96, 58, 0.15), rgba(212, 96, 58, 0.05))`,
              border: "1px solid rgba(212, 96, 58, 0.15)",
              margin: "0 0 20px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{Icon.share(32, colors.accent)}</div>
            <h2 style={{ fontFamily: fonts.system, fontSize: "22px", fontWeight: 800, color: colors.text, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Impact Shared!</h2>
            <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "0 0 24px", lineHeight: 1.5, padding: "0 10px", fontFamily: fonts.system }}>
              Your verified proof of impact has been copied. Share it on social media to inspire others to give transparently.
            </p>

            <div style={{
              display: "flex", gap: "14px", marginBottom: "32px"
            }}>
              {[
                { icon: "copy", label: "Copy" },
                { icon: "chat", label: "Message" },
                { icon: "mail", label: "Email" },
              ].map((item, i) => (
                <div key={i} style={{
                  width: "52px", height: "52px", borderRadius: "16px",
                  ...glass.panel,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}>{Icon[item.icon](22, colors.text)}</div>
              ))}
            </div>

            <Btn onClick={resetAll} style={{ width: "100%" }}>Back to Home</Btn>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `
        radial-gradient(ellipse at 15% 30%, rgba(120, 119, 198, 0.25), transparent 55%),
        radial-gradient(ellipse at 85% 15%, rgba(255, 175, 140, 0.22), transparent 50%),
        radial-gradient(ellipse at 35% 80%, rgba(135, 200, 240, 0.2), transparent 50%),
        radial-gradient(ellipse at 75% 65%, rgba(180, 130, 200, 0.15), transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(255, 220, 200, 0.1), transparent 60%),
        linear-gradient(160deg, #f0ecff 0%, #e6f2f8 35%, #fef0e8 70%, #f5eff8 100%)
      `,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px",
      fontFamily: fonts.system,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Phone frame — glass */}
      <div style={{
        width: "320px", height: "640px", borderRadius: "44px",
        background: "rgba(255, 255, 255, 0.2)",
        backdropFilter: "blur(40px) saturate(200%)",
        WebkitBackdropFilter: "blur(40px) saturate(200%)",
        border: "1px solid rgba(255, 255, 255, 0.5)",
        position: "relative", overflow: "hidden",
        boxShadow: `
          0 40px 100px rgba(0, 0, 0, 0.1),
          0 10px 40px rgba(0, 0, 0, 0.06),
          inset 0 2px 0 rgba(255, 255, 255, 0.6),
          inset 0 -1px 0 rgba(255, 255, 255, 0.2)
        `,
      }}>
        {/* Dynamic Island */}
        <div style={{
          position: "absolute", top: "8px", left: "50%", transform: "translateX(-50%)",
          width: "100px", height: "28px",
          background: "#0a0a0e",
          borderRadius: "20px", zIndex: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }} />

        {/* Screen content */}
        <div style={{
          padding: "48px 20px 20px", height: "100%", boxSizing: "border-box",
          display: "flex", flexDirection: "column", overflowY: "auto",
        }}>
          {renderScreen()}
        </div>
      </div>

      {/* Caption */}
      <div style={{ marginTop: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "11px", color: "rgba(0,0,0,0.3)", margin: 0, fontFamily: fonts.system, letterSpacing: "0.02em" }}>
          amelior8 -- Interactive App Prototype
        </p>
      </div>
    </div>
  );
}
