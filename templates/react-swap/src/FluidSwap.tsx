import { useState, useEffect, useCallback, useRef } from "react";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseUnits,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  FluidWalletClient,
  type SorRoute,
} from "@fluidwalletbase/wallet-endpoints";
import {
  TOKENS,
  TOKENS_BY_NETWORK,
  NETWORKS,
  FLUID_SOR_ADDRESS,
  FLUID_SITE,
  IS_DEPLOYED,
  BASESCAN,
  FLUID_API_KEY,
  FLUID_PRIVATE_KEY,
  CHAIN,
  BASE_RPC_URL,
  type Token,
  type Network,
} from "./config";

// ─── Fluid SDK client ─────────────────────────────────────────────────────────
// In dev, Vite proxies /api/* to fluidnative.com — use relative URL to avoid CORS.
// In prod, point directly at the server.
const BASE_URL = import.meta.env.DEV ? "" : "https://fluidnative.com";
const client = new FluidWalletClient(BASE_URL, FLUID_API_KEY ?? null);

// ─── Viem clients ─────────────────────────────────────────────────────────────

// Use explicit Base mainnet RPC — never testnet
const publicClient = createPublicClient({ chain: CHAIN, transport: http(BASE_RPC_URL) });

const account =
  FLUID_PRIVATE_KEY &&
  FLUID_PRIVATE_KEY.startsWith("0x") &&
  FLUID_PRIVATE_KEY.length === 66
    ? (() => {
        try { return privateKeyToAccount(FLUID_PRIVATE_KEY as `0x${string}`); }
        catch { return null; }
      })()
    : null;

const walletClient = account
  ? createWalletClient({ account, chain: CHAIN, transport: http(BASE_RPC_URL) })
  : null;

