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
//  FIREBASE CONFIG — Replace with your actual values
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB8r_o3Vgxnu6ClOZ52RVoTnP7OyVAL37s",
  authDomain: "amelior8it.firebaseapp.com",
  projectId: "amelior8it",
  storageBucket: "amelior8it.firebasestorage.app",
};

// Firebase will be initialized lazily
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
//  QR CODE GENERATOR — fully self-contained, no external calls
//  Produces Version 2 (25x25) QR, EC Level L, Byte mode
// ============================================================
const QR = (() => {
  // Galois Field GF(256) with polynomial 0x11d
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x << 1) ^ (x >= 128 ? 0x11d : 0); } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const gfMul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;

  function rsEncode(data, ecLen) {
    // Generate generator polynomial
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
    // Byte mode encoding for Version 2, EC Level L
    // V2-L: 44 bytes data capacity, 34 data codewords, 10 EC codewords
    const DATA_CW = 34, EC_CW = 10, SIZE = 25;
    const bytes = new TextEncoder().encode(text);

    // Build bit stream: mode(4) + count(8 for V2 byte) + data + terminator
    let bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4); // Byte mode
    push(bytes.length, 8); // Character count
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, DATA_CW * 8 - bits.length)); // Terminator
    while (bits.length % 8) bits.push(0); // Byte align
    // Pad codewords
    const pads = [0xEC, 0x11];
    let pi = 0;
    while (bits.length < DATA_CW * 8) { push(pads[pi % 2], 8); pi++; }

    // Convert to bytes
    const data = [];
    for (let i = 0; i < bits.length; i += 8)
      data.push(bits.slice(i, i + 8).reduce((a, b, j) => a | (b << (7 - j)), 0));

    // Error correction
    const ec = rsEncode(new Uint8Array(data), EC_CW);
    const finalBits = [];
    for (const b of [...data, ...ec]) push.call(null, b, 8), finalBits.push(...bits.splice(bits.length - 8, 8));
    // Rebuild full bit sequence
    const allBits = [];
    const pushB = (val, len) => { for (let i = len - 1; i >= 0; i--) allBits.push((val >> i) & 1); };
    for (const b of [...data, ...ec]) pushB(b, 8);
    // Remainder bits for V2: 7
    for (let i = 0; i < 7; i++) allBits.push(0);

    // Create matrix
    const M = Array.from({ length: SIZE }, () => new Int8Array(SIZE)); // 0=white, 1=black
    const R = Array.from({ length: SIZE }, () => new Uint8Array(SIZE)); // reserved

    // Finder patterns
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

    // Alignment pattern for V2 at (18,18)
    const ac = 18;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      M[ac + dr][ac + dc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
      R[ac + dr][ac + dc] = 1;
    }

    // Timing patterns
    for (let i = 8; i < SIZE - 8; i++) {
      M[6][i] = (i % 2 === 0) ? 1 : 0; R[6][i] = 1;
      M[i][6] = (i % 2 === 0) ? 1 : 0; R[i][6] = 1;
    }

    // Dark module
    M[SIZE - 8][8] = 1; R[SIZE - 8][8] = 1;

    // Reserve format info areas
    for (let i = 0; i < 9; i++) {
      if (i < SIZE) { R[8][i] = 1; R[i][8] = 1; }
    }
    for (let i = 0; i < 8; i++) {
      R[8][SIZE - 8 + i] = 1;
      R[SIZE - 8 + i][8] = 1; // fix: was 7
    }

    // Place data bits
    let bitIdx = 0;
    let upward = true;
    for (let right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // Skip timing column
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

    // Apply mask 0 (checkerboard: (row+col)%2 === 0)
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!R[r][c] && (r + c) % 2 === 0) M[r][c] ^= 1;

    // Format info for EC Level L (01) + Mask 0 (000) = 01000
    // After BCH: 0x77C0... let me compute: format = L=01, mask=000 => 01000
    // BCH(15,5) encoding of 01000 = 0b011010101011111 but after XOR mask 0x5412
    // Pre-computed: L + mask 0 = 0x77C0? Let me use known value.
    // EC L = 01, mask 0 = 000 => data bits = 01000
    // Format info bits (pre-computed with BCH + XOR mask):
    const FORMAT_BITS = [1,1,1,0,1,1,1,1,1,0,0,0,1,0,0]; // L, mask 0
    // Place format info
    // Around top-left finder
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
  const cellSize = size / (n + 8); // quiet zone of 4 on each side
  const offset = cellSize * 4;

  const rects = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (matrix[r][c])
        rects.push(
          <rect key={`${r}-${c}`} x={offset + c * cellSize} y={offset + r * cellSize}
            width={cellSize + 0.5} height={cellSize + 0.5} fill="#1a1a1a" />
        );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
      <rect width={size} height={size} fill="white" />
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
//  INPUT FIELD (defined outside main component to prevent remount)
// ============================================================
function InputField({ label, value, onChange, placeholder, type = "text", error }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#555", marginBottom: "5px" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: "12px",
          border: error ? "2px solid #ef4444" : "1.5px solid #e0dcd6",
          fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
          background: "white", color: "#1a1a1a", outline: "none",
          boxSizing: "border-box",
          transition: "border 0.15s",
        }}
        onFocus={(e) => { e.target.style.borderColor = "#c45a2d"; }}
        onBlur={(e) => { e.target.style.borderColor = error ? "#ef4444" : "#e0dcd6"; }}
      />
      {error && <p style={{ fontSize: "11px", color: "#ef4444", margin: "4px 0 0", fontWeight: 600 }}>{error}</p>}
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
    { icon: "💧", label: "Water", color: "#3b82f6" },
    { icon: "📚", label: "Education", color: "#8b5cf6" },
    { icon: "🏥", label: "Health", color: "#ef4444" },
    { icon: "🌾", label: "Food", color: "#f59e0b" },
  ];

  const countries = [
    { flag: "🇰🇪", name: "Kenya", projects: 12 },
    { flag: "🇺🇬", name: "Uganda", projects: 8 },
    { flag: "🇳🇬", name: "Nigeria", projects: 15 },
    { flag: "🇹🇿", name: "Tanzania", projects: 6 },
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
  //  DONATION PROCESSING — Creates donor in Firestore + QR
  // ============================================================
  async function processDonation() {
    const newDonorId = generateDonorId();
    setDonorId(newDonorId);

    // Step 1: Creating donor record
    setProcessingStep(1);
    await new Promise((r) => setTimeout(r, 800));

    // Build the donor document
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

    // Try saving to Firestore
    if (initFirebase() && db) {
      try {
        await db.collection("donors").doc(newDonorId).set(donorDoc);
        console.log("Donor saved to Firestore:", newDonorId);
      } catch (err) {
        console.error("Firestore write error:", err);
        // Continue anyway — QR is still generated
      }
    } else {
      console.log("Firebase not configured — donor record (local only):", newDonorId, donorDoc);
    }

    // Step 2: Generating QR
    setProcessingStep(2);
    await new Promise((r) => setTimeout(r, 600));

    // Step 3: Sending to partner
    setProcessingStep(3);
    await new Promise((r) => setTimeout(r, 600));

    // Done
    setProcessingDone(true);
    await new Promise((r) => setTimeout(r, 600));
    navigate(screens.QR_READY);
  }

  // Processing animation
  useEffect(() => {
    if (screen === screens.PROCESSING) {
      processDonation();
    }
  }, [screen]);

  // Video playback simulation
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

  // Notification on tracking screen
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
  //  SHARED COMPONENTS
  // ============================================================
  const Header = ({ title, showBack = true, rightAction }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 0 14px", borderBottom: "1px solid #eee", marginBottom: "16px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {showBack && history.length > 0 && (
          <div onClick={goBack} style={{ cursor: "pointer", fontSize: "20px", color: "#c45a2d", fontWeight: 700, lineHeight: 1 }}>‹</div>
        )}
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a" }}>{title}</span>
      </div>
      {rightAction || (
        <span style={{ fontSize: "10px", color: "#c45a2d", fontWeight: 700, letterSpacing: "0.12em" }}>AMELIOR8</span>
      )}
    </div>
  );

  const Btn = ({ children, onClick, primary = true, disabled = false, style: s = {} }) => (
    <div onClick={disabled ? undefined : onClick} style={{
      padding: "14px", borderRadius: "14px", textAlign: "center",
      fontWeight: 700, fontSize: "14px", cursor: disabled ? "default" : "pointer",
      background: primary ? "#1a1a1a" : "white",
      color: primary ? "white" : "#1a1a1a",
      border: primary ? "none" : "2px solid #e0dcd6",
      transition: "all 0.15s",
      opacity: disabled ? 0.4 : 1,
      ...s
    }}>{children}</div>
  );

  // InputField is defined outside the component (see top of file)

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
              <div style={{ textAlign: "center", padding: "30px 0 20px" }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "20px",
                  background: "linear-gradient(135deg, #c45a2d, #e07a4f)", margin: "0 auto 16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(196,90,45,0.3)"
                }}>
                  <span style={{ fontSize: "28px" }}>🌍</span>
                </div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" }}>amelior8</h1>
                <p style={{ fontSize: "13px", color: "#888", fontStyle: "italic", margin: 0 }}>Making giving visible.</p>
              </div>

              <div style={{
                background: "#fef3ee", borderRadius: "14px", padding: "16px",
                margin: "0 0 16px", border: "1px solid #f0d4c0"
              }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#c45a2d", margin: "0 0 4px" }}>Direct. Transparent. Verified.</p>
                <p style={{ fontSize: "12px", color: "#777", margin: 0, lineHeight: 1.5 }}>
                  Donate directly to local NGOs. Receive AI-verified video proof of your impact. No intermediaries.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                {[
                  { n: "0%", l: "Middlemen" },
                  { n: "100%", l: "Transparent" },
                  { n: "AI", l: "Verified" },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: "center", background: "white",
                    borderRadius: "12px", padding: "12px 8px",
                    border: "1.5px solid #eee"
                  }}>
                    <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", margin: "0 0 2px" }}>{s.n}</p>
                    <p style={{ fontSize: "10px", color: "#888", margin: 0 }}>{s.l}</p>
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
            <p style={{ fontSize: "13px", color: "#777", margin: "0 0 16px", lineHeight: 1.5 }}>What problem do you care about? Pick a cause to support directly.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
              {causes.map((c, i) => (
                <div key={i} onClick={() => { setSelectedCause(c); navigate(screens.COUNTRY); }} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  background: "white", borderRadius: "14px", padding: "16px",
                  border: "1.5px solid #eee", cursor: "pointer",
                  transition: "all 0.15s"
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "14px",
                    background: `${c.color}15`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "24px", flexShrink: 0
                  }}>{c.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 2px" }}>{c.label}</p>
                    <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>Support {c.label.toLowerCase()} projects worldwide</p>
                  </div>
                  <span style={{ color: "#ccc", fontSize: "18px" }}>›</span>
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
            <p style={{ fontSize: "13px", color: "#777", margin: "0 0 16px" }}>Where do you want your donation to go?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", flex: 1, alignContent: "start" }}>
              {countries.map((c, i) => (
                <div key={i} onClick={() => { setSelectedCountry(c); navigate(screens.PARTNER); }} style={{
                  background: "white", borderRadius: "14px", padding: "18px 14px",
                  border: "1.5px solid #eee", textAlign: "center", cursor: "pointer",
                  transition: "all 0.15s"
                }}>
                  <span style={{ fontSize: "36px", display: "block", marginBottom: "8px" }}>{c.flag}</span>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 2px" }}>{c.name}</p>
                  <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>{c.projects} active projects</p>
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
            <p style={{ fontSize: "13px", color: "#777", margin: "0 0 16px" }}>
              {selectedCause?.icon} {selectedCause?.label} partners in {selectedCountry?.name}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
              {causePartners.map((p, i) => (
                <div key={i} onClick={() => { setSelectedPartner(p); navigate(screens.AMOUNT); }} style={{
                  background: "white", borderRadius: "14px", padding: "16px",
                  border: "1.5px solid #eee", cursor: "pointer"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px" }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 2px" }}>{p.name}</p>
                      <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>{p.location}, {selectedCountry?.name}</p>
                    </div>
                    {p.verified && (
                      <div style={{
                        background: "#e8f5e9", borderRadius: "20px", padding: "3px 10px",
                        display: "flex", alignItems: "center", gap: "4px"
                      }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34c759" }} />
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#2e7d32" }}>Verified</span>
                      </div>
                    )}
                  </div>
                  <div style={{ background: "#f5f3ef", borderRadius: "8px", height: "6px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: p.funded, background: "#c45a2d", borderRadius: "8px" }} />
                  </div>
                  <p style={{ fontSize: "10px", color: "#999", margin: "4px 0 0" }}>{p.funded} funded this month</p>
                </div>
              ))}
            </div>

            <div style={{
              background: "#fef3ee", borderRadius: "12px", padding: "12px",
              display: "flex", alignItems: "center", gap: "8px", marginTop: "12px",
              border: "1px solid #f0d4c0"
            }}>
              <span style={{ fontSize: "16px" }}>🚫</span>
              <p style={{ fontSize: "11px", color: "#c45a2d", fontWeight: 600, margin: 0 }}>No intermediaries — funds go direct</p>
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
              background: "white", borderRadius: "14px", padding: "14px",
              border: "1.5px solid #eee", marginBottom: "16px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: `${selectedCause?.color}15`, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: "20px"
                }}>{selectedCause?.icon}</div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 1px" }}>{selectedPartner?.name}</p>
                  <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>{selectedPartner?.location}, {selectedCountry?.name}</p>
                </div>
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "#777", margin: "0 0 12px" }}>How much would you like to give?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              {amounts.map((a, i) => (
                <div key={i} onClick={() => setSelectedAmount(a)} style={{
                  padding: "20px", borderRadius: "14px", textAlign: "center",
                  cursor: "pointer", transition: "all 0.15s",
                  background: selectedAmount === a ? "#c45a2d" : "white",
                  color: selectedAmount === a ? "white" : "#1a1a1a",
                  border: selectedAmount === a ? "2px solid #c45a2d" : "2px solid #eee"
                }}>
                  <span style={{ fontSize: "22px", fontWeight: 800 }}>${a}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: "#f5f3ef", borderRadius: "12px", padding: "12px",
              marginBottom: "16px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", color: "#888" }}>To partner</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#1a1a1a" }}>{selectedAmount ? `$${(selectedAmount * 0.95).toFixed(2)}` : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", color: "#888" }}>Platform fee (5%)</span>
                <span style={{ fontSize: "12px", color: "#888" }}>{selectedAmount ? `$${(selectedAmount * 0.05).toFixed(2)}` : "—"}</span>
              </div>
              <div style={{ height: "1px", background: "#ddd", margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>Total</span>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "#c45a2d" }}>{selectedAmount ? `$${selectedAmount}` : "—"}</span>
              </div>
            </div>

            <div style={{ marginTop: "auto" }}>
              <Btn onClick={() => selectedAmount && navigate(screens.DONOR_INFO)}
                disabled={!selectedAmount}>
                Continue
              </Btn>
            </div>
          </div>
        );

      // ==================== DONOR INFO (NEW) ====================
      case screens.DONOR_INFO:
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="Your Details" />

            <div style={{
              background: "#fef3ee", borderRadius: "12px", padding: "12px",
              display: "flex", alignItems: "center", gap: "10px",
              border: "1px solid #f0d4c0", marginBottom: "16px"
            }}>
              <span style={{ fontSize: "16px" }}>🔒</span>
              <p style={{ fontSize: "11px", color: "#c45a2d", fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
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
              background: "white", borderRadius: "12px", padding: "12px",
              border: "1.5px solid #eee", marginBottom: "16px"
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#555", margin: "0 0 6px" }}>Your donation summary</p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
                <span style={{ color: "#888" }}>{selectedCause?.icon} {selectedCause?.label}</span>
                <span style={{ fontWeight: 700, color: "#c45a2d" }}>${selectedAmount}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#999" }}>
                {selectedPartner?.name} · {selectedCountry?.name}
              </div>
            </div>

            <div style={{ marginTop: "auto" }}>
              <Btn onClick={() => {
                if (validateDonorInfo()) navigate(screens.CONFIRM);
              }} style={{ background: "#c45a2d" }}>
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
            <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "#fef3ee", margin: "0 auto 12px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "28px"
              }}>{selectedCause?.icon}</div>
              <p style={{ fontSize: "32px", fontWeight: 800, color: "#1a1a1a", margin: "0 0 4px" }}>${selectedAmount}</p>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>to {selectedPartner?.name}</p>
            </div>

            <div style={{
              background: "white", borderRadius: "14px", padding: "14px",
              border: "1.5px solid #eee", marginBottom: "16px"
            }}>
              {[
                { l: "Donor", v: donorInfo.name },
                { l: "Email", v: donorInfo.email },
                { l: "Cause", v: selectedCause?.label },
                { l: "Region", v: `${selectedCountry?.flag} ${selectedCountry?.name}` },
                { l: "Partner", v: selectedPartner?.name },
                { l: "Amount", v: `$${selectedAmount}`, bold: true },
              ].map((r, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", padding: "8px 0",
                  borderBottom: i < 5 ? "1px solid #f5f3ef" : "none"
                }}>
                  <span style={{ fontSize: "12px", color: "#888" }}>{r.l}</span>
                  <span style={{
                    fontSize: "12px", fontWeight: r.bold ? 800 : 600,
                    color: r.bold ? "#c45a2d" : "#1a1a1a",
                    maxWidth: "180px", textAlign: "right", wordBreak: "break-word"
                  }}>{r.v}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: "#f0f7f2", borderRadius: "12px", padding: "12px",
              display: "flex", alignItems: "center", gap: "10px",
              border: "1px solid #c8e0cc", marginBottom: "16px"
            }}>
              <span style={{ fontSize: "20px" }}>🎥</span>
              <p style={{ fontSize: "12px", color: "#2d5a3d", margin: 0, lineHeight: 1.4 }}>
                You'll receive <strong>AI-verified video proof</strong> at <strong>{donorInfo.email}</strong> when your donation is delivered.
              </p>
            </div>

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Btn onClick={() => navigate(screens.PROCESSING)} style={{ background: "#c45a2d" }}>
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
                  width: "64px", height: "64px", borderRadius: "50%",
                  border: "4px solid #f0dcd0", borderTopColor: "#c45a2d",
                  animation: "spin 0.8s linear infinite", marginBottom: "24px"
                }} />
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 20px" }}>Processing donation...</p>

                <div style={{ width: "100%", maxWidth: "220px", textAlign: "left" }}>
                  {steps.map((s, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      marginBottom: "10px", opacity: processingStep >= i ? 1 : 0.3,
                      transition: "opacity 0.3s"
                    }}>
                      <div style={{
                        width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0,
                        background: s.done ? "#34c759" : "#e0dcd6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background 0.3s"
                      }}>
                        {s.done && <span style={{ color: "white", fontSize: "11px", fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: "12px", color: s.done ? "#1a1a1a" : "#999", fontWeight: 600 }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "50%",
                  background: "#34c759", marginBottom: "20px",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <span style={{ color: "white", fontSize: "32px", fontWeight: 700 }}>✓</span>
                </div>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" }}>Donation sent!</p>
                <p style={{ fontSize: "12px", color: "#999", margin: 0 }}>Preparing your QR code...</p>
              </>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        );

      // ==================== QR READY (NEW) ====================
      case screens.QR_READY:
        const qrData = donorId || "UNKNOWN";
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Header title="QR Code Ready" showBack={false} />

            <div style={{ textAlign: "center", marginBottom: "14px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "#e8f5e9", margin: "0 auto 10px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "24px"
              }}>✅</div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "#1a1a1a", margin: "0 0 4px" }}>
                Donation confirmed!
              </p>
              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                ${selectedAmount} to {selectedPartner?.name}
              </p>
            </div>

            {/* QR Code Display */}
            <div style={{
              background: "white", borderRadius: "16px", padding: "20px",
              border: "2px solid #c45a2d", margin: "0 auto 14px",
              textAlign: "center", width: "fit-content"
            }}>
              <QRCode data={qrData} size={160} />
              <div style={{ height: "10px" }} />
              <p style={{
                fontSize: "14px", fontWeight: 800, color: "#1a1a1a",
                fontFamily: "'Courier New', monospace", letterSpacing: "0.08em", margin: 0
              }}>{qrData}</p>
            </div>

            <div style={{
              background: "#fef3ee", borderRadius: "12px", padding: "12px",
              border: "1px solid #f0d4c0", marginBottom: "12px"
            }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#c45a2d", margin: "0 0 4px" }}>
                📦 Print this QR code & attach it to the gift
              </p>
              <p style={{ fontSize: "11px", color: "#777", margin: 0, lineHeight: 1.5 }}>
                When the partner scans this code at the Beacon, the system will automatically record the handoff and email you the video at <strong>{donorInfo.email}</strong>.
              </p>
            </div>

            <div style={{
              background: "#f0f7f2", borderRadius: "12px", padding: "10px 12px",
              border: "1px solid #c8e0cc", marginBottom: "12px",
              display: "flex", alignItems: "center", gap: "8px"
            }}>
              <span style={{ fontSize: "14px" }}>📧</span>
              <p style={{ fontSize: "11px", color: "#2d5a3d", margin: 0, fontWeight: 600 }}>
                A copy of this QR code has been sent to the partner.
              </p>
            </div>

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Btn onClick={() => navigate(screens.TRACKING)} style={{ background: "#c45a2d" }}>
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
                width: "28px", height: "28px", borderRadius: "50%", background: "#fef3ee",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", position: "relative"
              }}>
                🔔
                {showNotification && <div style={{
                  position: "absolute", top: "-2px", right: "-2px",
                  width: "10px", height: "10px", borderRadius: "50%",
                  background: "#c45a2d", border: "2px solid #faf8f5"
                }} />}
              </div>}
            />

            {showNotification && (
              <div onClick={() => { setShowNotification(false); navigate(screens.VIDEO); }} style={{
                background: "white", borderRadius: "14px", padding: "14px",
                border: "2px solid #c45a2d", marginBottom: "14px", cursor: "pointer",
                boxShadow: "0 4px 20px rgba(196,90,45,0.15)",
                animation: "slideDown 0.3s ease"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>🎥</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#c45a2d", margin: "0 0 2px" }}>Video proof ready!</p>
                    <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>Tap to watch your impact</p>
                  </div>
                  <span style={{ color: "#c45a2d", fontSize: "16px" }}>›</span>
                </div>
              </div>
            )}

            <div onClick={() => navigate(screens.VIDEO)} style={{
              background: "white", borderRadius: "14px", padding: "16px",
              border: "1.5px solid #eee", marginBottom: "10px", cursor: "pointer"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "12px",
                    background: `${selectedCause?.color || "#3b82f6"}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "20px"
                  }}>{selectedCause?.icon || "💧"}</div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 1px" }}>{selectedPartner?.name || "Maji Safi Initiative"}</p>
                    <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>{selectedCountry?.name || "Kenya"} · {selectedCause?.label || "Water"}</p>
                  </div>
                </div>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "#c45a2d" }}>${selectedAmount || 100}</span>
              </div>

              {/* Donor ID badge */}
              {donorId && (
                <div style={{
                  background: "#f5f3ef", borderRadius: "8px", padding: "6px 10px",
                  marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px"
                }}>
                  <span style={{ fontSize: "12px" }}>🏷️</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#555", fontFamily: "'Courier New', monospace" }}>
                    {donorId}
                  </span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "8px" }}>
                {["Sent", "Received", "Delivered", "Verified"].map((s, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "50%",
                      background: i <= 3 ? "#34c759" : "#e0dcd6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: "4px"
                    }}>
                      <span style={{ color: "white", fontSize: "12px", fontWeight: 700 }}>✓</span>
                    </div>
                    <span style={{ fontSize: "9px", color: i <= 3 ? "#34c759" : "#999", fontWeight: 600 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: "white", borderRadius: "14px", padding: "16px",
              border: "1.5px solid #eee", opacity: 0.6
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: "#8b5cf615", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "20px"
                }}>📚</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 1px" }}>Bright Futures Academy</p>
                  <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>Uganda · Education</p>
                </div>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "#999" }}>$50</span>
              </div>
            </div>

            <div style={{ marginTop: "auto" }}>
              <Btn onClick={() => { resetAll(); }} style={{ background: "#c45a2d" }}>Give Again</Btn>
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
              borderRadius: "14px", overflow: "hidden", marginBottom: "14px",
              position: "relative", background: "#1a2e1a", height: "180px",
              cursor: "pointer"
            }}>
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center"
              }}>
                {!isPlaying && videoProgress === 0 && (
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.9)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)"
                  }}>
                    <div style={{
                      width: 0, height: 0, borderTop: "11px solid transparent",
                      borderBottom: "11px solid transparent", borderLeft: "18px solid #c45a2d",
                      marginLeft: "3px"
                    }} />
                  </div>
                )}
                {isPlaying && (
                  <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "13px", fontWeight: 600 }}>
                    ● Recording playback...
                  </p>
                )}
                {videoProgress >= 100 && !isPlaying && (
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: "36px" }}>✅</span>
                    <p style={{ color: "white", fontSize: "13px", fontWeight: 600, margin: "6px 0 0" }}>Delivery Verified</p>
                  </div>
                )}
              </div>

              <div style={{
                position: "absolute", top: "10px", right: "10px",
                background: "rgba(255,255,255,0.95)", borderRadius: "20px",
                padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px"
              }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34c759" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#1a1a1a" }}>AI Verified</span>
              </div>

              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: "4px", background: "rgba(255,255,255,0.2)"
              }}>
                <div style={{
                  height: "100%", width: `${videoProgress}%`,
                  background: "#c45a2d", transition: "width 0.1s linear"
                }} />
              </div>
            </div>

            <div style={{
              background: "white", borderRadius: "14px", padding: "14px",
              border: "1.5px solid #eee", marginBottom: "12px"
            }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#888", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Delivery Details</p>
              {[
                { l: "Recipient", v: "Joseph M." },
                { l: "Donor", v: donorInfo.name || "You" },
                { l: "Donor ID", v: donorId || "—", mono: true },
                { l: "Project", v: selectedCause?.label || "Water Well" },
                { l: "Partner", v: selectedPartner?.name || "Maji Safi Initiative" },
                { l: "Location", v: `${selectedPartner?.location || "Kisumu"}, ${selectedCountry?.name || "Kenya"}` },
                { l: "Your Donation", v: `$${selectedAmount || 100}`, accent: true },
              ].map((r, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", padding: "5px 0",
                }}>
                  <span style={{ fontSize: "12px", color: "#888" }}>{r.l}</span>
                  <span style={{
                    fontSize: "12px", fontWeight: 600,
                    color: r.accent ? "#c45a2d" : "#1a1a1a",
                    fontFamily: r.mono ? "'Courier New', monospace" : "inherit"
                  }}>{r.v}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: "#f0f7f2", borderRadius: "12px", padding: "10px 12px",
              display: "flex", alignItems: "center", gap: "10px",
              border: "1px solid #c8e0cc", marginBottom: "12px"
            }}>
              <span style={{ fontSize: "18px" }}>🤖</span>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d5a3d", margin: 0 }}>Amelior8 AI Verified</p>
                <p style={{ fontSize: "10px", color: "#5a8a64", margin: 0 }}>Handoff confirmed · Recipient present</p>
              </div>
            </div>

            <div style={{ marginTop: "auto", display: "flex", gap: "8px" }}>
              <Btn onClick={() => navigate(screens.SHARE)} primary={false} style={{ flex: 1 }}>Share Proof</Btn>
              <Btn onClick={resetAll} style={{ flex: 1, background: "#c45a2d" }}>Give Again</Btn>
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
              width: "80px", height: "80px", borderRadius: "50%",
              background: "#fef3ee", margin: "0 0 20px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "36px"
            }}>🎉</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>Impact Shared!</h2>
            <p style={{ fontSize: "13px", color: "#777", margin: "0 0 24px", lineHeight: 1.5, padding: "0 10px" }}>
              Your verified proof of impact has been copied. Share it on social media to inspire others to give transparently.
            </p>

            <div style={{
              display: "flex", gap: "16px", marginBottom: "32px"
            }}>
              {["📋", "💬", "📧"].map((e, i) => (
                <div key={i} style={{
                  width: "52px", height: "52px", borderRadius: "16px",
                  background: "white", border: "1.5px solid #eee",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "24px", cursor: "pointer"
                }}>{e}</div>
              ))}
            </div>

            <Btn onClick={resetAll} style={{ width: "100%", background: "#c45a2d" }}>Back to Home</Btn>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f2efe9",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />

      {/* Phone frame */}
      <div style={{
        width: "320px", height: "640px", borderRadius: "40px",
        border: "3px solid #1a1a1a", background: "#faf8f5",
        position: "relative", overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.08)"
      }}>
        {/* Notch */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: "130px", height: "30px", background: "#1a1a1a",
          borderRadius: "0 0 20px 20px", zIndex: 10
        }} />

        {/* Screen content */}
        <div style={{
          padding: "46px 20px 20px", height: "100%", boxSizing: "border-box",
          display: "flex", flexDirection: "column", overflowY: "auto"
        }}>
          {renderScreen()}
        </div>
      </div>

      {/* Caption */}
      <div style={{ marginTop: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>
          amelior8 — Interactive App Prototype
        </p>
      </div>
    </div>
  );
}
