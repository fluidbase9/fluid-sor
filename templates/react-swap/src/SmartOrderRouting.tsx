import { useState, useEffect, useRef } from "react";
import FluidSwapWidget from "./FluidSwapWidget";

// ─── Inline icon SVGs (replaces lucide-react) ────────────────────────────────

const IconGitBranch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
);
const IconTrendingDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
  </svg>
);
const IconZap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconExternalLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ─── Inline network + stablecoin data ────────────────────────────────────────

const NETWORKS = [
  {
    id: "base", displayName: "Base Mainnet", color: "#0052FF", enabled: true,
    icon: "https://fluidspot.s3.us-east-2.amazonaws.com/fluid_assets_2025/2025_nov/Base1.png",
    stablecoins: [
      { symbol: "USDC" }, { symbol: "USDT" }, { symbol: "DAI" },
      { symbol: "FRAX" }, { symbol: "EURC" }, { symbol: "PYUSD" },
    ],
  },
  {
    id: "ethereum", displayName: "Ethereum", color: "#627EEA", enabled: false,
    icon: "https://fluidspot.s3.us-east-2.amazonaws.com/fluid_assets_2025/2025_nov/ethereum1.png",
    stablecoins: [{ symbol: "USDC" }, { symbol: "USDT" }, { symbol: "DAI" }, { symbol: "FRAX" }],
  },
  {
    id: "solana", displayName: "Solana", color: "#9945FF", enabled: false,
    icon: "https://fluidspot.s3.us-east-2.amazonaws.com/fluid_assets_2025/2025_nov/solana1.png",
    stablecoins: [{ symbol: "USDC" }, { symbol: "USDT" }],
  },
  {
    id: "injective", displayName: "Injective", color: "#00C2FF", enabled: false,
    icon: "https://fluidspot.s3.us-east-2.amazonaws.com/fluid_assets_2025/2025_nov/injective1.png",
    stablecoins: [{ symbol: "USDT" }, { symbol: "USDC" }],
  },
];

const FLUID_SOR_ADDRESS = (import.meta.env.VITE_FLUID_SOR_ADDRESS as string | undefined)
  || "0xF24daF8Fe15383fb438d48811E8c4b43749DafAE";

const FEATURES = [
  { icon: <IconGitBranch />, title: "Multi-Path Splitting", description: "Orders are split across multiple DEX pools simultaneously to minimise slippage and get the best effective price." },
  { icon: <IconTrendingDown />, title: "Slippage Optimisation", description: "Real-time slippage analysis across Uniswap V3, Aerodrome, and Fluid Stable AMM routes on Base." },
  { icon: <IconZap />, title: "Gas-Aware Routing", description: "Routes are scored against gas cost so you only take a split path when the price improvement outweighs the overhead." },
  { icon: <IconShield />, title: "MEV Protection", description: "Transactions are submitted with private mempool support to shield your orders from front-running and sandwich attacks." },
];

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Inline Card / Badge components ──────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#030712", border: "1px solid #1f2937", borderRadius: 12, ...style }}>
      {children}
    </div>
  );
}
function CardContent({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "1.25rem" }}>{children}</div>;
}
function CardHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "1rem 1.25rem 0" }}>{children}</div>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.75rem" }}>{children}</div>;
}
function Badge({ children, color = "#22d3ee" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ background: color + "1a", border: `1px solid ${color}33`, color, borderRadius: 6, padding: "0.2rem 0.6rem", fontSize: "0.7rem", fontWeight: 600 }}>
      {children}
    </span>
  );
}

// ─── Ticker bar (live prices) ─────────────────────────────────────────────────

const TICKERS = [
  { sym: "BTC", id: "bitcoin" }, { sym: "INJ", id: "injective-protocol" },
  { sym: "NEAR", id: "near" }, { sym: "OP", id: "optimism" },
  { sym: "SOL", id: "solana" }, { sym: "ETH", id: "ethereum" },
];

