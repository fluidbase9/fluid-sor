/**
 * FluidSwapWidget
 * Self-contained FluidSOR swap UI — same look & feel as the SDK template.
 * No external wallet deps required. Quote-only mode: shows routes, no on-chain execution.
 * CSS animations are injected via a <style> tag scoped to this component.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { privateKeyToAccount } from "viem/accounts";

// ─── Standalone wallet derivation ────────────────────────────────────────────
// Option A: derive from private key (VITE_FLUID_PRIVATE_KEY)
const _pk   = (import.meta.env.VITE_FLUID_PRIVATE_KEY as string | undefined)?.trim();
const _acct = (_pk?.startsWith("0x") && _pk.length === 66)
  ? (() => { try { return privateKeyToAccount(_pk as `0x${string}`); } catch { return null; } })()
  : null;
// Option B: directly provide wallet address + email (no private key needed)
const _directAddr  = (import.meta.env.VITE_FLUID_WALLET_ADDRESS as string | undefined)?.trim();
const _directEmail = (import.meta.env.VITE_FLUID_EMAIL          as string | undefined)?.trim();
const _standaloneUser =
  _acct
    ? { walletAddress: _acct.address,  email: (import.meta.env.VITE_FLUID_API_KEY as string | undefined) ?? "" }
  : (_directAddr && _directEmail)
    ? { walletAddress: _directAddr,    email: _directEmail }
    : null;

// ─── Injected CSS (same as SDK template index.css) ────────────────────────────

const WIDGET_CSS = `
@keyframes fsw-pulse-dot {
  0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}
}
@keyframes fsw-scan-line {
  0%{transform:translateX(-100%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(100%);opacity:0}
}
@keyframes fsw-venue-appear {
  from{opacity:0;transform:translateY(6px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}
}
@keyframes fsw-route-lock {
  from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}
}
@keyframes fsw-shimmer {
  0%{background-position:-200% 0}100%{background-position:200% 0}
}
.fsw-scanning-venue{animation:fsw-venue-appear .3s ease forwards}
.fsw-flow-line{position:relative;height:2px;background:#1f1f1f;border-radius:1px;overflow:hidden}
.fsw-flow-line::after{content:"";position:absolute;top:0;left:0;height:100%;width:40%;border-radius:1px;animation:fsw-scan-line 1.4s ease-in-out infinite}
.fsw-flow-line.cyan::after {background:linear-gradient(90deg,transparent,#22d3ee,transparent)}
.fsw-flow-line.pink::after {background:linear-gradient(90deg,transparent,#ff007a,transparent)}
.fsw-flow-line.blue::after {background:linear-gradient(90deg,transparent,#3b82f6,transparent)}
.fsw-flow-line.purple::after{background:linear-gradient(90deg,transparent,#a78bfa,transparent)}
.fsw-shimmer{background:linear-gradient(90deg,#4b5563 0%,#9ca3af 40%,#22d3ee 50%,#9ca3af 60%,#4b5563 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:fsw-shimmer 2s linear infinite}
.fsw-route-bar-enter{animation:fsw-route-lock .35s cubic-bezier(.34,1.56,.64,1) forwards;transform-origin:left}
.fsw-venue-scroll::-webkit-scrollbar,.fsw-route-scroll::-webkit-scrollbar{display:none}
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SorRoute {
  venue:        string;
  amountOut:    string;
  amountOutRaw: number;
  priceImpact:  string;
  gasEstimate:  string;
  splitBps?:    number;
  badge?:       string;
  badgeColor?:  string;
  recommended?: boolean;
}

type Network = "base" | "ethereum" | "solana" | "injective";

interface Token { symbol: string; color: string; }

// ─── Static config ────────────────────────────────────────────────────────────

const NETWORKS: { id: Network; label: string; color: string; icon: string; imgUrl: string }[] = [
  { id: "base",      label: "base",      color: "#0052FF", icon: "🔵", imgUrl: "https://fluidspot.s3.us-east-2.amazonaws.com/fluid_assets_2025/2025_nov/Base1.png"      },
  { id: "ethereum",  label: "Ethereum",  color: "#627EEA", icon: "Ξ",  imgUrl: "https://fluidspot.s3.us-east-2.amazonaws.com/fluid_assets_2025/2025_nov/ethereum1.png"  },
  { id: "solana",    label: "Solana",    color: "#9945FF", icon: "◎",  imgUrl: "https://fluidspot.s3.us-east-2.amazonaws.com/fluid_assets_2025/2025_nov/solana1.png"    },
  { id: "injective", label: "Injective", color: "#00C2FF", icon: "⬡",  imgUrl: "https://fluidspot.s3.us-east-2.amazonaws.com/fluid_assets_2025/2025_nov/injective1.png" },
];

const TOKENS_BY_NETWORK: Record<Network, Record<string, Token>> = {
  base:      { USDC: { symbol: "USDC", color: "#2775CA" }, USDT: { symbol: "USDT", color: "#26A17B" }, ETH: { symbol: "ETH", color: "#627EEA" } },
  ethereum:  { USDC: { symbol: "USDC", color: "#2775CA" }, USDT: { symbol: "USDT", color: "#26A17B" }, ETH: { symbol: "ETH", color: "#627EEA" } },
  solana:    { USDC: { symbol: "USDC", color: "#2775CA" }, USDT: { symbol: "USDT", color: "#26A17B" }, SOL: { symbol: "SOL", color: "#9945FF" } },
  injective: { USDT: { symbol: "USDT", color: "#26A17B" }, USDC: { symbol: "USDC", color: "#2775CA" }, INJ: { symbol: "INJ", color: "#00C2FF" } },
};

// Minimum native gas needed to execute a swap on each chain
const GAS_THRESHOLDS: Record<Network, number> = {
  base:      0.000001,
  ethereum:  0.001,
  solana:    0.001,
  injective: 0.01,
};

const GAS_TOKEN: Record<Network, string> = {
  base: "ETH", ethereum: "ETH", solana: "SOL", injective: "INJ",
};

const NETWORK_ROUTER_LABEL: Record<Network, string> = {
  base:      "FluidSOR · Base",
  ethereum:  "Uniswap V3 · Ethereum",
  solana:    "Jupiter · Solana",
  injective: "Helix · Injective",
};

const VENUE_META: Record<string, { color: string; icon: string; logo?: string }> = {
  "Fluid AMM":   { color: "#22d3ee", icon: "◈", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/web/Base/media_files/fluid23.png" },
  "Uniswap V3":  { color: "#ff007a", icon: "🦄", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Uniswap1.jpg" },
  "Aerodrome":   { color: "#3b82f6", icon: "✈",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/AnNwWdzS_400x400.jpg" },
  "Split":       { color: "#a78bfa", icon: "⑂"  },
  "Curve":       { color: "#f59e0b", icon: "⟳",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/curve-dao-token-crv-logo.png" },
  "Balancer":    { color: "#7c3aed", icon: "⬡",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/balancer.png" },
  "PancakeSwap": { color: "#d97706", icon: "🥞", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/pancakeswap.png" },
  "SushiSwap":   { color: "#e11d48", icon: "🍣", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/sushiswap.jpg" },
  "Velodrome":   { color: "#6366f1", icon: "⚡", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/velodrome.png" },
  "DODO":        { color: "#facc15", icon: "🦤", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/DODO.jpg" },
  "KyberSwap":   { color: "#31c48d", icon: "🔷", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/kyber.jpg" },
  "1inch":       { color: "#1d4ed8", icon: "🔵", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/1inch-1inch-logo.png" },
  "Odos":        { color: "#6366f1", icon: "⊕",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/odos.png" },
  "OpenOcean":   { color: "#38bdf8", icon: "🌊", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/open_ocean.jpg" },
  "Raydium":     { color: "#9945FF", icon: "◎"  },
  "Orca":        { color: "#00C2FF", icon: "🐋" },
  "Jupiter":     { color: "#C7F284", icon: "🪐" },
  "Helix":       { color: "#00C2FF", icon: "∞"  },
};

function venueColor(venue: string) {
  const key = Object.keys(VENUE_META).find((k) => venue.includes(k)) ?? "Split";
  return VENUE_META[key] ?? { color: "#6b7280", icon: "◈", logo: undefined };
}

const VENUES_SCAN = [
  { key: "Fluid",       label: "Fluid AMM",   color: "#22d3ee", icon: "◈",  lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/web/Base/media_files/fluid23.png" },
  { key: "Uniswap",     label: "Uniswap V3",  color: "#ff007a", icon: "🦄", lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Uniswap1.jpg" },
  { key: "Aerodrome",   label: "Aerodrome",   color: "#3b82f6", icon: "✈",  lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/AnNwWdzS_400x400.jpg" },
  { key: "Curve",       label: "Curve",       color: "#f59e0b", icon: "⟳",  lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/curve-dao-token-crv-logo.png" },
  { key: "Balancer",    label: "Balancer",    color: "#7c3aed", icon: "⬡",  lineClass: "purple", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/balancer.png" },
  { key: "PancakeSwap", label: "PancakeSwap", color: "#d97706", icon: "🥞", lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/pancakeswap.png" },
  { key: "SushiSwap",   label: "SushiSwap",   color: "#e11d48", icon: "🍣", lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/sushiswap.jpg" },
  { key: "Velodrome",   label: "Velodrome",   color: "#6366f1", icon: "⚡", lineClass: "purple", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/velodrome.png" },
  { key: "Odos",        label: "Odos",        color: "#6366f1", icon: "⊕",  lineClass: "purple", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/odos.png" },
  { key: "OpenOcean",   label: "OpenOcean",   color: "#38bdf8", icon: "🌊", lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/open_ocean.jpg" },
  { key: "Raydium",     label: "Raydium",     color: "#9945FF", icon: "◎",  lineClass: "purple" },
  { key: "Orca",        label: "Orca",        color: "#00C2FF", icon: "🐋", lineClass: "blue"   },
  { key: "Jupiter",     label: "Jupiter",     color: "#C7F284", icon: "🪐", lineClass: "cyan"   },
  { key: "KyberSwap",   label: "KyberSwap",   color: "#31c48d", icon: "🔷", lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/kyber.jpg" },
  { key: "DODO",        label: "DODO",        color: "#facc15", icon: "🦤", lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/DODO.jpg" },
  { key: "1inch",       label: "1inch",       color: "#1d4ed8", icon: "🔵", lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/1inch-1inch-logo.png" },
  { key: "Helix",       label: "Helix",       color: "#00C2FF", icon: "∞",  lineClass: "blue"   },
  { key: "Bancor",      label: "Bancor",      color: "#12b886", icon: "◉",  lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/bancor-bnt-logo.png" },
  { key: "Trader Joe",  label: "Trader Joe",  color: "#ef4444", icon: "🎰", lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Trader_joe.png" },
  { key: "GMX",         label: "GMX",         color: "#06b6d4", icon: "◆",  lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/GMX-logo-1.png" },
  { key: "Maverick",    label: "Maverick",    color: "#ec4899", icon: "◀",  lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Maverick.png" },
  { key: "Ambient",     label: "Ambient",     color: "#10b981", icon: "〰", lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/ambient.png" },
  { key: "WOOFi",       label: "WOOFi",       color: "#8b5cf6", icon: "🐕", lineClass: "purple", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/woofi.png" },
  { key: "Hashflow",    label: "Hashflow",    color: "#0ea5e9", icon: "⌗",  lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/hashflow.png" },
  { key: "Clipper",     label: "Clipper",     color: "#f472b6", icon: "✂",  lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/clipper.png" },
];

// ─── Inline styles ────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "#ffffff", border: "1px solid #e2e2ea",
    borderRadius: 20, padding: "1.5rem",
    display: "flex", flexDirection: "column" as const, gap: "1rem",
  } as React.CSSProperties,
  inputBox: {
    background: "#f5f5f8", border: "1px solid #e2e2ea", borderRadius: 14,
    padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem",
  } as React.CSSProperties,
  inputNum: {
    flex: 1, background: "transparent", border: "none", color: "#0f0f14",
    fontSize: "1.4rem", fontWeight: 700, width: "100%", outline: "none",
  } as React.CSSProperties,
  tokenBtn: (color: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "0.4rem",
    background: color + "18", border: `1px solid ${color}44`,
    borderRadius: 10, color, padding: "0.4rem 0.75rem",
    fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  }),
  btn: (color: string, disabled?: boolean): React.CSSProperties => ({
    width: "100%", padding: "0.95rem", borderRadius: 14, border: "none",
    background: disabled ? "#e8e8f0" : color,
    color: disabled ? "#9ca3af" : "#fff",
    fontWeight: 700, fontSize: "1rem",
    cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
  }),
  badge: (color: string): React.CSSProperties => ({
    display: "inline-block", background: color + "22", border: `1px solid ${color}55`,
    color, borderRadius: 6, padding: "0.15rem 0.45rem",
    fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
  }),
  flipBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 34, height: 34, borderRadius: "50%",
    background: "#e8e8f0", border: "1px solid #d0d0dc",
    cursor: "pointer", margin: "0 auto", color: "#6b7280", fontSize: "1.1rem",
  } as React.CSSProperties,
};

// ─── Token selector modal ─────────────────────────────────────────────────────

function TokenSelect({ value, exclude, tokens, onChange, onClose }: {
  value: string; exclude: string;
  tokens: Record<string, Token>;
  onChange: (t: string) => void; onClose: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: "1.25rem", minWidth: 220, maxHeight: "70vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>Select token</div>
        {Object.values(tokens).filter(t => t.symbol !== exclude).map(t => (
          <button key={t.symbol} onClick={() => { onChange(t.symbol); onClose(); }}
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%", padding: "0.65rem 0.75rem", borderRadius: 10, background: value === t.symbol ? t.color + "15" : "transparent", border: value === t.symbol ? `1px solid ${t.color}44` : "1px solid transparent", color: "#fff", cursor: "pointer", marginBottom: "0.35rem" }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, color: t.color }}>{t.symbol.slice(0, 2)}</span>
            <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>{t.symbol}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Route card ───────────────────────────────────────────────────────────────

function RouteCard({ route, toSym, selected, onClick, rank }: {
  route: SorRoute; toSym: string; selected: boolean; onClick: () => void; rank: number;
}) {
  const { color, icon, logo } = venueColor(route.venue);
  const isBest = rank === 0;
  const rankLabels = ["BEST","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"];
  const rankLabel  = rankLabels[rank] ?? `${rank + 1}th`;
  const rankColor  = rank === 0 ? "#4ade80" : rank === 1 ? "#facc15" : rank === 2 ? "#fb923c" : "#6b7280";

  const shortName = route.venue
    .replace(" Aggregator","").replace(" Stable AMM"," AMM")
    .replace(" Volatile"," Vol").replace(" V3 "," ")
    .replace("PancakeSwap","Pancake").replace("SushiSwap","Sushi")
    .replace("Fluid AMM + Uni V3","Fluid Split").replace("Velodrome V2","Velodrome");

  return (
    <button onClick={onClick} style={{ position: "relative", textAlign: "left", padding: "0.65rem 0.6rem 0.55rem", borderRadius: 10, border: selected ? `1.5px solid ${color}88` : isBest ? `1px solid ${color}44` : "1px solid #e2e2ea", background: selected ? color + "12" : isBest ? color + "08" : "#f8f8fc", cursor: "pointer", width: "100%", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: "0.3rem", minHeight: 80 }}>
      <span style={{ position: "absolute", top: 5, right: 5, background: rankColor + "22", border: `1px solid ${rankColor}55`, color: rankColor, borderRadius: 4, fontSize: "0.48rem", fontWeight: 800, padding: "0.1rem 0.3rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{rankLabel}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
        {logo ? (
          <img src={logo} alt={shortName} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>{icon}</span>
        )}
        <span style={{ fontSize: "0.62rem", fontWeight: 700, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "calc(100% - 20px)" }}>{shortName}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: "0.75rem", color: rank < 3 ? rankColor : "#e5e7eb", letterSpacing: "-0.01em", wordBreak: "break-all", lineHeight: 1.2 }}>
        {route.amountOut}<span style={{ fontSize: "0.58rem", color: "#6b7280", marginLeft: "0.2rem" }}>{toSym}</span>
      </div>
      <div style={{ fontSize: "0.55rem", color: "#374151", display: "flex", justifyContent: "space-between" }}>
        <span>{parseFloat(route.priceImpact).toFixed(2)}% fee</span>
        <span>{route.gasEstimate}</span>
      </div>
      {route.badge && <span style={{ background: color + "18", border: `1px solid ${color}33`, color, borderRadius: 4, fontSize: "0.48rem", fontWeight: 700, padding: "0.08rem 0.3rem", letterSpacing: "0.04em", textTransform: "uppercase", alignSelf: "flex-start" }}>{route.badge}</span>}
    </button>
  );
}

// ─── Routing animation ────────────────────────────────────────────────────────

function RoutingAnimation({ fromSym, toSym, scanning, routes }: {
  fromSym: string; toSym: string; scanning: boolean; routes: SorRoute[];
}) {
  const [visibleVenues, setVisibleVenues] = useState<number>(0);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scanning) {
      setVisibleVenues(0);
      let i = 0;
      timerRef.current = setInterval(() => {
        i++;
        setVisibleVenues(i);
        if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        if (i >= VENUES_SCAN.length) clearInterval(timerRef.current!);
      }, 80);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setVisibleVenues(VENUES_SCAN.length);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [scanning]);

  const tokenInColor  = (TOKENS_BY_NETWORK.base[fromSym] ?? TOKENS_BY_NETWORK.solana[fromSym])?.color ?? "#6b7280";
  const tokenOutColor = (TOKENS_BY_NETWORK.base[toSym]   ?? TOKENS_BY_NETWORK.solana[toSym])?.color   ?? "#6b7280";

  const displayVenues = scanning
    ? VENUES_SCAN.slice(0, visibleVenues)
    : [...VENUES_SCAN].sort((a, b) => {
        const ra = routes.findIndex(r => r.venue.includes(a.key));
        const rb = routes.findIndex(r => r.venue.includes(b.key));
        if (ra === -1 && rb === -1) return 0;
        if (ra === -1) return 1;
        if (rb === -1) return -1;
        return ra - rb;
      });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", display: "inline-block", flexShrink: 0, animation: scanning ? "fsw-pulse-dot 0.9s ease-in-out infinite" : "none" }} />
          {scanning
            ? <span className="fsw-shimmer" style={{ fontSize: "0.7rem", fontWeight: 600 }}>Scanning {VENUES_SCAN.length} venues…</span>
            : <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#22d3ee" }}>{routes.length} route{routes.length !== 1 ? "s" : ""} found · best price auto-selected</span>
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
          <span style={{ background: tokenInColor + "18", border: `1px solid ${tokenInColor}44`, borderRadius: 6, padding: "0.15rem 0.4rem", fontSize: "0.62rem", fontWeight: 700, color: tokenInColor }}>{fromSym}</span>
          <span style={{ color: "#374151", fontSize: "0.6rem" }}>→</span>
          <span style={{ background: tokenOutColor + "18", border: `1px solid ${tokenOutColor}44`, borderRadius: 6, padding: "0.15rem 0.4rem", fontSize: "0.62rem", fontWeight: 700, color: tokenOutColor }}>{toSym}</span>
        </div>
      </div>

      {/* 3-row × N-col side-scroll grid */}
      <div ref={scrollRef} className="fsw-venue-scroll" style={{ display: "grid", gridTemplateRows: "repeat(3, auto)", gridAutoFlow: "column", gridAutoColumns: 100, gap: "0.3rem", overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {displayVenues.map((v, i) => {
          const matchedRoute = routes.find(r => r.venue.includes(v.key));
          const isBest = !scanning && matchedRoute && routes[0]?.venue === matchedRoute.venue;
          return (
            <div key={v.key} className="fsw-scanning-venue" style={{ animationDelay: `${i * 0.04}s`, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "0.5rem", padding: "0.75rem 0.65rem", borderRadius: 10, minHeight: 90, background: isBest ? "#f0fdf4" : "#f8f8fc", border: isBest ? "1px solid #4ade8044" : `1px solid #e2e2ea`, transition: "background 0.3s,border 0.3s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                {v.logo ? (
                  <img src={v.logo} alt={v.label} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <span style={{ fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>{v.icon}</span>
                )}
                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: v.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.label}</span>
              </div>
              {scanning
                ? <div className={`fsw-flow-line ${v.lineClass}`} style={{ width: "100%", height: 3, borderRadius: 2 }} />
                : <div style={{ width: "100%", height: 3, borderRadius: 2, background: matchedRoute ? v.color + "55" : "#1f1f1f" }} />
              }
              <div>
                {scanning ? (
                  <>
                    <div className="fsw-shimmer" style={{ height: 10, borderRadius: 4, width: "80%", background: "#1a1a1a", marginBottom: 4 }} />
                    <div style={{ height: 8, borderRadius: 4, width: "55%", background: "#141414" }} />
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "0.68rem", fontWeight: isBest ? 800 : 600, color: isBest ? "#4ade80" : matchedRoute ? "#e5e7eb" : "#374151", letterSpacing: "-0.01em", lineHeight: 1.3, wordBreak: "break-all" }}>
                      {matchedRoute ? matchedRoute.amountOut : "—"}
                    </div>
                    {isBest && <span style={{ display: "inline-block", marginTop: "0.2rem", fontSize: "0.46rem", fontWeight: 800, color: "#4ade80", background: "#4ade8015", border: "1px solid #4ade8033", borderRadius: 3, padding: "0.06rem 0.28rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>BEST</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Best route bar */}
      {!scanning && routes.length > 0 && (() => {
        const bestMeta = venueColor(routes[0].venue);
        return (
          <div className="fsw-route-bar-enter" style={{ background: "#22d3ee08", border: "1px solid #22d3ee2a", borderRadius: 8, padding: "0.4rem 0.65rem", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem" }}>
            <span style={{ color: "#22d3ee", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
              {bestMeta.logo ? (
                <img src={bestMeta.logo} alt={routes[0].venue} style={{ width: 14, height: 14, borderRadius: 3, objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span style={{ fontSize: "0.8rem" }}>{bestMeta.icon}</span>
              )}
              Best: {routes[0].venue}
            </span>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{routes[0].amountOut} {toSym}</span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export interface FluidSwapWidgetProps {
  /** Called when best route is selected — parent can use for further action */
  onRouteFound?: (routes: SorRoute[], network: Network) => void;
  /** When true, swap button redirects to /auth instead of executing */
  previewMode?: boolean;
  /** Pre-fill the "You pay" amount from a parent input */
  initialAmount?: string;
  /** Render as 4 separate card divs (for 5-col landing page layout) */
  fiveColMode?: boolean;
}

export default function FluidSwapWidget({ onRouteFound, previewMode = false, initialAmount, fiveColMode = false }: FluidSwapWidgetProps = {}) {
  const [network,  setNetwork]  = useState<Network>("base");
  const [fromSym,  setFromSym]  = useState("USDT");
  const [toSym,    setToSym]    = useState("USDC");
  const [amount,   setAmount]   = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [routes,   setRoutes]   = useState<SorRoute[]>([]);
  const [selRoute, setSelRoute] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [quoting,  setQuoting]  = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [showFrom,   setShowFrom]   = useState(false);
  const [showTo,     setShowTo]     = useState(false);
  const [execModal,  setExecModal]  = useState<"confirm" | "executing" | "success" | "fail" | null>(null);
  const [execResult, setExecResult] = useState<{ txHash?: string; explorerUrl?: string; isSimulated?: boolean; bridgeTrackingUrl?: string; error?: string } | null>(null);
  const [swipeX,     setSwipeX]     = useState(0);
  const [toNetwork, setToNetwork] = useState<Network>("base");
  const [bridgeQuote, setBridgeQuote] = useState<{ toAmount: string; provider: string; estimatedTime: string; feeUsd: string; priceImpact: string; isRealBridge?: boolean } | null>(null);
  const swipeTrackRef = useRef<HTMLDivElement>(null);
  const swipeDragRef  = useRef<{ active: boolean; startClient: number; startX: number }>({ active: false, startClient: 0, startX: 0 });
  // Identity + history state
  const [fluidId,            setFluidId]            = useState<string | null>(null);
  const [chainAddress,       setChainAddress]       = useState<string | null>(null);
  const [chainAddrLoading,   setChainAddrLoading]   = useState(false);
  const [toChainAddress,     setToChainAddress]     = useState<string | null>(null);
  const [toChainAddrLoading, setToChainAddrLoading] = useState(false);
  const [copiedField,        setCopiedField]        = useState<"id" | "addr" | "toAddr" | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);
  const [swapHist,         setSwapHist]         = useState<any[]>([]);
  const [histLoading,      setHistLoading]      = useState(false);
  const [showHistory,      setShowHistory]      = useState(false);

  const currentUser = _standaloneUser;
  const navigate = (_path: string) => { window.open("https://fluidnative.com", "_blank"); };
  const [walletBal, setWalletBal]               = useState<{ token: string; amount: string; usdValue: number }[] | null>(null);
  const [walletBalLoading, setWalletBalLoading] = useState(false);
  const [gasBal,    setGasBal]    = useState<{ amount: number; symbol: string; sufficient: boolean } | null>(null);
  const [gasBalLoading, setGasBalLoading] = useState(false);
  const [gasTokenPrice, setGasTokenPrice] = useState<number>(0);

  const networkMeta     = NETWORKS.find(n => n.id === network)!;
  const networkTokens   = TOKENS_BY_NETWORK[network];
  const toNetworkMeta   = NETWORKS.find(n => n.id === toNetwork)!;
  const toNetworkTokens = TOKENS_BY_NETWORK[toNetwork];
  const isCrossChain    = network !== toNetwork;
  const tokenIn         = networkTokens[fromSym] ?? Object.values(networkTokens)[0];
  const tokenOut        = toNetworkTokens[toSym] ?? Object.values(toNetworkTokens)[0];

  const handleNetworkChange = (net: Network) => {
    const keys = Object.keys(TOKENS_BY_NETWORK[net]);
    setNetwork(net);
    if (!TOKENS_BY_NETWORK[net][fromSym]) setFromSym(keys[0]);
    if (net === toNetwork && !TOKENS_BY_NETWORK[net][toSym]) setToSym(keys[1] ?? keys[0]);
    setRoutes([]); setBridgeQuote(null); setAmount(""); setQuoteErr(null);
  };

  const handleToNetworkChange = (net: Network) => {
    const keys = Object.keys(TOKENS_BY_NETWORK[net]);
    setToNetwork(net);
    if (!TOKENS_BY_NETWORK[net][toSym]) setToSym(keys[0]);
    setRoutes([]); setBridgeQuote(null); setAmount(""); setQuoteErr(null);
  };

  // Wallet balance — fetch ALL tokens for the selected network
  useEffect(() => {
    if (!currentUser) { setWalletBal(null); return; }
    let cancelled = false;
    setWalletBal(null);
    setWalletBalLoading(true);
    const evmAddress = currentUser.walletAddress;
    const email      = currentUser.email ?? "";
    (async () => {
      try {
        const rows: { token: string; amount: string; usdValue: number }[] = [];

        if (network === "base" || network === "ethereum") {
          // Native token price (ETH)
          let ethPrice = 0;
          try { const p = await fetch("/api/prices/eth"); ethPrice = (await p.json()).price ?? 0; } catch {}

          // ETH native balance
          const rpcUrl = network === "base" ? "https://mainnet.base.org" : "https://ethereum.publicnode.com";
          const ethResp = await fetch(rpcUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [evmAddress, "latest"], id: 1 }),
          });
          const ethRaw = parseInt((await ethResp.json()).result ?? "0x0", 16) / 1e18;
          rows.push({ token: "ETH", amount: ethRaw < 0.000001 ? "0.000000" : ethRaw.toFixed(6), usdValue: ethRaw * ethPrice });

          // USDC
          const usdcAddr = network === "base" ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" : "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
          const usdcResp = await fetch(`/api/evm/${network}/token/${usdcAddr}/balance/${evmAddress}`);
          if (usdcResp.ok) {
            const amt = parseFloat((await usdcResp.json()).balance || "0");
            rows.push({ token: "USDC", amount: amt.toFixed(2), usdValue: amt });
          }

          // USDT
          const usdtAddr = network === "base" ? "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" : "0xdAC17F958D2ee523a2206206994597C13D831ec7";
          const usdtResp = await fetch(`/api/evm/${network}/token/${usdtAddr}/balance/${evmAddress}`);
          if (usdtResp.ok) {
            const amt = parseFloat((await usdtResp.json()).balance || "0");
            rows.push({ token: "USDT", amount: amt.toFixed(2), usdValue: amt });
          }

        } else if (network === "solana") {
          if (!email) { if (!cancelled) setWalletBal([]); return; }
          let solPrice = 0;
          try { const p = await fetch("/api/crypto/onchain-price/SOL"); solPrice = (await p.json()).price ?? 0; } catch {}

          const deriveResp = await fetch("/api/solana/derive-address", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          if (!deriveResp.ok) throw new Error("derive failed");
          const { address: solAddr } = await deriveResp.json();

          // SOL native
          const solNativeResp = await fetch("https://api.mainnet-beta.solana.com", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "getBalance", params: [solAddr], id: 1 }),
          });
          const solLamports = (await solNativeResp.json()).result?.value ?? 0;
          const solAmt = solLamports / 1e9;
          rows.push({ token: "SOL", amount: solAmt.toFixed(4), usdValue: solAmt * solPrice });

          // SPL tokens
          const tokensResp = await fetch(`/api/solana/tokens/${solAddr}`);
          const tokensData = tokensResp.ok ? await tokensResp.json() : { tokens: [] };
          const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
          const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
          for (const t of (tokensData.tokens ?? [])) {
            const amt = parseFloat(t.uiAmount ?? t.balance ?? "0");
            if (t.mint === USDC_MINT) rows.push({ token: "USDC", amount: amt.toFixed(2), usdValue: amt });
            else if (t.mint === USDT_MINT) rows.push({ token: "USDT", amount: amt.toFixed(2), usdValue: amt });
          }

        } else if (network === "injective") {
          if (!email) { if (!cancelled) setWalletBal([]); return; }
          let injPrice = 0;
          try { const p = await fetch("/api/crypto/onchain-price/INJ"); injPrice = (await p.json()).price ?? 0; } catch {}

          const deriveResp = await fetch("/api/injective/derive-address", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          if (!deriveResp.ok) throw new Error("derive failed");
          const { address: injAddr } = await deriveResp.json();

          const balResp = await fetch(`/api/injective/balance/${injAddr}`);
          if (balResp.ok) {
            const bd = await balResp.json();
            const injAmt = parseFloat(bd.balance || "0");
            rows.push({ token: "INJ", amount: injAmt.toFixed(4), usdValue: injAmt * injPrice });
            if (bd.usdt) rows.push({ token: "USDT", amount: parseFloat(bd.usdt).toFixed(2), usdValue: parseFloat(bd.usdt) });
            if (bd.usdc) rows.push({ token: "USDC", amount: parseFloat(bd.usdc).toFixed(2), usdValue: parseFloat(bd.usdc) });
          }
        }

        if (!cancelled) setWalletBal(rows);
      } catch {
        if (!cancelled) setWalletBal(null);
      } finally {
        if (!cancelled) setWalletBalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [network, currentUser]);

  // Gas (native token) balance — check on every network change
  useEffect(() => {
    if (!currentUser) { setGasBal(null); return; }
    let cancelled = false;
    setGasBal(null);
    setGasBalLoading(true);
    const evmAddress = currentUser.walletAddress;
    const email      = currentUser.email ?? "";
    (async () => {
      try {
        let amount = 0;
        const symbol = GAS_TOKEN[network];
        if (network === "base") {
          const r = await fetch("https://mainnet.base.org", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [evmAddress, "latest"], id: 1 }),
          });
          const d = await r.json();
          amount = parseInt(d.result, 16) / 1e18;
        } else if (network === "ethereum") {
          const r = await fetch("https://ethereum.publicnode.com", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [evmAddress, "latest"], id: 1 }),
          });
          const d = await r.json();
          amount = parseInt(d.result, 16) / 1e18;
        } else if (network === "solana") {
          const dr = await fetch("/api/solana/derive-address", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
          });
          const { address: solAddr } = await dr.json();
          const r = await fetch("https://api.mainnet-beta.solana.com", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "getBalance", params: [solAddr], id: 1 }),
          });
          const d = await r.json();
          amount = (d.result?.value ?? 0) / 1e9;
        } else if (network === "injective") {
          const dr = await fetch("/api/injective/derive-address", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
          });
          const { address: injAddr } = await dr.json();
          const r = await fetch(`/api/injective/balance/${injAddr}`);
          const d = await r.json();
          amount = parseFloat(d.balance || "0");
        }
        // Fetch native token price for USD display
        try {
          let price = 0;
          if (network === "base" || network === "ethereum") {
            const pr = await fetch("/api/prices/eth");
            const pd = await pr.json();
            price = pd.price ?? 0;
          } else if (network === "solana") {
            const pr = await fetch("/api/crypto/onchain-price/SOL");
            const pd = await pr.json();
            price = pd.price ?? pd.usd ?? 0;
          } else if (network === "injective") {
            const pr = await fetch("/api/crypto/onchain-price/INJ");
            const pd = await pr.json();
            price = pd.price ?? pd.usd ?? 0;
          }
          if (!cancelled && price > 0) setGasTokenPrice(price);
        } catch { /* price fetch optional */ }

        if (!cancelled) setGasBal({ amount, symbol, sufficient: amount >= GAS_THRESHOLDS[network] });
      } catch {
        if (!cancelled) setGasBal(null);
      } finally {
        if (!cancelled) setGasBalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [network, currentUser]);

  // Chain explorer base URLs
  const CHAIN_EXPLORER: Record<Network, string> = {
    base:      "https://basescan.org/address/",
    ethereum:  "https://etherscan.io/address/",
    solana:    "https://solscan.io/account/",
    injective: "https://explorer.injective.network/account/",
  };

  // Fetch Fluid ID once on login
  useEffect(() => {
    if (!currentUser?.email) { setFluidId(null); return; }
    let cancelled = false;
    const ctrl = new AbortController();
    fetch(`/api/fw-names/by-email/${encodeURIComponent(currentUser.email)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.fwCore) setFluidId(d.fwCore); })
      .catch(() => {});
    return () => { cancelled = true; ctrl.abort(); };
  }, [currentUser?.email]);

  // Fetch chain-specific address when from-network changes
  useEffect(() => {
    if (!currentUser) { setChainAddress(null); return; }
    if (network === "base" || network === "ethereum") {
      setChainAddress(currentUser.walletAddress);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setChainAddrLoading(true);
    const email = currentUser.email ?? "";
    const endpoint = network === "solana" ? "/api/solana/derive-address" : "/api/injective/derive-address";
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }), signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (!cancelled) setChainAddress(d.address ?? null); })
      .catch(() => { if (!cancelled) setChainAddress(null); })
      .finally(() => { if (!cancelled) setChainAddrLoading(false); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [network, currentUser]);

  // Fetch chain-specific address when to-network changes
  useEffect(() => {
    if (!currentUser) { setToChainAddress(null); return; }
    if (toNetwork === "base" || toNetwork === "ethereum") {
      setToChainAddress(currentUser.walletAddress);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setToChainAddrLoading(true);
    const email = currentUser.email ?? "";
    const endpoint = toNetwork === "solana" ? "/api/solana/derive-address" : "/api/injective/derive-address";
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }), signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (!cancelled) setToChainAddress(d.address ?? null); })
      .catch(() => { if (!cancelled) setToChainAddress(null); })
      .finally(() => { if (!cancelled) setToChainAddrLoading(false); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [toNetwork, currentUser]);

  // Fetch swap history — extracted so executeSwap can call it after a successful swap
  const fetchSwapHistory = useCallback(async () => {
    if (!currentUser?.email) { setSwapHist([]); return; }
    setHistLoading(true);
    try {
      const resp = await fetch("/api/swap/history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: currentUser.email, limit: 15 }),
      });
      const data = await resp.json();
      if (data.success) setSwapHist(data.history ?? []);
    } catch { setSwapHist([]); }
    finally { setHistLoading(false); }
  }, [currentUser?.email]);

  // Load history once on mount / when email changes — depend on email directly, not the callback
  useEffect(() => {
    if (!currentUser?.email) { setSwapHist([]); return; }
    fetchSwapHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.email]);

  const copyToClipboard = (text: string, field: "id" | "addr" | "toAddr") => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
  };

  // Auto-quote (debounced)
  const fetchQuote = useCallback(async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setRoutes([]); setBridgeQuote(null); setQuoteErr(null); setScanning(false); return; }
    setQuoting(true); setScanning(true); setQuoteErr(null);
    try {
      if (!isCrossChain) {
        const resp = await fetch(`/api/sor/wallet-quote?tokenIn=${fromSym}&tokenOut=${toSym}&amountIn=${amount}&network=${network}`);
        const data = await resp.json();
        if (data.error) { setQuoteErr(data.error); setRoutes([]); return; }
        const sorted = [...(data.routes ?? [])].sort((a: SorRoute, b: SorRoute) => b.amountOutRaw - a.amountOutRaw);
        setRoutes(sorted);
        setBridgeQuote(null);
        setSelRoute(0);
        onRouteFound?.(sorted, network);
      } else {
        setRoutes([]);
        const resp = await fetch("/api/swap/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromChain: network, toChain: toNetwork, fromToken: fromSym, toToken: toSym, amount }),
        });
        const data = await resp.json();
        if (!data.success || data.error) { setQuoteErr(data.error || "Bridge quote failed"); setBridgeQuote(null); return; }
        setBridgeQuote({
          toAmount:      data.quote.toAmount,
          provider:      data.quote.provider,
          estimatedTime: data.quote.estimatedTime,
          feeUsd:        data.quote.feeUsd,
          priceImpact:   data.quote.priceImpact,
          isRealBridge:  data.quote.isRealBridge,
        });
      }
    } catch (e: unknown) {
      setQuoteErr((e as Error)?.message ?? "Network error");
      setRoutes([]); setBridgeQuote(null);
    } finally {
      setQuoting(false); setScanning(false);
    }
  }, [amount, fromSym, toSym, network, toNetwork, isCrossChain, onRouteFound]);

  useEffect(() => {
    const n = parseFloat(amount);
    if (n && n > 0) setScanning(true); else setScanning(false);
  }, [amount, fromSym, toSym, network, toNetwork, isCrossChain]);

  const bestRoute = routes[selRoute];
  const canRoute  = !!amount && parseFloat(amount) > 0 && !quoting;
  const bridgeReady = !!bridgeQuote && canRoute;

  const EXPLORER_URL: Record<Network, string> = {
    base:      "https://basescan.org/tx/",
    ethereum:  "https://etherscan.io/tx/",
    solana:    "https://solscan.io/tx/",
    injective: "https://explorer.injective.network/transaction/",
  };

  const executeSwap = useCallback(async () => {
    const hasQuote = bestRoute || bridgeQuote;
    if (!hasQuote || !currentUser?.email) return;
    setExecModal("executing");
    setExecResult(null);
    try {
      const resp = await fetch("/api/swap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromChain:  network,
          toChain:    toNetwork,
          fromToken:  fromSym,
          toToken:    toSym,
          fromAmount: amount,
          toAmount:   bestRoute?.amountOut ?? bridgeQuote?.toAmount,
          userEmail:  currentUser.email,
          provider:   bestRoute?.venue ?? bridgeQuote?.provider ?? "FluidSOR",
          usdValue:   (() => {
            const n = parseFloat(amount || "0");
            if (!n) return null;
            // stablecoins ≈ $1; otherwise leave null so server can determine
            const stables = ["USDC","USDT","DAI","USDbC"];
            return stables.includes(fromSym) ? (n * 1).toFixed(2) : null;
          })(),
        }),
      });
      const data = await resp.json();
      if (data.success) {
        const txHash = data.txHash || data.totalTxHash;
        setExecResult({
          txHash,
          explorerUrl: data.isSimulated ? undefined : (data.explorerUrl || (txHash ? EXPLORER_URL[network] + txHash : undefined)),
          isSimulated: data.isSimulated,
          bridgeTrackingUrl: data.bridgeTrackingUrl,
        });
        setExecModal("success");
        fetchSwapHistory();          // refresh history — panel stays collapsed until user clicks
      } else {
        setExecResult({ error: data.error || "Swap failed" });
        setExecModal("fail");
      }
    } catch (e: unknown) {
      setExecResult({ error: (e as Error)?.message ?? "Network error" });
      setExecModal("fail");
    }
  }, [bestRoute, bridgeQuote, currentUser, network, toNetwork, fromSym, toSym, amount, fetchSwapHistory]);

  // Sync externally-provided amount (e.g. from the landing page hero input)
  useEffect(() => {
    if (initialAmount !== undefined && initialAmount !== amount) {
      setAmount(initialAmount);
      setRoutes([]);
      setBridgeQuote(null);
      setQuoteErr(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAmount]);

  // Debounce quote on the primitive values that actually determine a different quote,
  // not on the callback itself (avoids unnecessary re-triggers from callback identity changes)
  useEffect(() => {
    const t = setTimeout(fetchQuote, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromSym, toSym, network, toNetwork, isCrossChain]);

  // ── 5-column landing page render ─────────────────────────────────────────
  if (fiveColMode && previewMode) {
    const cardBase: React.CSSProperties = { ...S.card, flex: 1, minWidth: 0 };
    const chainSelectors = (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.58rem", color: "#f97316", textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", width: 26, flexShrink: 0 }}>From</span>
          <div style={{ display: "flex", gap: "0.35rem", flex: 1 }}>
            {NETWORKS.map(net => {
              const isSelected = network === net.id;
              return (
                <button key={net.id} onClick={() => handleNetworkChange(net.id)} title={net.label}
                  style={{
                    flex: 1, padding: "0.4rem 0.15rem", borderRadius: 10,
                    border: isSelected ? "1.5px solid #f9731688" : "1px solid #1f2937",
                    background: isSelected ? "linear-gradient(135deg, #f9731618 0%, #fb923c12 100%)" : "#f5f5f8",
                    cursor: "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "0.25rem",
                    boxShadow: isSelected ? "0 0 10px #f9731628, inset 0 0 8px #f9731610" : "none",
                    transition: "all 0.15s ease",
                  }}>
                  <img src={net.imgUrl} alt={net.label} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", opacity: isSelected ? 1 : 0.4 }} />
                  <span style={{ fontSize: "0.48rem", fontWeight: 800, letterSpacing: "0.05em", color: isSelected ? "#fb923c" : "#4b5563", fontFamily: "'IBM Plex Mono', monospace" }}>{net.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.58rem", color: "#2dd4bf", textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", width: 26, flexShrink: 0 }}>To</span>
          <div style={{ display: "flex", gap: "0.35rem", flex: 1 }}>
            {NETWORKS.map(net => {
              const isSelected = toNetwork === net.id;
              return (
                <button key={net.id} onClick={() => handleToNetworkChange(net.id)} title={net.label}
                  style={{
                    flex: 1, padding: "0.4rem 0.15rem", borderRadius: 10,
                    border: isSelected ? "1.5px solid #2dd4bf88" : "1px solid #1f2937",
                    background: isSelected ? "linear-gradient(135deg, #2dd4bf18 0%, #06b6d412 100%)" : "#f5f5f8",
                    cursor: "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "0.25rem",
                    boxShadow: isSelected ? "0 0 10px #2dd4bf28, inset 0 0 8px #2dd4bf10" : "none",
                    transition: "all 0.15s ease",
                  }}>
                  <img src={net.imgUrl} alt={net.label} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", opacity: isSelected ? 1 : 0.4 }} />
                  <span style={{ fontSize: "0.48rem", fontWeight: 800, letterSpacing: "0.05em", color: isSelected ? "#2dd4bf" : "#4b5563", fontFamily: "'IBM Plex Mono', monospace" }}>{net.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );

    return (
      <>
        <style>{WIDGET_CSS}</style>

        {/* Card 2: Welcome header + Inputs */}
        <div className="sor-card2" style={{ ...cardBase, border: "1px solid #22d3ee22", background: "linear-gradient(160deg, #030f0f 0%, #040d18 60%, #0a0a0a 100%)" }}>
          {/* Welcome header */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", display: "inline-block", flexShrink: 0, boxShadow: "0 0 5px #22d3ee99" }} />
            <span style={{ fontSize: "0.52rem", fontWeight: 700, color: "#22d3ee", letterSpacing: "0.16em", textTransform: "uppercase" as const }}>AMM Terminal Interface</span>
          </div>
          <h2 style={{ margin: "0 0 0.15rem", fontSize: "1.1rem", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            Welcome to the AMM Terminal Interface
          </h2>
          <div style={{ margin: "0 0 0.5rem" }}>
            <span style={{ fontWeight: 400, color: "#14b8a6", fontSize: "0.75rem" }}>(Your swap Interface)</span>
          </div>
          {chainSelectors}
          <div>
            <div style={{ fontSize: "0.68rem", color: "#4b5563", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>You pay</div>
            <div style={S.inputBox}>
              <input style={S.inputNum} type="number" min="0" placeholder="0.0" value={amount}
                onChange={e => { setAmount(e.target.value); setRoutes([]); setBridgeQuote(null); setQuoteErr(null); }} />
              <button style={S.tokenBtn(tokenIn.color)} onClick={() => setShowFrom(true)}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: tokenIn.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: 800 }}>{tokenIn.symbol[0]}</span>
                {fromSym} <span style={{ color: "#4b5563", fontSize: "0.7rem" }}>▾</span>
              </button>
            </div>
          </div>
          <button style={S.flipBtn} onClick={() => { setFromSym(toSym); setToSym(fromSym); setRoutes([]); setBridgeQuote(null); setAmount(""); }} title="Flip">⇅</button>
          <div>
            <div style={{ fontSize: "0.68rem", color: "#4b5563", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>You receive</div>
            <div style={S.inputBox}>
              <div style={{ ...S.inputNum, color: bestRoute ? "#4ade80" : "#374151", fontSize: "1.2rem" }}>
                {quoting ? <span className="fsw-shimmer" style={{ fontSize: "0.85rem" }}>Routing…</span> : bestRoute ? bestRoute.amountOut : <span style={{ color: "#1f2937" }}>—</span>}
              </div>
              <button style={S.tokenBtn(tokenOut.color)} onClick={() => setShowTo(true)}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: tokenOut.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: 800 }}>{tokenOut.symbol[0]}</span>
                {toSym} <span style={{ color: "#4b5563", fontSize: "0.7rem" }}>▾</span>
              </button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "#4b5563", flexWrap: "wrap" as const }}>
            <span>Slippage</span>
            {[0.1, 0.5, 1.0].map(s => (
              <button key={s} onClick={() => setSlippage(s)} style={{ padding: "0.15rem 0.4rem", borderRadius: 6, fontSize: "0.65rem", border: slippage === s ? "1px solid #22d3ee55" : "1px solid #1f1f1f", background: slippage === s ? "#22d3ee15" : "#111", color: slippage === s ? "#22d3ee" : "#4b5563", cursor: "pointer" }}>{s}%</button>
            ))}
          </div>
        </div>

        {/* Card 3: Routing Venues */}
        <div className="sor-card3" style={cardBase}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", borderBottom: "1px solid #141414", paddingBottom: "0.5rem", marginBottom: "0.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#e2e8f0" }}>Routing venues</span>
              <span style={{ fontWeight: 400, color: "#14b8a6", fontSize: "0.75rem" }}>(Smart Order Routing)</span>
            </div>
            {(scanning || quoting) && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", display: "inline-block", animation: "fsw-pulse-dot 1.2s ease-in-out infinite" }} />}
          </div>
          {amount && (scanning || quoting || routes.length > 0) ? (
            <RoutingAnimation fromSym={fromSym} toSym={toSym} scanning={scanning || quoting} routes={routes} />
          ) : (
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#374151", textAlign: "center", padding: "2rem 0" }}>Enter an amount to see live venue routing</p>
          )}
        </div>

        {/* Card 5: Venues with best prices */}
        <div className="sor-card4" style={cardBase}>
          <div style={{ borderBottom: "1px solid #141414", paddingBottom: "0.5rem", marginBottom: "0.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#e2e8f0" }}>Venues with best prices and Minimal slippage</span>
              <span style={{ fontWeight: 400, color: "#14b8a6", fontSize: "0.75rem" }}>(AMM Terminal Interface)</span>
            </div>
          </div>
          {routes.length > 0 && !quoting ? (
            <div className="fsw-route-scroll" style={{ display: "grid", gridTemplateRows: "repeat(3, auto)", gridAutoFlow: "column", gridAutoColumns: 130, gap: "0.35rem", overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none" } as React.CSSProperties}>
              {routes.map((r, i) => (
                <RouteCard key={i} route={r} toSym={toSym} selected={selRoute === i} onClick={() => setSelRoute(i)} rank={i} />
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#374151", textAlign: "center", padding: "2rem 0" }}>Best venue prices will appear here</p>
          )}
        </div>

        {/* Token selector modals */}
        {showFrom && <TokenSelect value={fromSym} exclude={toSym} tokens={networkTokens} onChange={(s: string) => { setFromSym(s); setShowFrom(false); setRoutes([]); setBridgeQuote(null); }} onClose={() => setShowFrom(false)} />}
        {showTo   && <TokenSelect value={toSym} exclude={fromSym} tokens={toNetworkTokens} onChange={(s: string) => { setToSym(s); setShowTo(false); setRoutes([]); setBridgeQuote(null); }} onClose={() => setShowTo(false)} />}
      </>
    );
  }
  // ── end 5-column render ────────────────────────────────────────────────────

  return (
    <>
      {/* Inject CSS once */}
      <style>{WIDGET_CSS}</style>

      <div style={S.card}>

        {/* ── Identity card — always visible ── */}
        <div style={{ background: "#f5f5f8", border: "1px solid #e2e2ea", borderRadius: 14, padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {/* Fluid ID */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: currentUser ? "#a78bfa" : "#374151", flexShrink: 0 }} />
              <span style={{ fontSize: "0.6rem", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.06em", flexShrink: 0 }}>Fluid ID</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#a78bfa", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser
                  ? (fluidId ?? <span style={{ color: "#374151", fontWeight: 400 }}>—</span>)
                  : <span style={{ color: "#4b5563", fontWeight: 400, fontSize: "0.72rem" }}>Set VITE_FLUID_PRIVATE_KEY in .env.local</span>
                }
              </span>
              {fluidId && (
                <button onClick={() => copyToClipboard(fluidId, "id")} title="Copy Fluid ID"
                  style={{ background: "none", border: "none", cursor: "pointer", color: copiedField === "id" ? "#4ade80" : "#4b5563", fontSize: "0.8rem", padding: "0.1rem 0.3rem", borderRadius: 4, flexShrink: 0 }}>
                  {copiedField === "id" ? "✓" : "⎘"}
                </button>
              )}
            </div>
            {/* From-chain address */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <img src={networkMeta.imgUrl} alt={networkMeta.label} style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover", marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: "0.6rem", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.06em", flexShrink: 0, marginTop: 1 }}>From</span>
              {chainAddrLoading
                ? <span style={{ fontSize: "0.72rem", color: "#374151" }}>…</span>
                : chainAddress
                  ? <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#9ca3af", wordBreak: "break-all" as const, flex: 1 }}>{chainAddress}</span>
                  : <span style={{ fontSize: "0.72rem", color: "#374151" }}>—</span>
              }
              <div style={{ display: "flex", gap: "0.15rem", flexShrink: 0 }}>
                {chainAddress && (
                  <button onClick={() => copyToClipboard(chainAddress, "addr")} title="Copy address"
                    style={{ background: "none", border: "none", cursor: "pointer", color: copiedField === "addr" ? "#4ade80" : "#4b5563", fontSize: "0.8rem", padding: "0.1rem 0.3rem", borderRadius: 4 }}>
                    {copiedField === "addr" ? "✓" : "⎘"}
                  </button>
                )}
                {chainAddress && (
                  <a href={CHAIN_EXPLORER[network] + chainAddress} target="_blank" rel="noreferrer"
                    title={`View on ${networkMeta.label} explorer`}
                    style={{ color: "#22d3ee", fontSize: "0.8rem", padding: "0.1rem 0.3rem", textDecoration: "none", lineHeight: 1 }}>↗</a>
                )}
              </div>
            </div>
            {/* To-chain address — always visible */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <img src={toNetworkMeta.imgUrl} alt={toNetworkMeta.label} style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover", marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: "0.6rem", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.06em", flexShrink: 0, marginTop: 1 }}>To</span>
              {toChainAddrLoading
                ? <span style={{ fontSize: "0.72rem", color: "#374151" }}>…</span>
                : toChainAddress
                  ? <span style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "#9ca3af", wordBreak: "break-all" as const, flex: 1 }}>{toChainAddress}</span>
                  : <span style={{ fontSize: "0.72rem", color: "#374151" }}>—</span>
              }
              <div style={{ display: "flex", gap: "0.15rem", flexShrink: 0 }}>
                {toChainAddress && (
                  <button onClick={() => copyToClipboard(toChainAddress, "toAddr")} title="Copy to-chain address"
                    style={{ background: "none", border: "none", cursor: "pointer", color: copiedField === "toAddr" ? "#4ade80" : "#4b5563", fontSize: "0.8rem", padding: "0.1rem 0.3rem", borderRadius: 4 }}>
                    {copiedField === "toAddr" ? "✓" : "⎘"}
                  </button>
                )}
                {toChainAddress && (
                  <a href={CHAIN_EXPLORER[toNetwork] + toChainAddress} target="_blank" rel="noreferrer"
                    title={`View on ${toNetworkMeta.label} explorer`}
                    style={{ color: "#22d3ee", fontSize: "0.8rem", padding: "0.1rem 0.3rem", textDecoration: "none", lineHeight: 1 }}>↗</a>
                )}
              </div>
            </div>
          </div>

        {/* Chain selectors — FROM and TO */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {/* FROM row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.58rem", color: "#4b5563", textTransform: "uppercase" as const, letterSpacing: "0.07em", width: 26, flexShrink: 0 }}>From</span>
            <div style={{ display: "flex", gap: "0.3rem", flex: 1 }}>
              {NETWORKS.map(net => (
                <button key={net.id} onClick={() => handleNetworkChange(net.id)} title={net.label}
                  style={{ flex: 1, padding: "0.35rem 0.15rem 0.4rem", borderRadius: 10, border: network === net.id ? `1.5px solid ${net.color}88` : "1px solid #e2e2ea", background: network === net.id ? net.color + "15" : "#f5f5f8", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}>
                  <img src={net.imgUrl} alt={net.label} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", opacity: network === net.id ? 1 : 0.55, transition: "opacity 0.15s" }} />
                  <span style={{ fontSize: "0.58rem", fontWeight: 700, color: network === net.id ? net.color : "#6b7280", letterSpacing: "0.02em" }}>{net.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* TO row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.58rem", color: "#4b5563", textTransform: "uppercase" as const, letterSpacing: "0.07em", width: 26, flexShrink: 0 }}>To</span>
            <div style={{ display: "flex", gap: "0.3rem", flex: 1 }}>
              {NETWORKS.map(net => (
                <button key={net.id} onClick={() => handleToNetworkChange(net.id)} title={net.label}
                  style={{ flex: 1, padding: "0.35rem 0.15rem 0.4rem", borderRadius: 10, border: toNetwork === net.id ? `1.5px solid ${net.color}88` : "1px solid #e2e2ea", background: toNetwork === net.id ? net.color + "15" : "#f5f5f8", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}>
                  <img src={net.imgUrl} alt={net.label} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", opacity: toNetwork === net.id ? 1 : 0.55, transition: "opacity 0.15s" }} />
                  <span style={{ fontSize: "0.58rem", fontWeight: 700, color: toNetwork === net.id ? net.color : "#6b7280", letterSpacing: "0.02em" }}>{net.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Cross-chain indicator */}
          {isCrossChain && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontSize: "0.68rem", color: "#6b7280", background: "#0a0f14", border: "1px solid #1a2a35", borderRadius: 8, padding: "0.3rem 0.75rem" }}>
              <img src={networkMeta.imgUrl} alt={networkMeta.label} style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover" }} />
              <span style={{ color: networkMeta.color, fontWeight: 600 }}>{networkMeta.label}</span>
              <span>→</span>
              <img src={toNetworkMeta.imgUrl} alt={toNetworkMeta.label} style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover" }} />
              <span style={{ color: toNetworkMeta.color, fontWeight: 600 }}>{toNetworkMeta.label}</span>
              <span style={{ marginLeft: "auto", color: "#374151" }}>Cross-chain bridge</span>
            </div>
          )}
        </div>

        {/* Wallet balance card — always visible */}
        <div style={{ background: "#f5f5f8", border: `1px solid #e2e2ea`, borderRadius: 12, padding: "0.65rem 1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {!currentUser && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", paddingBottom: "0.35rem" }}>
              <img src={networkMeta.imgUrl} alt={networkMeta.label} style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover" }} />
              <span style={{ fontSize: "0.65rem", color: networkMeta.color, fontWeight: 700 }}>{networkMeta.label}</span>
              <span style={{ fontSize: "0.6rem", color: "#4b5563" }}>· Wallet Balance</span>
              <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#374151" }}>Set .env.local to load balance</span>
            </div>
          )}
          {!currentUser && ["ETH","USDC","USDT"].map(tok => {
            const tokenColor = TOKENS_BY_NETWORK[network]?.[tok]?.color ?? "#6b7280";
            return (
              <div key={tok} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.2rem 0.1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: tokenColor + "22", border: `1px solid ${tokenColor}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.55rem", fontWeight: 800, color: tokenColor }}>{tok.slice(0, 2)}</span>
                  </div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4b5563" }}>{tok}</span>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#4b5563", fontFamily: "monospace" }}>0.00</span>
              </div>
            );
          })}
          {currentUser && <>

            {/* Header: network name + total USD */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <img src={networkMeta.imgUrl} alt={networkMeta.label} style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover" }} />
                <span style={{ fontSize: "0.65rem", color: networkMeta.color, fontWeight: 700, letterSpacing: "0.04em" }}>{networkMeta.label}</span>
                <span style={{ fontSize: "0.6rem", color: "#4b5563" }}>· Wallet Balance</span>
              </div>
              {walletBalLoading
                ? <span className="fsw-shimmer" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Loading…</span>
                : walletBal
                  ? <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#e5e7eb" }}>
                      ${walletBal.reduce((s, t) => s + t.usdValue, 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span style={{ fontSize: "0.58rem", color: "#4b5563", fontWeight: 400, marginLeft: "0.3rem" }}>total</span>
                    </span>
                  : <span style={{ fontSize: "0.72rem", color: "#374151" }}>—</span>
              }
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "#e2e2ea", margin: "0 -0.25rem" }} />

            {/* Token rows */}
            {walletBalLoading && (
              <div style={{ display: "flex", gap: "0.5rem", paddingTop: "0.1rem" }}>
                {["ETH","USDC","USDT"].slice(0, 3).map(t => (
                  <div key={t} className="fsw-shimmer" style={{ height: 28, flex: 1, borderRadius: 6, background: "#1a1a1a" }} />
                ))}
              </div>
            )}
            {!walletBalLoading && walletBal && walletBal.map(tb => {
              const tokenColor = TOKENS_BY_NETWORK[network]?.[tb.token]?.color ?? "#6b7280";
              const hasValue   = tb.usdValue > 0.001;
              return (
                <div key={tb.token} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.2rem 0.1rem" }}>
                  {/* Token tag */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: tokenColor + "22", border: `1px solid ${tokenColor}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.55rem", fontWeight: 800, color: tokenColor }}>{tb.token.slice(0, 2)}</span>
                    </div>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: hasValue ? "#e5e7eb" : "#4b5563" }}>{tb.token}</span>
                  </div>
                  {/* Amount + USD */}
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: hasValue ? "#e5e7eb" : "#4b5563", fontFamily: "monospace" }}>{tb.amount}</span>
                    {tb.usdValue > 0 && (
                      <span style={{ fontSize: "0.62rem", color: "#6b7280", marginLeft: "0.35rem" }}>
                        ${tb.usdValue < 0.01 ? tb.usdValue.toFixed(4) : tb.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {!walletBalLoading && walletBal && walletBal.length === 0 && (
              <span style={{ fontSize: "0.68rem", color: "#374151", textAlign: "center", padding: "0.25rem 0" }}>No tokens found on {networkMeta.label}</span>
            )}

            {/* Divider before gas section */}
            <div style={{ height: 1, background: "#1a1a1a", margin: "0.1rem -0.25rem" }} />

            {/* Gas status row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: gasBal?.sufficient === false ? "#ef4444" : gasBal?.sufficient ? "#22c55e" : "#4b5563", flexShrink: 0 }} />
                <span style={{ fontSize: "0.6rem", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                  {GAS_TOKEN[network]} Gas
                </span>
              </div>
              {gasBalLoading
                ? <span className="fsw-shimmer" style={{ fontSize: "0.68rem" }}>Loading…</span>
                : gasBal
                  ? <span style={{ fontSize: "0.7rem", fontWeight: 600, color: gasBal.sufficient ? "#6b7280" : "#ef4444", fontFamily: "monospace" }}>
                      {gasBal.amount < 0.000001 ? "0.000000" : gasBal.amount.toFixed(6)} {gasBal.symbol}
                      {gasTokenPrice > 0 && (
                        <span style={{ fontFamily: "inherit", fontSize: "0.6rem", fontWeight: 400, color: gasBal.sufficient ? "#4b5563" : "#ef444488" }}>
                          {" "}(${(gasBal.amount * gasTokenPrice).toFixed(4)})
                        </span>
                      )}
                    </span>
                  : <span style={{ fontSize: "0.68rem", color: "#374151" }}>—</span>
              }
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.6rem", color: "#374151", paddingLeft: "0.9rem" }}>Min required</span>
              <span style={{ fontSize: "0.65rem", color: "#374151" }}>
                {GAS_THRESHOLDS[network]} {GAS_TOKEN[network]}
                {gasTokenPrice > 0 && <span style={{ color: "#2d2d2d" }}> (${(GAS_THRESHOLDS[network] * gasTokenPrice).toFixed(4)})</span>}
              </span>
            </div>

            {/* Low gas warning */}
            {gasBal && !gasBal.sufficient && (
              <div style={{ background: "#ef444415", border: "1px solid #ef444444", borderRadius: 8, padding: "0.5rem 0.7rem", display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.8rem", flexShrink: 0 }}>⚠️</span>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#fca5a5" }}>Insufficient {gasBal.symbol} for gas</span>
                </div>
                {chainAddress && (
                  <div style={{ fontSize: "0.59rem", color: "#6b7280", borderTop: "1px solid #ef444430", paddingTop: "0.25rem" }}>
                    Fund {gasBal.symbol} to:{" "}
                    <span style={{ fontFamily: "monospace", color: "#9ca3af" }}>{chainAddress.slice(0, 10)}…{chainAddress.slice(-6)}</span>
                  </div>
                )}
              </div>
            )}
          </>}
        </div>

        {/* Two-column layout in preview mode, single column otherwise */}
        <div style={previewMode ? { display: "flex", gap: "1rem", alignItems: "flex-start" } : { display: "contents" }}>

          {/* Left col: You pay / flip / You receive / Slippage */}
          <div style={previewMode ? { display: "flex", flexDirection: "column", gap: "1rem", flex: "0 0 220px", minWidth: 0 } : { display: "contents" }}>

        {/* You pay */}
        <div>
          <div style={{ fontSize: "0.68rem", color: "#4b5563", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>You pay</div>
          <div style={S.inputBox}>
            <input style={S.inputNum} type="number" min="0" placeholder="0.0" value={amount}
              onChange={e => { setAmount(e.target.value); setRoutes([]); setBridgeQuote(null); setQuoteErr(null); }} />
            <button style={S.tokenBtn(tokenIn.color)} onClick={() => setShowFrom(true)}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: tokenIn.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>{tokenIn.symbol[0]}</span>
              {fromSym} <span style={{ color: "#4b5563", fontSize: "0.75rem" }}>▾</span>
            </button>
          </div>
        </div>

        {/* Flip */}
        <button style={S.flipBtn} onClick={() => {
          if (isCrossChain) {
            const pn = network; const ptn = toNetwork;
            const pfs = fromSym; const pts = toSym;
            setNetwork(ptn); setToNetwork(pn);
            if (TOKENS_BY_NETWORK[ptn][pts]) setFromSym(pts);
            if (TOKENS_BY_NETWORK[pn][pfs]) setToSym(pfs);
          } else {
            setFromSym(toSym); setToSym(fromSym);
          }
          setRoutes([]); setBridgeQuote(null); setAmount("");
        }} title="Flip">⇅</button>

        {/* You receive */}
        <div>
          <div style={{ fontSize: "0.68rem", color: "#4b5563", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>You receive</div>
          <div style={S.inputBox}>
            <div style={{ ...S.inputNum, color: bestRoute ? "#4ade80" : "#374151", fontSize: "1.2rem" }}>
              {quoting
                ? <span className="fsw-shimmer" style={{ fontSize: "0.85rem" }}>Routing…</span>
                : bestRoute ? bestRoute.amountOut : <span style={{ color: "#1f2937" }}>—</span>
              }
            </div>
            <button style={S.tokenBtn(tokenOut.color)} onClick={() => setShowTo(true)}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: tokenOut.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>{tokenOut.symbol[0]}</span>
              {toSym} <span style={{ color: "#4b5563", fontSize: "0.75rem" }}>▾</span>
            </button>
          </div>
        </div>

        {/* Slippage */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", color: "#4b5563" }}>
          <span>Slippage</span>
          {[0.1, 0.5, 1.0].map(s => (
            <button key={s} onClick={() => setSlippage(s)} style={{ padding: "0.2rem 0.5rem", borderRadius: 6, fontSize: "0.7rem", border: slippage === s ? "1px solid #22d3ee55" : "1px solid #1f1f1f", background: slippage === s ? "#22d3ee15" : "#111", color: slippage === s ? "#22d3ee" : "#4b5563", cursor: "pointer" }}>{s}%</button>
          ))}
          <span style={{ marginLeft: "auto", color: "#374151", fontSize: "0.68rem" }}>{isCrossChain ? `${networkMeta.label} → ${toNetworkMeta.label}` : NETWORK_ROUTER_LABEL[network]}</span>
        </div>

          </div>{/* end left col */}

          {/* Right col in preview mode: AMM Terminal Interface card */}
          <div style={previewMode ? { flex: 1, minWidth: 0 } : { display: "contents" }}>

        {/* AMM Terminal Interface card — header always visible */}
        <div style={{ border: "1px solid #22d3ee22", borderRadius: 16, background: "#080808", overflow: "hidden" }}>
          {/* Header — always shown */}
          <div style={{ padding: "1.4rem 1rem 1.1rem", borderBottom: (scanning || quoting || routes.length > 0 || bridgeQuote) && amount ? "1px solid #0f1a1a" : "none", background: "linear-gradient(135deg, #030f0f 0%, #040d18 100%)", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem", marginBottom: "0.55rem" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d3ee", display: "inline-block", flexShrink: 0, boxShadow: "0 0 6px #22d3ee99" }} />
              <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#22d3ee", letterSpacing: "0.18em", textTransform: "uppercase" }}>AMM Terminal Interface</span>
            </div>
            <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.55rem", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
              Welcome to the AMM Terminal Interface
            </h2>
            <p style={{ margin: "0 0 0.25rem", fontSize: "0.88rem", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.01em" }}>
              AMM (Automated Market Maker)
            </p>
            <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 400, color: "#475569", letterSpacing: "0.01em" }}>
              Real-time multi-venue routing · best price auto-selected across all DEXs
            </p>
          </div>

          {/* Inner panels — only when amount entered and scanning/routes active */}
          {(scanning || quoting || routes.length > 0 || bridgeQuote) && amount && (
            <div style={{ padding: "0.75rem 1rem" }}>
              {/* Routing Venues sub-card */}
              <div style={{ border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.5rem 0.85rem 0.45rem", borderBottom: "1px solid #141414", background: "#0a0a0a", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.01em" }}>Routing Venues</span>
                </div>
                <div style={{ padding: "0.65rem 0.85rem" }}>
                  <RoutingAnimation fromSym={fromSym} toSym={toSym} scanning={scanning || quoting} routes={routes} />
                </div>
              </div>

              {/* Bridge quote card */}
              {!quoting && bridgeQuote && (
                <div style={{ marginTop: "0.6rem", background: "#0a1520", border: `1px solid ${toNetworkMeta.color}44`, borderRadius: 12, padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.45rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.85rem" }}>🌉</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#e5e7eb" }}>{bridgeQuote.provider}</span>
                      {bridgeQuote.isRealBridge && <span style={S.badge("#4ade80")}>Live</span>}
                    </div>
                    <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#4ade80" }}>{bridgeQuote.toAmount} <span style={{ fontSize: "0.72rem", color: toNetworkMeta.color, fontWeight: 600 }}>{toSym}</span></span>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.7rem", color: "#6b7280" }}>
                    <span>⏱ {bridgeQuote.estimatedTime}</span>
                    <span>Fee ${bridgeQuote.feeUsd}</span>
                    <span>Impact {bridgeQuote.priceImpact}</span>
                  </div>
                </div>
              )}

              {/* Route cards */}
              {!quoting && routes.length > 0 && (
                <div style={{ border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "0.5rem 0.85rem 0.45rem", borderBottom: "1px solid #141414", background: "#0a0a0a" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.01em" }}>Venues with best prices and Minimal slippage</span>
                  </div>
                  <div style={{ padding: "0.65rem 0.85rem" }}>
                    <div className="fsw-route-scroll" style={{ display: "grid", gridTemplateRows: "repeat(3, auto)", gridAutoFlow: "column", gridAutoColumns: 140, gap: "0.4rem", overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
                      {routes.map((r, i) => (
                        <RouteCard key={i} route={r} toSym={toSym} selected={selRoute === i} onClick={() => setSelRoute(i)} rank={i} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

          </div>{/* end right col */}
        </div>{/* end two-column wrapper */}

        {/* Error */}
        {quoteErr && amount && <div style={{ background: "#f8717108", border: "1px solid #f8717133", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.78rem", color: "#f87171" }}>{quoteErr}</div>}

        {/* Main action button */}
        {bestRoute && !quoting ? (
          <button style={S.btn("#0e7490")} onClick={() => previewMode ? navigate("/auth") : (setSwipeX(0), setExecModal("confirm"))}>
            {previewMode ? `Create Fluid Wallet to Swap via ${bestRoute.venue}` : `Swap via ${bestRoute.venue} — get ${bestRoute.amountOut} ${toSym}`}
          </button>
        ) : bridgeReady ? (
          <button style={S.btn(toNetworkMeta.color)} onClick={() => previewMode ? navigate("/auth") : (setSwipeX(0), setExecModal("confirm"))}>
            {previewMode ? `Create Fluid Wallet to Bridge via ${bridgeQuote!.provider}` : `Bridge via ${bridgeQuote!.provider} → get ${bridgeQuote!.toAmount} ${toSym} on ${toNetworkMeta.label}`}
          </button>
        ) : (
          <button style={S.btn(canRoute ? "#0e7490" : "#1a1a1a", !canRoute)} onClick={fetchQuote} disabled={!canRoute}>
            {quoting
              ? (isCrossChain ? "Getting bridge quote…" : "Searching all venues…")
              : !amount
                ? "Enter an amount to route"
                : isCrossChain
                  ? `Bridge ${networkMeta.label} → ${toNetworkMeta.label}`
                  : `Find best price via ${NETWORK_ROUTER_LABEL[network]}`}
          </button>
        )}

        {/* Best route summary */}
        {bestRoute && routes.length > 0 && (
          <div style={{ background: "#22d3ee08", border: "1px solid #22d3ee22", borderRadius: 10, padding: "0.6rem 0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
            <div><span style={{ color: "#22d3ee", fontWeight: 600 }}>{bestRoute.venue}</span><span style={{ color: "#4b5563" }}> · best price</span></div>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{bestRoute.amountOut} {toSym}</span>
          </div>
        )}
        {bridgeQuote && isCrossChain && (
          <div style={{ background: `${toNetworkMeta.color}08`, border: `1px solid ${toNetworkMeta.color}22`, borderRadius: 10, padding: "0.6rem 0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
            <div><span style={{ color: toNetworkMeta.color, fontWeight: 600 }}>{bridgeQuote.provider}</span><span style={{ color: "#4b5563" }}> · {networkMeta.label} → {toNetworkMeta.label}</span></div>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{bridgeQuote.toAmount} {toSym}</span>
          </div>
        )}

        {/* ── Transaction History ── */}
        {currentUser && (
          <div>
            {/* Header toggle */}
            <button onClick={() => setShowHistory(h => !h)}
              style={{ width: "100%", background: "none", border: "none", borderTop: "1px solid #111", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0 0.25rem", color: "#6b7280" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af" }}>Swap History</span>
                {swapHist.length > 0 && (
                  <span style={{ background: "#22d3ee18", border: "1px solid #22d3ee33", color: "#22d3ee", borderRadius: 10, padding: "0.06rem 0.45rem", fontSize: "0.58rem", fontWeight: 700 }}>
                    {swapHist.length}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.62rem", color: "#374151" }}>{showHistory ? "▲ hide" : "▼ show"}</span>
            </button>

            {showHistory && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.3rem" }}>
                {histLoading ? (
                  <div style={{ padding: "0.9rem", textAlign: "center", fontSize: "0.75rem", color: "#374151" }}>Loading…</div>
                ) : swapHist.length === 0 ? (
                  <div style={{ padding: "0.9rem", textAlign: "center", fontSize: "0.75rem", color: "#374151" }}>No swaps yet</div>
                ) : swapHist.map((tx: any, i: number) => {
                  const fromNet    = NETWORKS.find(n => n.id === tx.fromChain) ?? NETWORKS[0];
                  const toNet      = NETWORKS.find(n => n.id === tx.toChain)   ?? NETWORKS[0];
                  const explorer   = tx.explorerUrl || tx.bridgeExplorerUrl;
                  const txHash     = tx.txHash || tx.bridgeTxHash;
                  const isCross    = tx.fromChain !== tx.toChain;
                  const statusColor = tx.status === "completed" ? "#4ade80" : tx.status === "bridging" ? "#f59e0b" : tx.status === "pending" ? "#facc15" : "#f87171";
                  const when = tx.createdAt
                    ? new Date(tx.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "";
                  const fromAmt = parseFloat(tx.fromAmount ?? "0");
                  const toAmt   = parseFloat(tx.toAmount   ?? "0");
                  return (
                    <div key={tx.id ?? i} style={{ background: "#0a0d12", border: "1px solid #1a1f28", borderRadius: 12, padding: "0.65rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>

                      {/* Row 1: swap summary + status */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {/* From side */}
                          <img src={fromNet.imgUrl} alt={fromNet.label} style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#e5e7eb" }}>
                            {fromAmt < 0.001 ? fromAmt.toFixed(6) : fromAmt.toFixed(2)}
                          </span>
                          <span style={{ fontSize: "0.68rem", color: fromNet.color, fontWeight: 600 }}>{tx.fromToken}</span>
                          <span style={{ fontSize: "0.65rem", color: "#374151" }}>on</span>
                          <span style={{ fontSize: "0.65rem", color: fromNet.color, fontWeight: 600 }}>{fromNet.label}</span>
                          <span style={{ fontSize: "0.75rem", color: "#4b5563" }}>→</span>
                          {/* To side */}
                          <img src={toNet.imgUrl} alt={toNet.label} style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4ade80" }}>
                            {toAmt < 0.001 ? toAmt.toFixed(6) : toAmt.toFixed(2)}
                          </span>
                          <span style={{ fontSize: "0.68rem", color: toNet.color, fontWeight: 600 }}>{tx.toToken}</span>
                          <span style={{ fontSize: "0.65rem", color: "#374151" }}>on</span>
                          <span style={{ fontSize: "0.65rem", color: toNet.color, fontWeight: 600 }}>{toNet.label}</span>
                        </div>
                        <span style={{ ...S.badge(statusColor), fontSize: "0.54rem", flexShrink: 0 }}>{tx.status}</span>
                      </div>

                      {/* Row 2: meta info */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" as const }}>
                        {/* USD value */}
                        {tx.usdValue && parseFloat(tx.usdValue) > 0 && (
                          <span style={{ fontSize: "0.62rem", color: "#6b7280" }}>
                            💵 <span style={{ color: "#9ca3af" }}>${parseFloat(tx.usdValue).toFixed(2)}</span>
                          </span>
                        )}
                        {/* Provider / venue */}
                        {tx.provider && (
                          <span style={{ fontSize: "0.62rem", color: "#6b7280" }}>
                            via <span style={{ color: "#a78bfa" }}>{tx.provider}</span>
                          </span>
                        )}
                        {/* Cross-chain badge */}
                        {isCross && (
                          <span style={S.badge("#22d3ee")}>Cross-chain</span>
                        )}
                        {/* Date */}
                        <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "#374151", flexShrink: 0 }}>{when}</span>
                      </div>

                      {/* Row 3: tx hash + explorer */}
                      {txHash && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#0d1117", border: "1px solid #1a1f28", borderRadius: 6, padding: "0.25rem 0.5rem" }}>
                          <span style={{ fontSize: "0.58rem", color: "#4b5563" }}>Tx</span>
                          <span style={{ fontSize: "0.6rem", fontFamily: "monospace", color: "#6b7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {txHash.slice(0, 16)}…{txHash.slice(-8)}
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText(txHash)}
                            title="Copy tx hash"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", fontSize: "0.7rem", padding: "0 0.15rem", flexShrink: 0 }}>⎘</button>
                          {explorer && (
                            <a href={explorer} target="_blank" rel="noreferrer"
                              style={{ color: "#22d3ee", textDecoration: "none", fontSize: "0.72rem", flexShrink: 0 }} title="View on explorer">↗</a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a href="https://fluidnative.com" target="_blank" rel="noreferrer" style={{ fontSize: "0.68rem", color: "#22d3ee", textDecoration: "none" }}>Powered by Fluid ↗</a>
          {bestRoute && <span style={{ fontSize: "0.65rem", color: "#374151" }}>{fromSym} → {toSym} · best: {bestRoute.venue}</span>}
        </div>
      </div>

      {/* Token modals */}
      {showFrom && <TokenSelect value={fromSym} exclude="" tokens={networkTokens} onChange={t => {
        setFromSym(t);
        // If same token chosen on both sides, flip the other side
        if (t === toSym) {
          const keys = Object.keys(networkTokens);
          const next = keys.find(k => k !== t) ?? keys[0];
          setToSym(next);
        }
        setRoutes([]); setBridgeQuote(null);
      }} onClose={() => setShowFrom(false)} />}
      {showTo && <TokenSelect value={toSym} exclude="" tokens={toNetworkTokens} onChange={t => {
        setToSym(t);
        // If same token chosen on both sides, flip the other side
        if (!isCrossChain && t === fromSym) {
          const keys = Object.keys(networkTokens);
          const next = keys.find(k => k !== t) ?? keys[0];
          setFromSym(next);
        }
        setRoutes([]); setBridgeQuote(null);
      }} onClose={() => setShowTo(false)} />}

      {/* Execution modal */}
      {execModal && (
        <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 20, padding: "1.75rem 1.5rem", width: "min(94vw, 400px)", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            {/* ── Confirm ── */}
            {execModal === "confirm" && (bestRoute || bridgeQuote) && (
              <>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>Confirm Swap</div>

                <div style={{ background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 12, padding: "0.85rem 1rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#6b7280" }}>You pay</span>
                    <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{amount} <span style={{ color: tokenIn.color }}>{fromSym}</span></span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#6b7280" }}>You receive (est.)</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>{isCrossChain ? bridgeQuote?.toAmount : bestRoute?.amountOut} <span style={{ color: tokenOut.color }}>{toSym}</span></span>
                  </div>
                  <div style={{ borderTop: "1px solid #1f1f1f", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span style={{ color: "#6b7280" }}>{isCrossChain ? "Bridge" : "Best venue"}</span>
                    <span style={{ color: "#22d3ee", fontWeight: 600 }}>{isCrossChain ? bridgeQuote?.provider : bestRoute?.venue}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span style={{ color: "#6b7280" }}>Network</span>
                    <span style={{ color: networkMeta.color, fontWeight: 600 }}>
                      {networkMeta.label}{isCrossChain ? " → " : ""}
                      {isCrossChain && <span style={{ color: toNetworkMeta.color }}>{toNetworkMeta.label}</span>}
                    </span>
                  </div>
                  {isCrossChain && bridgeQuote && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <span style={{ color: "#6b7280" }}>Est. time</span>
                      <span style={{ color: "#9ca3af" }}>{bridgeQuote.estimatedTime}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span style={{ color: "#6b7280" }}>Gas estimate</span>
                    <span style={{ color: "#9ca3af" }}>{bestRoute?.gasEstimate}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span style={{ color: "#6b7280" }}>Slippage</span>
                    <span style={{ color: "#9ca3af" }}>{slippage}%</span>
                  </div>
                </div>

                <div style={{ background: "#f59e0b0d", border: "1px solid #f59e0b33", borderRadius: 10, padding: "0.6rem 0.85rem", fontSize: "0.72rem", color: "#f59e0b" }}>
                  This executes a real on-chain swap. Output is estimated and may vary due to slippage.
                </div>

                {/* Swipe to confirm */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div
                    ref={swipeTrackRef}
                    style={{ position: "relative", height: 52, borderRadius: 26, background: "#0a1a1f", border: "1px solid #0e7490", overflow: "hidden", cursor: "grab", userSelect: "none" }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      swipeDragRef.current = { active: true, startClient: e.clientX, startX: swipeX };
                    }}
                    onPointerMove={(e) => {
                      if (!swipeDragRef.current.active) return;
                      const trackW = swipeTrackRef.current?.offsetWidth ?? 300;
                      const thumbW = 44;
                      const maxX = trackW - thumbW - 8;
                      const newX = Math.max(0, Math.min(e.clientX - swipeDragRef.current.startClient + swipeDragRef.current.startX, maxX));
                      setSwipeX(newX);
                      if (newX >= maxX * 0.85) {
                        swipeDragRef.current.active = false;
                        setSwipeX(maxX);
                        executeSwap();
                      }
                    }}
                    onPointerUp={() => {
                      if (swipeDragRef.current.active) {
                        swipeDragRef.current.active = false;
                        setSwipeX(0);
                      }
                    }}
                    onPointerCancel={() => { swipeDragRef.current.active = false; setSwipeX(0); }}
                  >
                    {/* Fill */}
                    <div style={{ position: "absolute", inset: 0, width: `${swipeX + 44}px`, background: "linear-gradient(90deg, #0e7490, #06b6d440)", borderRadius: 26, transition: swipeDragRef.current.active ? "none" : "width 0.3s ease" }} />
                    {/* Label */}
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: "#22d3ee", opacity: Math.max(0, 1 - swipeX / 80), pointerEvents: "none", letterSpacing: "0.05em" }}>
                      Swipe to confirm →
                    </div>
                    {/* Thumb */}
                    <div style={{ position: "absolute", top: 4, left: swipeX + 4, width: 44, height: 44, borderRadius: "50%", background: "#0e7490", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px #22d3ee55", transition: swipeDragRef.current.active ? "none" : "left 0.3s ease", pointerEvents: "none" }}>
                      <span style={{ color: "#fff", fontSize: "1.1rem" }}>›</span>
                    </div>
                  </div>
                  <button onClick={() => { setSwipeX(0); setExecModal(null); }} style={{ padding: "0.5rem", borderRadius: 10, border: "1px solid #2a2a2a", background: "transparent", color: "#6b7280", fontWeight: 600, cursor: "pointer", fontSize: "0.8rem" }}>Cancel</button>
                </div>
              </>
            )}

            {/* ── Executing ── */}
            {execModal === "executing" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "0.5rem 0" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid #0e7490", borderTopColor: "transparent", animation: "fsw-spin 0.8s linear infinite" }} />
                <style>{`@keyframes fsw-spin{to{transform:rotate(360deg)}}`}</style>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>Executing swap…</div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280", textAlign: "center" }}>Broadcasting to {networkMeta.label} via {bestRoute?.venue}</div>
              </div>
            )}

            {/* ── Success ── */}
            {execModal === "success" && execResult && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#4ade8020", border: "1px solid #4ade8055", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>✓</div>
                  <div style={{ fontWeight: 700, color: "#4ade80", fontSize: "0.95rem" }}>Swap confirmed!</div>
                </div>

                <div style={{ background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 12, padding: "0.85rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#6b7280" }}>Paid</span>
                    <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{amount} {fromSym}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#6b7280" }}>Received (est.)</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>{bestRoute?.amountOut} {toSym}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#6b7280" }}>Venue</span>
                    <span style={{ color: "#22d3ee", fontWeight: 600 }}>{bestRoute?.venue}</span>
                  </div>
                  {execResult.isSimulated && execResult.bridgeTrackingUrl && (
                    <div style={{ borderTop: "1px solid #1f1f1f", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", alignItems: "center" }}>
                      <span style={{ color: "#6b7280" }}>Bridge</span>
                      <a href={execResult.bridgeTrackingUrl} target="_blank" rel="noreferrer" style={{ color: "#22d3ee", textDecoration: "none", fontSize: "0.68rem" }}>
                        Track on Squid ↗
                      </a>
                    </div>
                  )}
                  {!execResult.isSimulated && execResult.txHash && (
                    <div style={{ borderTop: "1px solid #1f1f1f", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", alignItems: "center" }}>
                      <span style={{ color: "#6b7280" }}>Tx hash</span>
                      <a href={execResult.explorerUrl} target="_blank" rel="noreferrer" style={{ color: "#22d3ee", textDecoration: "none", fontFamily: "monospace", fontSize: "0.68rem" }}>
                        {execResult.txHash.slice(0, 10)}…{execResult.txHash.slice(-6)} ↗
                      </a>
                    </div>
                  )}
                </div>

                <button onClick={() => { setExecModal(null); setRoutes([]); setAmount(""); }} style={{ padding: "0.75rem", borderRadius: 12, border: "none", background: "#0e7490", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.875rem" }}>Done</button>
              </>
            )}

            {/* ── Fail ── */}
            {execModal === "fail" && execResult && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f8717120", border: "1px solid #f8717155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>✕</div>
                  <div style={{ fontWeight: 700, color: "#f87171", fontSize: "0.95rem" }}>Swap failed</div>
                </div>
                <div style={{ background: "#f8717108", border: "1px solid #f8717133", borderRadius: 12, padding: "0.75rem", fontSize: "0.78rem", color: "#f87171" }}>{execResult.error}</div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button onClick={() => setExecModal(null)} style={{ flex: 1, padding: "0.75rem", borderRadius: 12, border: "1px solid #e2e2ea", background: "#f5f5f8", color: "#6b7280", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" }}>Close</button>
                  <button onClick={() => { setSwipeX(0); setExecModal("confirm"); }} style={{ flex: 1, padding: "0.75rem", borderRadius: 12, border: "none", background: "#1e293b", color: "#94a3b8", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" }}>Try Again</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
