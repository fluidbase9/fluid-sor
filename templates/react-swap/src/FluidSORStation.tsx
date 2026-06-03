import { useState, useEffect, useRef, useCallback } from "react";

const PROTOCOLS = [
  { id: "aerodrome", name: "Aerodrome",      color: "#0096FF", tvl: "1.2B", fee: "0.05%", type: "sAMM",        logo: "A",  logoFull: "Aerodrome Finance",  logoImg: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/AnNwWdzS_400x400.jpg" },
  { id: "uniswap",  name: "Uniswap V3",     color: "#FF007A", tvl: "890M", fee: "0.01%", type: "Stable CLMM", logo: "U",  logoFull: "Uniswap Protocol",   logoImg: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Uniswap1.jpg" },
  { id: "curve",    name: "Curve",          color: "#FFDC00", tvl: "540M", fee: "0.04%", type: "StableSwap",  logo: "C",  logoFull: "Curve Finance",      logoImg: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/curve-dao-token-crv-logo.png" },
  { id: "fluid",    name: "Fluid StableAMM",color: "#00F0FF", tvl: "48M",  fee: "0.02%", type: "StableSwap+", logo: "F",  logoFull: "Fluid Protocol",     logoImg: "https://fluidspot.s3.us-east-2.amazonaws.com/web/Base/media_files/fluid23.png" },
  { id: "balancer", name: "Maker PSM",      color: "#8B5CF6", tvl: "320M", fee: "0.00%", type: "PSM",         logo: "M",  logoFull: "MakerDAO PSM",       logoImg: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/maker.png" },
];

const TOKENS: Record<string, { symbol: string; color: string; icon: string }> = {
  USDC: { symbol: "USDC", color: "#2775CA", icon: "$" },
  USDT: { symbol: "USDT", color: "#26A17B", icon: "₮" },
  DAI: { symbol: "DAI", color: "#F5AC37", icon: "◈" },
  FRAX: { symbol: "FRAX", color: "#D4D4D4", icon: "ƒ" },
  EURC: { symbol: "EURC", color: "#2B6CB0", icon: "€" },
  PYUSD: { symbol: "PYUSD", color: "#0070E0", icon: "P" },
};

interface ParticleProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  delay: number;
  duration: number;
  size?: number;
}

const Particle = ({ startX, startY, endX, endY, color, delay, duration, size = 6 }: ParticleProps) => {
  const animName = `particle-${startX}-${startY}-${endX}-${endY}-${delay}`.replace(/\./g, '_');
  const keyframes = `
    @keyframes ${animName} {
      0%   { transform: translate(${startX - size / 2}px, ${startY - size / 2}px); opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 1; }
      100% { transform: translate(${endX - size / 2}px, ${endY - size / 2}px); opacity: 0; }
    }
  `;
  return (
    <>
      <style>{keyframes}</style>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}40`,
          opacity: 0,
          pointerEvents: "none",
          zIndex: 30,
          animation: `${animName} ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms 1 forwards`,
        }}
      />
    </>
  );
};

interface ProtocolNodeProps {
  protocol: (typeof PROTOCOLS)[number];
  x: number;
  y: number;
  allocation: number;
  isActive: boolean;
  isRouting: boolean;
  delay: number;
  amount: number;
}

const ProtocolNode = ({ protocol, x, y, allocation, isActive, isRouting, delay, amount }: ProtocolNodeProps) => {
  const [anim, setAnim] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const priceImpactRef = useRef((Math.random() * 0.008 + 0.001).toFixed(4));

  useEffect(() => {
    if (isRouting) {
      const t = setTimeout(() => setAnim(true), delay);
      return () => clearTimeout(t);
    } else {
      setAnim(false);
    }
  }, [isRouting, delay]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (flipped) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ rx: -dy * 10, ry: dx * 10 });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0 });
    setIsHovered(false);
    setIsPressed(false);
  };

  const handleClick = () => {
    if (flipped) return;
    setFlipped(true);
    setTilt({ rx: 0, ry: 0 });
    setTimeout(() => setFlipped(false), 1800);
  };

  const volumeRouted = ((amount * allocation) / 100).toFixed(0);
  const feeNum = parseFloat(protocol.fee);
  const feeCost = ((amount * allocation / 100) * (feeNum / 100)).toFixed(2);
  const priceImpact = priceImpactRef.current;
  const effectiveRate = allocation > 0 ? (1 - feeNum / 100 - parseFloat(priceImpact)).toFixed(6) : "—";

  const scale = isPressed ? 0.97 : anim ? 1.06 : isHovered ? 1.03 : 1;
  const shadow = isHovered || isPressed
    ? `0 ${isPressed ? 6 : 18}px ${isPressed ? 12 : 40}px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)`
    : "0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)";

  const flipTransform = flipped
    ? "rotateY(180deg)"
    : `scale(${scale}) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`;
  const flipTransition = flipped
    ? "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)"
    : isPressed
    ? "transform 0.08s ease, box-shadow 0.08s ease"
    : "transform 0.35s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.35s ease";

  const faceStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: 14,
    WebkitBackfaceVisibility: "hidden",
    backfaceVisibility: "hidden",
    overflow: "hidden",
  };

  return (
    <div
      style={{
        position: "absolute",
        left: x - 210,
        top: y - 90,
        width: 420,
        textAlign: "center",
        zIndex: isHovered || flipped ? 20 : 10,
        perspective: "800px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      {/* Flipper — both faces live inside here */}
      <div
        ref={cardRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => !flipped && setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onMouseDown={() => !flipped && setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        style={{
          position: "relative",
          width: "100%",
          height: 300,
          cursor: "pointer",
          transformStyle: "preserve-3d",
          transform: flipTransform,
          transition: flipTransition,
          boxShadow: shadow,
          borderRadius: 14,
          willChange: "transform",
        }}
      >
        {/* ── FRONT FACE ── */}
        <div style={{ ...faceStyle, background: "#1A1A1E", border: "1px solid #2E2E35", padding: "18px 16px" }}>

          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: protocol.color, letterSpacing: "0.03em", fontFamily: "'Inter', sans-serif" }}>
              {protocol.name}
            </div>
            {allocation > 0 && (
              <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', monospace", background: "#252529", padding: "4px 12px", borderRadius: 7 }}>
                {allocation}%
              </div>
            )}
          </div>

          {/* Type + TVL */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, paddingBottom: 10, borderBottom: "1px dashed #2A2A30" }}>
            <span style={{ fontSize: 13, color: "#555", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{protocol.type}</span>
            <span style={{ fontSize: 13, color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>TVL ${protocol.tvl}</span>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fee</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: feeNum <= 0.02 ? "#00FF88" : feeNum <= 0.05 ? "#F5AC37" : "#FF6666", fontFamily: "'JetBrains Mono', monospace" }}>{protocol.fee}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Slippage</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: parseFloat(priceImpact) < 0.004 ? "#00FF88" : "#F5AC37", fontFamily: "'JetBrains Mono', monospace" }}>
                {allocation > 0 ? `${(parseFloat(priceImpact) * 100).toFixed(2)}%` : "—"}
              </div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fee Cost</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#ccc", fontFamily: "'JetBrains Mono', monospace" }}>{allocation > 0 ? `$${feeCost}` : "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Volume</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#ccc", fontFamily: "'JetBrains Mono', monospace" }}>{allocation > 0 ? `${Number(volumeRouted).toLocaleString()}` : "—"}</div>
            </div>
          </div>

          {/* Effective rate */}
          {allocation > 0 && (
            <div style={{ marginTop: 12, padding: "6px 0", borderTop: "1px dashed #2A2A30", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>Eff. Rate</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#00F0FF", fontFamily: "'JetBrains Mono', monospace" }}>{effectiveRate}</span>
            </div>
          )}

          {/* Bottom progress bar */}
          <div style={{ position: "absolute", bottom: 0, left: 0, height: 2, width: anim ? `${allocation}%` : "0%", background: protocol.color, transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)", opacity: 0.7 }} />
        </div>

        {/* ── BACK FACE ── */}
        <div style={{
          ...faceStyle,
          background: "#14141A",
          border: `1px solid ${protocol.color}40`,
          transform: "rotateY(180deg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}>
          {/* Radial glow */}
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${protocol.color}18, transparent 70%)`, pointerEvents: "none" }} />
          {/* Logo */}
          {(protocol as typeof protocol & { logoImg?: string }).logoImg
            ? <img src={(protocol as typeof protocol & { logoImg?: string }).logoImg} alt={protocol.name} style={{ width: 64, height: 64, objectFit: "contain" }} />
            : (
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: `${protocol.color}18`,
                border: `2px solid ${protocol.color}60`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 900, color: protocol.color,
                fontFamily: "'Inter', sans-serif",
                boxShadow: `0 0 24px ${protocol.color}30`,
              }}>
                {protocol.logo}
              </div>
            )
          }
          {/* Protocol full name */}
          <div style={{ fontSize: 12, fontWeight: 700, color: protocol.color, fontFamily: "'Inter', sans-serif", letterSpacing: "0.02em", textAlign: "center", padding: "0 12px" }}>
            {protocol.logoFull}
          </div>
          {/* Type badge */}
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {protocol.type} · TVL ${protocol.tvl}
          </div>
          {/* Bottom accent line */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${protocol.color}80, transparent)` }} />
        </div>
      </div>
    </div>
  );
};

interface ParticleData extends ParticleProps {
  id: string;
}

const CANVAS_W = 1600;
const CANVAS_H = 1400;

export default function FluidSORStation() {
  const [amount, setAmount] = useState(25000);
  const [fromToken, setFromToken] = useState("USDC");
  const [toToken, setToToken] = useState("USDT");
  const [isRouting, setIsRouting] = useState(false);
  const [routeComplete, setRouteComplete] = useState(false);
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [vizScale, setVizScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const vizWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = vizWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setVizScale(Math.min(1, w / CANVAS_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getAllocations = useCallback(() => {
    if (amount < 5000) return [0, 0, 0, 100, 0];
    if (amount < 20000) return [25, 10, 15, 40, 10];
    if (amount < 50000) return [30, 20, 15, 25, 10];
    return [35, 25, 10, 15, 15];
  }, [amount]);

  const getSlippage = useCallback(() => {
    const base = amount * 0.00003;
    return {
      single: (base * 4.5).toFixed(2),
      optimized: (base * 0.6).toFixed(2),
      savings: (base * 3.9).toFixed(2),
    };
  }, [amount]);

  const allocations = getAllocations();
  const slippage = getSlippage();

  const nodePositions = [
    { x: 550,  y: 240 },  // Aerodrome  — row 1 left
    { x: 1050, y: 240 },  // Uniswap V3 — row 1 right
    { x: 400,  y: 580 },  // Curve      — row 2 left
    { x: 800,  y: 1000 },  // Fluid StableAMM — row 3 center (extra gap from row 2)
    { x: 1200, y: 580 },   // Maker PSM  — row 2 right
  ];

  const sourcePos = { x: 800, y: 1240 };
  const destPos = { x: 800, y: -20 };

  const executeRoute = () => {
    if (isRouting) return;
    setIsRouting(true);
    setRouteComplete(false);
    setShowComparison(false);

    const newParticles: ParticleData[] = [];
    const allocs = getAllocations();

    allocs.forEach((alloc, i) => {
      if (alloc === 0) return;
      const count = Math.max(2, Math.floor(alloc / 12));
      for (let j = 0; j < count; j++) {
        newParticles.push({
          id: `s-${i}-${j}`,
          startX: sourcePos.x,
          startY: sourcePos.y,
          endX: nodePositions[i].x,
          endY: nodePositions[i].y,
          color: TOKENS[fromToken].color,
          delay: j * 80 + i * 120,
          duration: 900 + Math.random() * 300,
          size: 4 + alloc / 25,
        });
        newParticles.push({
          id: `d-${i}-${j}`,
          startX: nodePositions[i].x,
          startY: nodePositions[i].y,
          endX: destPos.x,
          endY: destPos.y + 60,
          color: TOKENS[toToken].color,
          delay: 1000 + j * 80 + i * 120,
          duration: 900 + Math.random() * 300,
          size: 4 + alloc / 25,
        });
      }
    });

    setParticles(newParticles);

    setTimeout(() => {
      setRouteComplete(true);
      setShowComparison(true);
    }, 2800);
    setTimeout(() => {
      setIsRouting(false);
      setParticles([]);
    }, 3500);
  };

  return (
    <div
      style={{
        background: "#08080A",
        color: "#E8E8EC",
        fontFamily: "'Inter', 'JetBrains Mono', monospace",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes sorPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.8; } }
        @keyframes sorGlowPulse { 0%,100% { box-shadow: 0 0 20px #00F0FF15; } 50% { box-shadow: 0 0 40px #00F0FF30; } }
        @keyframes sorScanline { 0% { top: -2px; } 100% { top: 100%; } }
        @keyframes sorBorderGlow { 0%,100% { border-color: #00F0FF20; } 50% { border-color: #00F0FF50; } }
        input[type=range].sor-range { -webkit-appearance: none; background: transparent; width: 100%; }
        input[type=range].sor-range::-webkit-slider-runnable-track { height: 3px; background: linear-gradient(90deg, #00F0FF40, #00F0FF); border-radius: 2px; }
        input[type=range].sor-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #00F0FF; margin-top: -7px; box-shadow: 0 0 12px #00F0FF60; cursor: pointer; }
      `}</style>

      {/* Background grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: "linear-gradient(#00F0FF 1px, transparent 1px), linear-gradient(90deg, #00F0FF 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" }} />

      {/* Scanline */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 100 }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #00F0FF08, transparent)", animation: "sorScanline 8s linear infinite" }} />
      </div>

      <div style={{ padding: "28px 40px", position: "relative", zIndex: 10, maxWidth: 1200, margin: "0 auto" }}>
        {/* Top row: Trade Parameters + Execution Breakdown */}
        <div style={{ display: "flex", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>

          {/* Trade Parameters */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{
              background: "#0C0C0F",
              border: "1px solid #1A1A20",
              borderRadius: 16,
              padding: 24,
              animation: "sorBorderGlow 4s ease infinite",
              height: "100%",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#00F0FF80", marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
                Trade Parameters
              </div>

              {/* From */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: "#444", marginBottom: 6, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>From</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.keys(TOKENS).map((t) => (
                    <button
                      key={`from-${t}`}
                      onClick={() => { if (t !== toToken) setFromToken(t); }}
                      style={{
                        padding: "6px 10px", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                        background: fromToken === t ? TOKENS[t].color + "20" : "#111115",
                        color: fromToken === t ? TOKENS[t].color : "#555",
                        border: `1px solid ${fromToken === t ? TOKENS[t].color + "50" : "#222"}`,
                        borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                      }}
                    >
                      {TOKENS[t].icon} {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* To */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: "#444", marginBottom: 6, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>To</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.keys(TOKENS).map((t) => (
                    <button
                      key={`to-${t}`}
                      onClick={() => { if (t !== fromToken) setToToken(t); }}
                      style={{
                        padding: "6px 10px", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                        background: toToken === t ? TOKENS[t].color + "20" : "#111115",
                        color: toToken === t ? TOKENS[t].color : "#555",
                        border: `1px solid ${toToken === t ? TOKENS[t].color + "50" : "#222"}`,
                        borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                      }}
                    >
                      {TOKENS[t].icon} {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 9, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Amount</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>
                    {amount.toLocaleString()} {fromToken}
                  </span>
                </div>
                <input type="range" className="sor-range" min={1000} max={200000} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: "100%" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: "#333", fontFamily: "'JetBrains Mono', monospace" }}>1K</span>
                  <span style={{ fontSize: 9, color: "#333", fontFamily: "'JetBrains Mono', monospace" }}>200K</span>
                </div>
              </div>

              {/* Execute */}
              <button
                onClick={executeRoute}
                disabled={isRouting}
                style={{
                  width: "100%", padding: "14px",
                  background: isRouting ? "#111" : routeComplete ? "linear-gradient(135deg, #00F0FF15, #00F0FF30)" : "linear-gradient(135deg, #00F0FF, #0080FF)",
                  color: isRouting ? "#333" : routeComplete ? "#00F0FF" : "#000",
                  border: routeComplete ? "1px solid #00F0FF40" : "none",
                  borderRadius: 12, fontSize: 13, fontWeight: 800, fontFamily: "'Inter', sans-serif",
                  letterSpacing: "0.05em", cursor: isRouting ? "not-allowed" : "pointer", transition: "all 0.3s",
                  animation: !isRouting && !routeComplete ? "sorGlowPulse 2s ease infinite" : "none",
                }}
              >
                {isRouting ? "⟳ ROUTING..." : routeComplete ? "✓ ROUTE COMPLETE — RUN AGAIN" : "▶ EXECUTE ATOMIC ROUTE"}
              </button>
            </div>
          </div>

          {/* Execution Breakdown */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{
              background: "#0C0C0F", border: "1px solid #1A1A20", borderRadius: 16, padding: 20,
              opacity: showComparison ? 1 : 0.4, transition: "opacity 0.6s", height: "100%",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#00F0FF80", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
                Execution Breakdown
              </div>

              {/* Slippage bars */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 8, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Slippage Comparison</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>Single DEX</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#FF4444", fontFamily: "'JetBrains Mono', monospace" }}>-${slippage.single}</span>
                  </div>
                  <div style={{ height: 4, background: "#1A1A20", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, #FF4444, #FF6666)", borderRadius: 2 }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>Fluid Routed</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#00F0FF", fontFamily: "'JetBrains Mono', monospace" }}>-${slippage.optimized}</span>
                  </div>
                  <div style={{ height: 4, background: "#1A1A20", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${(parseFloat(slippage.optimized) / parseFloat(slippage.single)) * 100}%`, background: "linear-gradient(90deg, #00F0FF, #0080FF)", borderRadius: 2, transition: "width 0.8s" }} />
                  </div>
                </div>
              </div>

              {/* Cost table */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 8, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Cost Breakdown</div>
                {[
                  { label: "Protocol Fees", single: (amount * 0.003).toFixed(2), fluid: (amount * 0.00045).toFixed(2) },
                  { label: "Price Impact", single: (amount * 0.0012).toFixed(2), fluid: (amount * 0.00018).toFixed(2) },
                  { label: "Gas Cost", single: "0.42", fluid: "0.68" },
                  { label: "MEV Protection", single: (amount * 0.0005).toFixed(2), fluid: "0.00" },
                ].map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #151518" }}>
                    <span style={{ fontSize: 9, color: "#555", fontFamily: "'JetBrains Mono', monospace", flex: 1 }}>{row.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "#FF6666", fontFamily: "'JetBrains Mono', monospace", width: 60, textAlign: "right" }}>${row.single}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "#00FF88", fontFamily: "'JetBrains Mono', monospace", width: 60, textAlign: "right" }}>${row.fluid}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 0, marginTop: 2, marginBottom: 2 }}>
                  <span style={{ fontSize: 7, color: "#FF666680", fontFamily: "'JetBrains Mono', monospace", width: 60, textAlign: "right" }}>SINGLE</span>
                  <span style={{ fontSize: 7, color: "#00FF8880", fontFamily: "'JetBrains Mono', monospace", width: 60, textAlign: "right" }}>FLUID</span>
                </div>
              </div>

              {/* Route stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Venues Used", value: String(allocations.filter((a) => a > 0).length), color: "#fff" },
                  { label: "Avg. Fee", value: `${allocations.reduce((acc, a, i) => acc + (a / 100) * parseFloat(PROTOCOLS[i].fee), 0).toFixed(3)}%`, color: "#00FF88" },
                  { label: "Est. Latency", value: "~2s", color: "#fff" },
                  { label: "MEV Shield", value: "ON", color: "#00FF88" },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "#0A0A0D", borderRadius: 10, padding: "8px 10px", border: "1px solid #1A1A20" }}>
                    <div style={{ fontSize: 7, color: "#444", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: stat.color, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Total savings */}
              <div style={{ padding: "12px 14px", background: "linear-gradient(135deg, #00F0FF06, #00FF8808)", border: "1px solid #00F0FF15", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "#00F0FF80", fontFamily: "'JetBrains Mono', monospace" }}>Total Savings</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#00FF88", fontFamily: "'JetBrains Mono', monospace" }}>+${slippage.savings}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>
                    vs. single pool on {amount > 50000 ? "Aerodrome" : "Curve"}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#00FF88", fontFamily: "'JetBrains Mono', monospace" }}>
                    {((parseFloat(slippage.savings) / amount) * 10000).toFixed(1)} bps
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width Visualization */}
        <div ref={vizWrapperRef}>
          <div
            ref={containerRef}
            style={{ position: "relative", height: CANVAS_H * vizScale, background: "#0A0A0D", border: "1px solid #151518", borderRadius: 20, overflow: "hidden" }}
          >
            {/* Dot grid — full width background */}
            <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle at 1px 1px, #00F0FF 1px, transparent 0)", backgroundSize: "30px 30px" }} />

            {/* Centered inner canvas — all positioned content lives here */}
            {/* Outer flex div centers the scaled-size wrapper (no layout overflow) */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              {/* Wrapper has the post-scale dimensions so flex centering works without clipping */}
              <div style={{ position: "relative", width: CANVAS_W * vizScale, height: CANVAS_H * vizScale, flexShrink: 0 }}>
              {/* Actual canvas scaled from top-left — stays within layout bounds */}
              <div style={{ position: "absolute", top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, transform: `scale(${vizScale})`, transformOrigin: "top left" }}>

                {/* Destination label */}
                <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, zIndex: 20 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: TOKENS[toToken].color + "20", border: `1.5px solid ${TOKENS[toToken].color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: TOKENS[toToken].color, fontWeight: 700 }}>
                    {TOKENS[toToken].icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS[toToken].color, fontFamily: "'JetBrains Mono', monospace" }}>
                    RECEIVE {toToken} ≈ 1:1
                  </span>
                </div>

                {/* SVG paths */}
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 5 }}>
                  {nodePositions.map((pos, i) => {
                    if (allocations[i] === 0) return null;
                    const opacity = isRouting ? 0.6 : 0.12;
                    return (
                      <g key={i}>
                        <path d={`M ${sourcePos.x} ${sourcePos.y} Q ${(sourcePos.x + pos.x) / 2} ${(sourcePos.y + pos.y) / 2 + 20} ${pos.x} ${pos.y + 55}`} stroke={PROTOCOLS[i].color} strokeWidth={Math.max(1, allocations[i] / 15)} fill="none" opacity={opacity} style={{ transition: "opacity 0.4s" }} />
                        <path d={`M ${pos.x} ${pos.y - 20} Q ${(destPos.x + pos.x) / 2} ${(destPos.y + pos.y) / 2 - 10} ${destPos.x} ${destPos.y + 60}`} stroke={PROTOCOLS[i].color} strokeWidth={Math.max(1, allocations[i] / 15)} fill="none" opacity={opacity} style={{ transition: "opacity 0.4s" }} />
                      </g>
                    );
                  })}
                </svg>

                {/* Protocol nodes */}
                {PROTOCOLS.map((p, i) => (
                  <ProtocolNode key={p.id} protocol={p} x={nodePositions[i].x} y={nodePositions[i].y} allocation={allocations[i]} isActive={allocations[i] > 0} isRouting={isRouting} delay={i * 150} amount={amount} />
                ))}

                {/* Particles */}
                {particles.map((p) => (
                  <Particle key={p.id} {...p} />
                ))}

                {/* Source token */}
                <div style={{ position: "absolute", left: sourcePos.x - 50, top: sourcePos.y - 20, width: 100, textAlign: "center", zIndex: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: TOKENS[fromToken].color + "15", border: `2px solid ${TOKENS[fromToken].color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: TOKENS[fromToken].color, fontWeight: 700, margin: "0 auto", boxShadow: isRouting ? `0 0 24px ${TOKENS[fromToken].color}30` : "none", transition: "box-shadow 0.4s" }}>
                    {TOKENS[fromToken].icon}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                    {amount.toLocaleString()} {fromToken}
                  </div>
                </div>

                {/* Atomic TX badge */}
                <div style={{ position: "absolute", bottom: 16, right: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: routeComplete ? "#00FF8810" : "#ffffff05", border: `1px solid ${routeComplete ? "#00FF8830" : "#ffffff10"}`, borderRadius: 8, zIndex: 20, transition: "all 0.4s" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: routeComplete ? "#00FF88" : "#333", boxShadow: routeComplete ? "0 0 8px #00FF88" : "none" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: routeComplete ? "#00FF88" : "#444", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
                    ATOMIC TX {routeComplete ? "CONFIRMED" : "PENDING"}
                  </span>
                </div>

                {/* Route info */}
                <div style={{ position: "absolute", bottom: 16, left: 0, zIndex: 20 }}>
                  <div style={{ fontSize: 9, color: "#333", fontFamily: "'JetBrains Mono', monospace" }}>
                    {allocations.filter((a) => a > 0).length} venues · {fromToken} → {toToken} · StableSwap · Base L2
                  </div>
                </div>

              </div>
              </div>
            </div>
          </div>

          {/* Route allocation bar */}
          <div style={{ marginTop: 16, background: "#0C0C0F", border: "1px solid #1A1A20", borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#00F0FF80", marginBottom: 12, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              Optimal Split
            </div>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
              {PROTOCOLS.map((p, i) =>
                allocations[i] > 0 ? (
                  <div key={p.id} style={{ width: `${allocations[i]}%`, background: `linear-gradient(90deg, ${p.color}CC, ${p.color})`, borderRadius: 3, transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: `0 0 8px ${p.color}30` }} />
                ) : null
              )}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
              {PROTOCOLS.map((p, i) =>
                allocations[i] > 0 ? (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                    <span style={{ fontSize: 10, color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>{p.name} {allocations[i]}%</span>
                  </div>
                ) : null
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