// ─── ABIs ────────────────────────────────────────────────────────────────────

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const FLUID_SOR_ABI = [
  {
    name: "swapViaFluid",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn",      type: "address" },
      { name: "tokenOut",     type: "address" },
      { name: "amountIn",     type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "recipient",    type: "address" },
      { name: "deadline",     type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "swapViaUniV3",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn",      type: "address" },
      { name: "tokenOut",     type: "address" },
      { name: "amountIn",     type: "uint256" },
      { name: "fee",          type: "uint24"  },
      { name: "minAmountOut", type: "uint256" },
      { name: "recipient",    type: "address" },
      { name: "deadline",     type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "splitSwapFluidUniV3",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn",      type: "address" },
      { name: "tokenOut",     type: "address" },
      { name: "amountIn",     type: "uint256" },
      { name: "splitBps",     type: "uint256" },
      { name: "uniV3Fee",     type: "uint24"  },
      { name: "minAmountOut", type: "uint256" },
      { name: "recipient",    type: "address" },
      { name: "deadline",     type: "uint256" },
    ],
    outputs: [{ name: "totalOut", type: "uint256" }],
  },
] as const;

// ─── Venue display config ─────────────────────────────────────────────────────

const VENUE_META: Record<string, { color: string; icon: string; logo?: string }> = {
  "Fluid AMM":   { color: "#22d3ee", icon: "◈"  },
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
  "Frax":        { color: "#9ca3af", icon: "𝔽"  },
  "Convex":      { color: "#f97316", icon: "🔺" },
  "Bancor":      { color: "#12b886", icon: "◉",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/bancor-bnt-logo.png" },
  "Trader Joe":  { color: "#ef4444", icon: "🎰", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Trader_joe.png" },
  "GMX":         { color: "#06b6d4", icon: "◆",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/GMX-logo-1.png" },
  "Camelot":     { color: "#a16207", icon: "♞"  },
  "Platypus":    { color: "#2dd4bf", icon: "🦆" },
  "WOOFi":       { color: "#8b5cf6", icon: "🐕", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/woofi.png" },
  "Hashflow":    { color: "#0ea5e9", icon: "⌗",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/hashflow.png" },
  "Maverick":    { color: "#ec4899", icon: "◀",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Maverick.png" },
  "Ambient":     { color: "#10b981", icon: "〰", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/ambient.png" },
  "Clipper":     { color: "#f472b6", icon: "✂",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/clipper.png" },
  "Odos":        { color: "#6366f1", icon: "⊕",  logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/odos.png" },
  "OpenOcean":   { color: "#38bdf8", icon: "🌊", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/open_ocean.jpg" },
};

function venueColor(venue: string) {
  const key = Object.keys(VENUE_META).find((k) => venue.includes(k)) ?? "Split";
  return VENUE_META[key] ?? { color: "#6b7280", icon: "◈", logo: undefined };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "#0a0a0a",
    border: "1px solid #1f1f1f",
    borderRadius: 20,
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  } as React.CSSProperties,
  inputBox: {
    background: "#111",
    border: "1px solid #1f1f1f",
    borderRadius: 14,
    padding: "0.9rem 1rem",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  } as React.CSSProperties,
  inputNum: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: "1.4rem",
    fontWeight: 700,
    width: "100%",
    outline: "none",
  } as React.CSSProperties,
  tokenBtn: (color: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    background: color + "18",
    border: `1px solid ${color}44`,
    borderRadius: 10,
    color,
    padding: "0.4rem 0.75rem",
    fontSize: "0.875rem",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  }),
  btn: (color: string, disabled?: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "0.95rem",
    borderRadius: 14,
    border: "none",
    background: disabled ? "#1a1a1a" : color,
    color: disabled ? "#374151" : "#fff",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s",
    letterSpacing: "-0.01em",
  }),
  badge: (color: string): React.CSSProperties => ({
    display: "inline-block",
    background: color + "22",
    border: `1px solid ${color}55`,
    color,
    borderRadius: 6,
    padding: "0.15rem 0.45rem",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  }),
  warn: (color: string): React.CSSProperties => ({
    background: color + "0d",
    border: `1px solid ${color}33`,
    borderRadius: 12,
    padding: "0.75rem 1rem",
    fontSize: "0.78rem",
    color,
    lineHeight: 1.5,
  }),
  flipBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#151515",
    border: "1px solid #2a2a2a",
    cursor: "pointer",
    margin: "0 auto",
    color: "#4b5563",
    fontSize: "1.1rem",
  } as React.CSSProperties,
};

// ─── Token selector modal ──────────────────────────────────────────────────────

function TokenSelect({
  value, exclude, tokens, onChange, onClose,
}: { value: string; exclude: string; tokens: Record<string, Token>; onChange: (t: string) => void; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#000a",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: "1.25rem", minWidth: 220, maxHeight: "70vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>Select token</div>
        {Object.values(tokens).filter((t) => t.symbol !== exclude).map((t) => (
          <button
            key={t.symbol}
            onClick={() => { onChange(t.symbol); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              width: "100%", padding: "0.65rem 0.75rem", borderRadius: 10,
              background: value === t.symbol ? t.color + "15" : "transparent",
              border: value === t.symbol ? `1px solid ${t.color}44` : "1px solid transparent",
              color: "#fff", cursor: "pointer", marginBottom: "0.35rem",
            }}
          >
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, color: t.color }}>
              {t.symbol.slice(0, 2)}
            </span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>{t.symbol}</div>
              <div style={{ fontSize: "0.65rem", color: "#4b5563" }}>{t.address.slice(0, 12)}…</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Route card (compact grid tile) ──────────────────────────────────────────

function RouteCard({
  route, toSym, selected, onClick, rank,
}: { route: SorRoute; toSym: string; selected: boolean; onClick: () => void; rank: number }) {
  const { color, icon, logo } = venueColor(route.venue);
  const isBest = rank === 0;
  const rankLabels = ["BEST", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
  const rankLabel  = rankLabels[rank] ?? `${rank + 1}th`;
  const rankColor  = rank === 0 ? "#4ade80" : rank === 1 ? "#facc15" : rank === 2 ? "#fb923c" : "#6b7280";

  // Shorten venue name so it fits in a narrow tile
  const shortName = route.venue
    .replace(" Aggregator", "")
    .replace(" Stable AMM", " AMM")
    .replace(" Volatile", " Vol")
    .replace(" V3 ", " ")
    .replace("PancakeSwap", "Pancake")
    .replace("SushiSwap", "Sushi")
    .replace("Fluid AMM + Uni V3", "Fluid Split")
    .replace("Velodrome V2", "Velodrome");

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        textAlign: "left",
        padding: "0.65rem 0.6rem 0.55rem",
        borderRadius: 10,
        border: selected
          ? `1.5px solid ${color}88`
          : isBest
            ? `1px solid ${color}44`
            : "1px solid #1f1f1f",
        background: selected ? color + "12" : isBest ? color + "08" : "#0d0d0d",
        cursor: "pointer",
        width: "100%",
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem",
        minHeight: 80,
      }}
    >
      {/* Rank badge — shown on every card */}
      <span style={{
        position: "absolute", top: 5, right: 5,
        background: rankColor + "22", border: `1px solid ${rankColor}55`,
        color: rankColor, borderRadius: 4,
        fontSize: "0.48rem", fontWeight: 800, padding: "0.1rem 0.3rem",
        letterSpacing: "0.05em", textTransform: "uppercase",
      }}>{rankLabel}</span>

      {/* Icon + name row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
        {logo ? (
          <img src={logo} alt={shortName} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>{icon}</span>
        )}
        <span style={{
          fontSize: "0.62rem", fontWeight: 700, color: color,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: "calc(100% - 20px)",
        }}>{shortName}</span>
      </div>

      {/* Amount out — full precision */}
      <div style={{
        fontWeight: 800,
        fontSize: "0.75rem",
        color: rank < 3 ? rankColor : "#e5e7eb",
        letterSpacing: "-0.01em",
        wordBreak: "break-all",
        lineHeight: 1.2,
      }}>
        {route.amountOut}
        <span style={{ fontSize: "0.58rem", color: "#6b7280", marginLeft: "0.2rem" }}>{toSym}</span>
      </div>

      {/* Fee + gas row */}
      <div style={{ fontSize: "0.55rem", color: "#374151", display: "flex", justifyContent: "space-between" }}>
        <span>{parseFloat(route.priceImpact).toFixed(2)}% fee</span>
        <span>{route.gasEstimate}</span>
      </div>

      {/* Badge */}
      {route.badge && (
        <span style={{
          background: color + "18", border: `1px solid ${color}33`,
          color, borderRadius: 4,
          fontSize: "0.48rem", fontWeight: 700, padding: "0.08rem 0.3rem",
          letterSpacing: "0.04em", textTransform: "uppercase",
          alignSelf: "flex-start",
        }}>{route.badge}</span>
      )}
    </button>
  );
}

// ─── Routing animation ────────────────────────────────────────────────────────

const VENUES_SCAN = [
  { key: "Fluid",       label: "Fluid AMM",   color: "#22d3ee", icon: "◈",  lineClass: "cyan"   },
  { key: "Uniswap",     label: "Uniswap V3",  color: "#ff007a", icon: "🦄", lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Uniswap1.jpg" },
  { key: "Aerodrome",   label: "Aerodrome",   color: "#3b82f6", icon: "✈",  lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/AnNwWdzS_400x400.jpg" },
  { key: "Curve",       label: "Curve",       color: "#f59e0b", icon: "⟳",  lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/curve-dao-token-crv-logo.png" },
  { key: "Balancer",    label: "Balancer",    color: "#7c3aed", icon: "⬡",  lineClass: "purple", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/balancer.png" },
  { key: "PancakeSwap", label: "PancakeSwap", color: "#d97706", icon: "🥞", lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/pancakeswap.png" },
  { key: "SushiSwap",   label: "SushiSwap",   color: "#e11d48", icon: "🍣", lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/sushiswap.jpg" },
  { key: "Velodrome",   label: "Velodrome",   color: "#6366f1", icon: "⚡", lineClass: "purple", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/velodrome.png" },
  { key: "Odos",        label: "Odos",        color: "#6366f1", icon: "⊕",  lineClass: "purple", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/odos.png" },
  { key: "OpenOcean",   label: "OpenOcean",   color: "#38bdf8", icon: "🌊", lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/open_ocean.jpg" },
  { key: "KyberSwap",   label: "KyberSwap",   color: "#31c48d", icon: "🔷", lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/kyber.jpg" },
  { key: "DODO",        label: "DODO",        color: "#facc15", icon: "🦤", lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/DODO.jpg" },
  { key: "1inch",       label: "1inch",       color: "#1d4ed8", icon: "🔵", lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/1inch-1inch-logo.png" },
  { key: "Bancor",      label: "Bancor",      color: "#12b886", icon: "◉",  lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/bancor-bnt-logo.png" },
  { key: "Trader Joe",  label: "Trader Joe",  color: "#ef4444", icon: "🎰", lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Trader_joe.png" },
  { key: "GMX",         label: "GMX",         color: "#06b6d4", icon: "◆",  lineClass: "cyan",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/GMX-logo-1.png" },
  { key: "WOOFi",       label: "WOOFi",       color: "#8b5cf6", icon: "🐕", lineClass: "purple", logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/woofi.png" },
  { key: "Hashflow",    label: "Hashflow",    color: "#0ea5e9", icon: "⌗",  lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/hashflow.png" },
  { key: "Maverick",    label: "Maverick",    color: "#ec4899", icon: "◀",  lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/Maverick.png" },
  { key: "Ambient",     label: "Ambient",     color: "#10b981", icon: "〰", lineClass: "blue",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/ambient.png" },
  { key: "Clipper",     label: "Clipper",     color: "#f472b6", icon: "✂",  lineClass: "pink",   logo: "https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/clipper.png" },
  { key: "Frax",        label: "Frax",        color: "#9ca3af", icon: "𝔽",  lineClass: "cyan"   },
  { key: "Convex",      label: "Convex",      color: "#f97316", icon: "🔺", lineClass: "pink"   },
  { key: "Camelot",     label: "Camelot",     color: "#a16207", icon: "♞",  lineClass: "pink"   },
  { key: "Platypus",    label: "Platypus",    color: "#2dd4bf", icon: "🦆", lineClass: "blue"   },
];

function RoutingAnimation({
  fromSym, toSym, scanning, routes,
}: { fromSym: string; toSym: string; scanning: boolean; routes: SorRoute[] }) {
  const [visibleVenues, setVisibleVenues] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scanning) {
      setVisibleVenues(0);
      let i = 0;
      timerRef.current = setInterval(() => {
        i++;
        setVisibleVenues(i);
        // Auto-scroll the carousel as new venues appear
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
        if (i >= VENUES_SCAN.length) clearInterval(timerRef.current!);
      }, 80);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setVisibleVenues(VENUES_SCAN.length);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [scanning]);

  const tokenIn  = TOKENS[fromSym];
  const tokenOut = TOKENS[toSym];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: "#22d3ee",
            display: "inline-block", flexShrink: 0,
            animation: scanning ? "pulse-dot 0.9s ease-in-out infinite" : "none",
          }} />
          {scanning
            ? <span className="shimmer-text" style={{ fontSize: "0.7rem", fontWeight: 600 }}>
                Scanning {VENUES_SCAN.length} venues…
              </span>
            : <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#22d3ee" }}>
                {routes.length} route{routes.length !== 1 ? "s" : ""} found · best price auto-selected
              </span>
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
          <span style={{
            background: tokenIn.color + "18", border: `1px solid ${tokenIn.color}44`,
            borderRadius: 6, padding: "0.15rem 0.4rem",
            fontSize: "0.62rem", fontWeight: 700, color: tokenIn.color,
          }}>{fromSym}</span>
          <span style={{ color: "#374151", fontSize: "0.6rem" }}>→</span>
          <span style={{
            background: tokenOut.color + "18", border: `1px solid ${tokenOut.color}44`,
            borderRadius: 6, padding: "0.15rem 0.4rem",
            fontSize: "0.62rem", fontWeight: 700, color: tokenOut.color,
          }}>{toSym}</span>
        </div>
      </div>

      {/* ── Scan tiles: 3 rows × N cols, side-scroll for overflow ── */}
      <style>{`
        .venue-scroll::-webkit-scrollbar { display: none; }
        .route-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        ref={scrollRef}
        className="venue-scroll"
        style={{
          display: "grid",
          gridTemplateRows: "repeat(3, auto)",
          gridAutoFlow: "column",
          gridAutoColumns: 100,
          gap: "0.3rem",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* While scanning: reveal in original order. After scan: sort matched venues best-first */}
        {(scanning
          ? VENUES_SCAN.slice(0, visibleVenues)
          : [...VENUES_SCAN].sort((a, b) => {
              const ra = routes.findIndex(r => r.venue.includes(a.key));
              const rb = routes.findIndex(r => r.venue.includes(b.key));
              if (ra === -1 && rb === -1) return 0;
              if (ra === -1) return 1;
              if (rb === -1) return -1;
              return ra - rb;
            })
        ).map((v, i) => {
          const matchedRoute = routes.find(r => r.venue.includes(v.key));
          const isBest = !scanning && matchedRoute && routes[0]?.venue === matchedRoute.venue;

          return (
            <div
              key={v.key}
              className="scanning-venue"
              style={{
                animationDelay: `${i * 0.04}s`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.75rem 0.65rem",
                borderRadius: 10,
                minHeight: 90,
                background: isBest ? "#4ade8010" : "#0d0d0d",
                border: isBest ? "1px solid #4ade8044" : `1px solid ${v.color}28`,
                transition: "background 0.3s, border 0.3s",
              }}
            >
              {/* Top: logo/icon + label */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                {(v as any).logo ? (
                  <img src={(v as any).logo} alt={v.label} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <span style={{ fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>{v.icon}</span>
                )}
                <span style={{
                  fontSize: "0.6rem", fontWeight: 700, color: v.color,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{v.label}</span>
              </div>

              {/* Middle: animated flow line (loading) or solid bar (done) */}
              {scanning
                ? <div className={`flow-line ${v.lineClass}`} style={{ width: "100%", height: 3, borderRadius: 2 }} />
                : <div style={{
                    width: "100%", height: 3, borderRadius: 2,
                    background: matchedRoute ? v.color + "55" : "#1f1f1f",
                  }} />
              }

              {/* Bottom: amount or skeleton */}
              <div>
                {scanning ? (
                  <>
                    {/* Skeleton shimmer blocks */}
                    <div className="shimmer-text" style={{
                      height: 10, borderRadius: 4, width: "80%", background: "#1a1a1a", marginBottom: 4,
                    }} />
                    <div className="shimmer-text" style={{
                      height: 8, borderRadius: 4, width: "55%", background: "#141414",
                    }} />
                  </>
                ) : (
                  <>
                    <div style={{
                      fontSize: "0.68rem", fontWeight: isBest ? 800 : 600,
                      color: isBest ? "#4ade80" : matchedRoute ? "#e5e7eb" : "#374151",
                      letterSpacing: "-0.01em", lineHeight: 1.3,
                      wordBreak: "break-all",
                    }}>
                      {matchedRoute ? matchedRoute.amountOut : "—"}
                    </div>
                    {isBest && (
                      <span style={{
                        display: "inline-block", marginTop: "0.2rem",
                        fontSize: "0.46rem", fontWeight: 800, color: "#4ade80",
                        background: "#4ade8015", border: "1px solid #4ade8033",
                        borderRadius: 3, padding: "0.06rem 0.28rem",
                        letterSpacing: "0.06em", textTransform: "uppercase",
                      }}>BEST</span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Best route bar ── */}
      {!scanning && routes.length > 0 && (
        <div className="route-bar-enter" style={{
          background: "#22d3ee08", border: "1px solid #22d3ee2a",
          borderRadius: 8, padding: "0.4rem 0.65rem",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.7rem",
        }}>
          <span style={{ color: "#22d3ee", fontWeight: 600 }}>Best: {routes[0].venue}</span>
          <span style={{ color: "#4ade80", fontWeight: 700 }}>{routes[0].amountOut} {toSym}</span>
        </div>
      )}
    </div>
  );
}

// ─── Network routing labels ───────────────────────────────────────────────────

const NETWORK_ROUTER_LABEL: Record<string, string> = {
  base:      "FluidSOR · Base",
  ethereum:  "Uniswap V3 · Ethereum",
  solana:    "Jupiter · Solana",
  injective: "Helix · Injective",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function FluidSwap() {
  const [network,   setNetwork]   = useState<Network>("base");
  const [fromSym,   setFromSym]   = useState("USDC");
  const [toSym,     setToSym]     = useState("WETH");
  const [amount,    setAmount]    = useState("");
  const [slippage,  setSlippage]  = useState(0.5);
  const [routes,    setRoutes]    = useState<SorRoute[]>([]);
  const [selRoute,  setSelRoute]  = useState(0);
  const [scanning,  setScanning]  = useState(false);
  const [quoting,   setQuoting]   = useState(false);
  const [quoteErr,  setQuoteErr]  = useState<string | null>(null);
  const [step,      setStep]      = useState<"idle" | "routed" | "approving" | "swapping">("idle");
  const [txHash,    setTxHash]    = useState<Hash | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [showFrom,  setShowFrom]  = useState(false);
  const [showTo,    setShowTo]    = useState(false);
  const [usdcBal,   setUsdcBal]   = useState<string | null>(null);

  const networkTokens = TOKENS_BY_NETWORK[network];
  const networkMeta   = NETWORKS.find(n => n.id === network)!;
  const tokenSymbols  = Object.keys(networkTokens);

  // Reset tokens when network changes
  const handleNetworkChange = (net: Network) => {
    const tokens = Object.keys(TOKENS_BY_NETWORK[net]);
    setNetwork(net);
    setFromSym(tokens[0]);
    setToSym(tokens[1] ?? tokens[0]);
    setRoutes([]); setAmount(""); setStep("idle"); setQuoteErr(null);
  };

  const tokenIn  = networkTokens[fromSym]  ?? Object.values(networkTokens)[0];
  const tokenOut = networkTokens[toSym]    ?? Object.values(networkTokens)[1];
  const hasWallet = !!account;
  const address   = account?.address;

  // ── Balance via wallet-endpoints ───────────────────────────────────────────

  useEffect(() => {
    if (!FLUID_API_KEY) return;
    client.getBalance("base")
      .then((res) => { if (res.success) setUsdcBal(res.balance); })
      .catch(() => {});
  }, []);

  // ── Quote via /api/sor/wallet-quote (public, all networks) ────────────────

  const fetchQuote = useCallback(async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setRoutes([]); setQuoteErr(null); setScanning(false); return; }
    setQuoting(true);
    setScanning(true);
    setQuoteErr(null);
    try {
      const BASE_URL_RESOLVED = import.meta.env.DEV ? "" : "https://fluidnative.com";
      const resp = await fetch(
        `${BASE_URL_RESOLVED}/api/sor/wallet-quote?tokenIn=${fromSym}&tokenOut=${toSym}&amountIn=${amount}&network=${network}`
      );
      const data = await resp.json();
      if (data.error) { setQuoteErr(data.error); setRoutes([]); return; }
      const sorted = [...(data.routes ?? [])].sort((a: any, b: any) => b.amountOutRaw - a.amountOutRaw);
      setRoutes(sorted);
      setSelRoute(0);
    } catch (e: any) {
      setQuoteErr(e?.message ?? "Network error — check your connection.");
      setRoutes([]);
    } finally {
      setQuoting(false);
      setScanning(false);
    }
  }, [amount, fromSym, toSym, network]);

  // Trigger scanning animation immediately when amount changes
  useEffect(() => {
    if (step === "routed") return;
    const n = parseFloat(amount);
    if (n && n > 0) setScanning(true);
    else setScanning(false);
  }, [amount, fromSym, toSym, step]);

  // Auto-preview quote (debounced, no route lock)
  useEffect(() => {
    if (step === "routed") return; // don't overwrite locked route
    const t = setTimeout(fetchQuote, 600);
    return () => clearTimeout(t);
  }, [fetchQuote, step]);

  // ── Swap execution via viem (local signing) ────────────────────────────────

  const handleSwap = async () => {
    if (!walletClient || !address || !routes.length) return;
    setSwapError(null);
    setTxHash(null);

    const route    = routes[selRoute];
    const amountIn = parseUnits(amount, tokenIn.decimals);
    const minOut   = parseUnits(
      (parseFloat(route.amountOut) * (1 - slippage / 100)).toFixed(tokenOut.decimals),
      tokenOut.decimals
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

    try {
      // Step 1 — ERC-20 approve
      setStep("approving");
      const approveHash = await walletClient.sendTransaction({
        to:   tokenIn.address as `0x${string}`,
        data: encodeFunctionData({
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [FLUID_SOR_ADDRESS as `0x${string}`, amountIn],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2 — Swap via FluidSOR
      setStep("swapping");
      const venueKey = route.venue;
      let swapData: `0x${string}`;

      if (venueKey.includes("Fluid AMM") && !venueKey.includes("+")) {
        swapData = encodeFunctionData({
          abi: FLUID_SOR_ABI, functionName: "swapViaFluid",
          args: [tokenIn.address as `0x${string}`, tokenOut.address as `0x${string}`,
                 amountIn, minOut, address as `0x${string}`, deadline],
        });
      } else if (venueKey.includes("Uniswap V3") && !venueKey.includes("+")) {
        swapData = encodeFunctionData({
          abi: FLUID_SOR_ABI, functionName: "swapViaUniV3",
          args: [tokenIn.address as `0x${string}`, tokenOut.address as `0x${string}`,
                 amountIn, 500, minOut, address as `0x${string}`, deadline],
        });
      } else {
        swapData = encodeFunctionData({
          abi: FLUID_SOR_ABI, functionName: "splitSwapFluidUniV3",
          args: [tokenIn.address as `0x${string}`, tokenOut.address as `0x${string}`,
                 amountIn, BigInt(route.splitBps ?? 6000), 500, minOut,
                 address as `0x${string}`, deadline],
        });
      }

      const swapHash = await walletClient.sendTransaction({
        to:   FLUID_SOR_ADDRESS as `0x${string}`,
        data: swapData,
      });
      await publicClient.waitForTransactionReceipt({ hash: swapHash });
      setTxHash(swapHash);
      setStep("idle");
      setAmount("");
      setRoutes([]);
      setSelRoute(0);
      // Refresh balance after swap
      client.getBalance("base").then((r) => { if (r.success) setUsdcBal(r.balance); }).catch(() => {});
    } catch (e: any) {
      setSwapError(e?.shortMessage ?? e?.message ?? "Transaction failed");
      setStep("idle");
    }
  };

  // ── Route (fetch + lock best price) ────────────────────────────────────────

  const handleRoute = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setQuoting(true);
    setScanning(true);
    setQuoteErr(null);
    setSwapError(null);
    try {
      const BASE_URL_RESOLVED = import.meta.env.DEV ? "" : "https://fluidnative.com";
      const resp = await fetch(
        `${BASE_URL_RESOLVED}/api/sor/wallet-quote?tokenIn=${fromSym}&tokenOut=${toSym}&amountIn=${amount}&network=${network}`
      );
      const data = await resp.json();
      if (data.error) { setQuoteErr(data.error); return; }
      const sorted = [...(data.routes ?? [])].sort((a: any, b: any) => b.amountOutRaw - a.amountOutRaw);
      setRoutes(sorted);
      setSelRoute(0);
      setStep("routed");
    } catch (e: any) {
      setQuoteErr(e?.message ?? "Network error");
    } finally {
      setQuoting(false);
      setScanning(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const isBusy     = step === "approving" || step === "swapping";
  const bestRoute  = routes[selRoute];
  const isRouted   = step === "routed" && routes.length > 0;
  const canRoute   = !!amount && parseFloat(amount) > 0 && !isBusy && !isRouted;
  const canExecute = isRouted && hasWallet && IS_DEPLOYED && !isBusy && networkMeta.canSwap;

  return (
    <div style={S.card}>

      {/* ── Network selector ── */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {NETWORKS.map((net) => (
          <button
            key={net.id}
            onClick={() => handleNetworkChange(net.id)}
            style={{
              flex: 1, minWidth: 80, padding: "0.45rem 0.5rem", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700,
              border: network === net.id ? `1px solid ${net.color}66` : "1px solid #1f1f1f",
              background: network === net.id ? net.color + "15" : "#0d0d0d",
              color: network === net.id ? net.color : "#4b5563",
              cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem",
            }}
          >
            <img src={net.imgUrl} alt={net.label} style={{ width: 14, height: 14, borderRadius: 3, objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            {net.label}
          </button>
        ))}
      </div>

      {/* ── Missing private key — only relevant for Base execution ── */}
      {!hasWallet && network === "base" && (
        <div style={{ ...S.warn("#6b7280"), fontSize: "0.74rem" }}>
          <strong style={{ color: "#9ca3af" }}>Quoting active.</strong>{" "}
          To enable swap execution on Base, add <code>VITE_FLUID_PRIVATE_KEY=0x...</code> to <code>.env.local</code>.
        </div>
      )}

      {/* ── Wallet info bar (from wallet-endpoints balance) ── */}
      {hasWallet && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          background: "#22d3ee0a", border: "1px solid #22d3ee22",
          borderRadius: 10, padding: "0.55rem 0.75rem",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.7rem", color: "#22d3ee", fontWeight: 600 }}>Fluid Wallet · Base</div>
            <div style={{ fontSize: "0.65rem", color: "#4b5563", fontFamily: "monospace", marginTop: "0.1rem", overflow: "hidden", textOverflow: "ellipsis" }}>
              {address?.slice(0, 10)}…{address?.slice(-8)}
            </div>
          </div>
          {usdcBal !== null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>{usdcBal} USDC</div>
              <div style={{ fontSize: "0.6rem", color: "#4b5563" }}>via wallet-endpoints</div>
            </div>
          )}
        </div>
      )}

      {/* ── You pay ── */}
      <div>
        <div style={{ fontSize: "0.68rem", color: "#4b5563", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>You pay</div>
        <div style={S.inputBox}>
          <input
            style={S.inputNum}
            type="number"
            min="0"
            placeholder="0.0"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setRoutes([]); setTxHash(null); setStep("idle"); setQuoteErr(null); }}
          />
          <button style={S.tokenBtn(tokenIn.color)} onClick={() => setShowFrom(true)}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: tokenIn.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>
              {tokenIn.symbol[0]}
            </span>
            {fromSym} <span style={{ color: "#4b5563", fontSize: "0.75rem" }}>▾</span>
          </button>
        </div>
      </div>

      {/* ── Flip ── */}
      <button
        style={S.flipBtn}
        onClick={() => { setFromSym(toSym); setToSym(fromSym); setRoutes([]); setAmount(""); setStep("idle"); }}
        title="Flip tokens"
      >⇅</button>

      {/* ── You receive ── */}
      <div>
        <div style={{ fontSize: "0.68rem", color: "#4b5563", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>You receive</div>
        <div style={S.inputBox}>
          <div style={{ ...S.inputNum, color: bestRoute ? "#4ade80" : "#374151" }}>
            {quoting
              ? <span className="shimmer-text" style={{ fontSize: "0.85rem" }}>Routing…</span>
              : bestRoute
                ? bestRoute.amountOut
                : <span style={{ color: "#1f2937" }}>—</span>}
          </div>
          <button style={S.tokenBtn(tokenOut.color)} onClick={() => setShowTo(true)}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: tokenOut.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>
              {tokenOut.symbol[0]}
            </span>
            {toSym} <span style={{ color: "#4b5563", fontSize: "0.75rem" }}>▾</span>
          </button>
        </div>
      </div>

      {/* ── Slippage ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", color: "#4b5563" }}>
        <span>Slippage</span>
        {[0.1, 0.5, 1.0].map((s) => (
          <button
            key={s}
            onClick={() => setSlippage(s)}
            style={{
              padding: "0.2rem 0.5rem", borderRadius: 6, fontSize: "0.7rem",
              border: slippage === s ? "1px solid #22d3ee55" : "1px solid #1f1f1f",
              background: slippage === s ? "#22d3ee15" : "#111",
              color: slippage === s ? "#22d3ee" : "#4b5563", cursor: "pointer",
            }}
          >{s}%</button>
        ))}
        <span style={{ marginLeft: "auto", color: "#374151", fontSize: "0.68rem" }}>
          {NETWORK_ROUTER_LABEL[network] ?? "FluidSOR"}
        </span>
      </div>

      {/* ── Routing animation + live routes ── */}
      {(scanning || quoting || routes.length > 0) && amount && (
        <div style={{ border: "1px solid #1a1a1a", borderRadius: 14, padding: "0.75rem 1rem", background: "#080808" }}>
          <RoutingAnimation
            fromSym={fromSym}
            toSym={toSym}
            scanning={scanning || quoting}
            routes={routes}
          />

          {/* Route price cards — best first, 3 rows × N cols, side-scroll */}
          {!quoting && routes.length > 0 && (
            <div
              className="route-scroll"
              style={{
                display: "grid",
                gridTemplateRows: "repeat(3, auto)",
                gridAutoFlow: "column",
                gridAutoColumns: 140,
                gap: "0.4rem",
                overflowX: "auto",
                overflowY: "hidden",
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
                marginTop: "0.6rem",
              }}
            >
              {/* routes[] is already sorted best-first from server */}
              {routes.map((r, i) => (
                <RouteCard
                  key={i}
                  route={r}
                  toSym={toSym}
                  selected={selRoute === i}
                  onClick={() => setSelRoute(i)}
                  rank={i}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Errors ── */}
      {quoteErr && amount && <div style={S.warn("#f87171")}>{quoteErr}</div>}
      {swapError && <div style={S.warn("#f87171")}>{swapError}</div>}
      {!IS_DEPLOYED && (
        <div style={S.warn("#f59e0b")}>Set <code>VITE_FLUID_SOR_ADDRESS</code> in .env.local.</div>
      )}

      {/* ── Step 1: Route via FluidSOR ── */}
      {!isRouted && !isBusy && (
        <button
          style={S.btn(canRoute ? "#0e7490" : "#1a1a1a", !canRoute)}
          onClick={handleRoute}
          disabled={!canRoute}
        >
          {quoting ? "Searching all venues…"
           : !amount ? "Enter an amount to route"
           : `Route via ${NETWORK_ROUTER_LABEL[network] ?? "FluidSOR"}`}
        </button>
      )}

      {/* ── Step 2: Execute Swap (shown after route is locked) ── */}
      {(isRouted || isBusy) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Locked route summary */}
          {isRouted && bestRoute && (
            <div style={{
              background: "#22d3ee08", border: "1px solid #22d3ee22",
              borderRadius: 10, padding: "0.6rem 0.85rem",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: "0.78rem",
            }}>
              <div>
                <span style={{ color: "#22d3ee", fontWeight: 600 }}>{bestRoute.venue}</span>
                <span style={{ color: "#4b5563" }}> · best price locked</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ color: "#4ade80", fontWeight: 700 }}>{bestRoute.amountOut} {toSym}</span>
                <button
                  onClick={() => { setStep("idle"); setRoutes([]); }}
                  style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "0.75rem" }}
                >✕</button>
              </div>
            </div>
          )}
          <button
            style={S.btn(
              step === "approving" ? "#0891b2"
              : step === "swapping" ? "#22d3ee"
              : "#22d3ee",
              !canExecute
            )}
            onClick={handleSwap}
            disabled={!canExecute}
          >
            {step === "approving" ? "Approving token…"
             : step === "swapping" ? `Swapping via ${bestRoute?.venue ?? "FluidSOR"}…`
             : !networkMeta.canSwap ? `Execution on ${networkMeta.label} — coming soon`
             : !hasWallet ? "Add private key to execute"
             : `Execute Swap via ${bestRoute?.venue ?? "FluidSOR"}`}
          </button>
        </div>
      )}

      {/* ── Success ── */}
      {txHash && step === "idle" && (
        <div style={{
          background: "#4ade8015", border: "1px solid #4ade8044",
          borderRadius: 12, padding: "0.75rem 1rem",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.8rem", color: "#4ade80",
        }}>
          <span>✓ Swap confirmed via FluidSOR</span>
          <a href={`${BASESCAN}/tx/${txHash}`} target="_blank" rel="noreferrer"
            style={{ color: "#4ade80", fontSize: "0.7rem", textDecoration: "underline" }}>
            Basescan ↗
          </a>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
        <a href={FLUID_SITE} target="_blank" rel="noreferrer"
          style={{ fontSize: "0.68rem", color: "#22d3ee", textDecoration: "none" }}>
          Powered by Fluid ↗
        </a>
        {bestRoute && (
          <span style={{ fontSize: "0.65rem", color: "#374151" }}>
            {fromSym} → {toSym} · best: {bestRoute.venue}
          </span>
        )}
      </div>

      {/* ── Token selector modals ── */}
      {showFrom && (
        <TokenSelect value={fromSym} exclude={toSym} tokens={networkTokens}
          onChange={(t) => { setFromSym(t); setRoutes([]); }} onClose={() => setShowFrom(false)} />
      )}
      {showTo && (
        <TokenSelect value={toSym} exclude={fromSym} tokens={networkTokens}
          onChange={(t) => { setToSym(t); setRoutes([]); }} onClose={() => setShowTo(false)} />
      )}
    </div>
  );
}