function TickerBar() {
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});

  useEffect(() => {
    const ids = TICKERS.map(t => t.id).join(",");
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
      .then(r => r.json())
      .then(data => {
        const p: Record<string, { price: number; change: number }> = {};
        TICKERS.forEach(t => {
          p[t.sym] = { price: data[t.id]?.usd ?? 0, change: data[t.id]?.usd_24h_change ?? 0 };
        });
        setPrices(p);
      }).catch(() => {});
  }, []);

  // Triple the items — animation moves exactly 1/3 so the loop is seamless with no gap
  const items = [...TICKERS, ...TICKERS, ...TICKERS];

  const renderItem = (t: typeof TICKERS[0], i: number) => {
    const p = prices[t.sym];
    const up = (p?.change ?? 0) >= 0;
    return (
      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 24px", fontSize: 11, fontFamily: "monospace", color: "#9ca3af", flexShrink: 0 }}>
        <span style={{ color: "#fff", fontWeight: 700 }}>{t.sym}</span>
        <span>{p ? `$${p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</span>
        {p && <span style={{ color: up ? "#4ade80" : "#f87171" }}>{up ? "+" : ""}{p.change.toFixed(2)}%</span>}
        <span style={{ color: "#222", marginLeft: 4 }}>·</span>
      </span>
    );
  };

  return (
    <div style={{ background: "#000", borderBottom: "1px solid #111", overflow: "hidden", whiteSpace: "nowrap" }}>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .ticker-track {
          display: inline-flex;
          animation: ticker 18s linear infinite;
          will-change: transform;
        }
      `}</style>
      <div className="ticker-track">
        {items.map((t, i) => renderItem(t, i))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SmartOrderRouting() {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const copyAddress = () => {
    navigator.clipboard.writeText(FLUID_SOR_ADDRESS);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "'Inter', sans-serif" }}>

      {/* Ticker bar */}
      <TickerBar />

      {/* Page label */}
      <div style={{ textAlign: "center", padding: "12px 0 0", fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#6366f1" }}>
        Smart Order Routing
      </div>

      <div style={{ maxWidth: 896, margin: "0 auto", padding: "0 24px 48px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, paddingTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <img src="https://fluidspot.s3.us-east-2.amazonaws.com/web/Base/media_files/fluid23.png" alt="Fluid SOR" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 12 }} />
            <h1 style={{ fontWeight: 800, fontSize: "3.5rem", lineHeight: 1.1, margin: 0 }}>Smart Order Routing</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontStyle: "italic", fontSize: "1.1rem", color: "#cbd5e1" }}>
            <span>[ Integrated in Fluid Wallet ] -</span>
            <img src="https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/fluid_intelliegence.png" alt="Fluid Intelligence" style={{ height: 20, objectFit: "contain" }} />
            <span>Fluid Intelligence</span>
          </div>
          <p style={{ fontStyle: "italic", fontSize: "1.05rem", color: "#94a3b8", margin: 0 }}>
            ( Fluid SOR - DeFi Protocol delivering Best Prices and Minimal Slippage in Swaps and Perpetual Trading )
          </p>
        </div>

        {/* Swap widget */}
        <div style={{ maxWidth: 512, margin: "0 auto", width: "100%" }}>
          <FluidSwapWidget />
        </div>

        {/* FluidSOR contract badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6b7280", background: "#0a0a0a", borderRadius: 12, padding: "10px 16px", border: "1px solid #1f2937", flexWrap: "wrap" }}>
          <span style={{ color: "#4b5563" }}>FluidSOR:</span>
          <a href={`https://basescan.org/address/${FLUID_SOR_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee", fontFamily: "monospace", textDecoration: "none" }}>
            {shortenAddress(FLUID_SOR_ADDRESS)}
          </a>
          <button onClick={copyAddress} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#4ade80" : "#6b7280", display: "flex" }}>
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <span style={{ marginLeft: "auto" }}><Badge color="#22d3ee">Base Mainnet</Badge></span>
        </div>

        {/* Feature cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <Card key={i}>
              <CardContent>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ padding: 8, borderRadius: 8, background: "#0f172a", border: "1px solid #1f2937", flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 4px" }}>{f.title}</p>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>{f.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* SDK promo */}
        <Card>
          <CardContent>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 8, margin: "0 0 4px" }}>
                  <IconZap /> Build with Fluid SOR
                </p>
                <p style={{ fontSize: 12, color: "#9ca3af", maxWidth: 400, lineHeight: 1.6, margin: "0 0 12px" }}>
                  Embed FluidSOR in your own dApp using <code style={{ color: "#22d3ee", fontFamily: "monospace" }}>fluid-sor</code>. One command scaffolds a swap interface with wallet connection.
                </p>
                <div style={{ background: "#000", border: "1px solid #1f2937", borderRadius: 8, padding: "10px 16px", fontFamily: "monospace", fontSize: 14, color: "#4ade80", display: "inline-block" }}>
                  npx fluid-sor create my-swap-app
                </div>
              </div>
              <a href="https://fluidnative.com" target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, background: "#4c1d9520", border: "1px solid #7c3aed30", color: "#a78bfa", fontSize: 14, fontWeight: 500, textDecoration: "none", alignSelf: "flex-start" }}>
                fluidnative.com <IconExternalLink />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Supported stablecoins */}
        <Card>
          <CardHeader><CardTitle>Supported Stablecoins by Network</CardTitle></CardHeader>
          <CardContent>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {NETWORKS.map(net => (
                <div key={net.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={net.icon} alt={net.displayName} style={{ width: 16, height: 16, borderRadius: 4, objectFit: "contain", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#d1d5db", width: 112, flexShrink: 0 }}>{net.displayName}</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {net.stablecoins.map(c => (
                      <span key={c.symbol} style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 11,
                        background: net.id === "base" ? "#22d3ee1a" : "#1f2937",
                        border: `1px solid ${net.id === "base" ? "#22d3ee33" : "#374151"}`,
                        color: net.id === "base" ? "#22d3ee" : "#d1d5db",
                      }}>
                        {c.symbol}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, marginLeft: "auto", color: net.id === "base" ? "#06b6d4" : "#4b5563", fontWeight: net.id === "base" ? 600 : 400 }}>
                    {net.id === "base" ? "SOR live" : "coming soon"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
