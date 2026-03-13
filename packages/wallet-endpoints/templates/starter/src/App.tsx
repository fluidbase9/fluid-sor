import { useState } from "react";
import { FluidWalletClient } from "@fluidwalletbase/wallet-endpoints";

// ─── Config ───────────────────────────────────────────────────────────────────
// API key is written to .env.local by the CLI — never commit .env.local
const API_KEY  = import.meta.env.VITE_FLUID_API_KEY  as string | undefined;
const BASE_URL = (import.meta.env.VITE_BASE_URL as string | undefined) ?? "";

const client = new FluidWalletClient(BASE_URL || "https://fluidnative.com", API_KEY ?? null);

// ─── Types ────────────────────────────────────────────────────────────────────
type Result = { label: string; data: unknown; error?: boolean };

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:    { minHeight: "100vh", background: "linear-gradient(160deg,#061520,#071f14,#060c1a)", padding: "2rem 1rem" },
  center:  { maxWidth: 760, margin: "0 auto" },
  card:    { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "1rem" },
  badge:   (color: string) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.2rem 0.6rem", borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${color}44`, background: `${color}18`, color }),
  btn:     (color: string) => ({ cursor: "pointer", padding: "0.45rem 1rem", borderRadius: 8, border: `1px solid ${color}55`, background: `${color}20`, color, fontSize: 12, fontWeight: 600, transition: "all 0.15s" }),
  label:   { fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const },
  heading: { fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.25rem" },
  sub:     { fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.75rem" },
  pre:     { background: "#0b1528", borderRadius: 8, padding: "0.75rem 1rem", fontSize: 11, color: "#34d399", overflowX: "auto" as const, border: "1px solid rgba(20,184,166,0.15)", whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const },
  dot:     (ok: boolean) => ({ width: 8, height: 8, borderRadius: "50%", background: ok ? "#10b981" : "#ef4444", display: "inline-block", marginRight: 6 }),
};

// ─── Endpoint card ────────────────────────────────────────────────────────────
function EndpointCard({
  title, method, endpoint, description,
  onRun, loading, result,
  children,
}: {
  title: string; method: "GET" | "POST"; endpoint: string; description: string;
  onRun: () => void; loading: boolean; result: Result | null;
  children?: React.ReactNode;
}) {
  const methodColor = method === "GET" ? "#34d399" : "#818cf8";
  return (
    <div style={S.card}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={S.badge(methodColor)}>{method}</span>
            <code style={{ fontSize: 11, color: "#94a3b8" }}>{endpoint}</code>
          </div>
          <p style={S.heading}>{title}</p>
          <p style={S.sub}>{description}</p>
          {children}
        </div>
        <button
          style={S.btn(methodColor)}
          onClick={onRun}
          disabled={loading}
        >
          {loading ? "Running…" : "▶ Run"}
        </button>
      </div>
      {result && (
        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ ...S.label, marginBottom: 4 }}>
            <span style={S.dot(!result.error)} />
            {result.label}
          </div>
          <pre style={{ ...S.pre, color: result.error ? "#f87171" : "#34d399" }}>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading]   = useState<string | null>(null);
  const [results, setResults]   = useState<Record<string, Result>>({});

  // Input state for parameterised calls
  const [fluidIdInput,    setFluidIdInput]    = useState("fluiddeveloper1");
  const [addressInput,    setAddressInput]    = useState("0xD858D8B1Aac295485AD1E7028bDE75B221474C27");
  const [sorTokenIn,      setSorTokenIn]      = useState("USDC");
  const [sorTokenOut,     setSorTokenOut]     = useState("USDT");
  const [sorAmount,       setSorAmount]       = useState("100");
  const [historyEmail,    setHistoryEmail]    = useState("");

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(key);
    try {
      const data = await fn();
      setResults(r => ({ ...r, [key]: { label: "Response", data } }));
    } catch (e: any) {
      setResults(r => ({ ...r, [key]: { label: "Error", data: e?.message ?? String(e), error: true } }));
    } finally {
      setLoading(null);
    }
  };

  const inputStyle = { background: "#0b1528", border: "1px solid rgba(20,184,166,0.2)", borderRadius: 6, padding: "0.3rem 0.6rem", color: "#e2e8f0", fontSize: 12, width: "100%" };

  return (
    <div style={S.page}>
      <div style={S.center}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, background: "linear-gradient(90deg,#34d399,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6 }}>
            Hello Fluid Developer
          </h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", maxWidth: 500, margin: "0 auto" }}>
            Experiment with every <code style={{ color: "#34d399" }}>FluidWalletClient</code> endpoint below.
            Each card calls the live Fluid API and shows the raw response.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <span style={S.badge("#34d399")}>
              {API_KEY ? `✓ API key: ${API_KEY.slice(0, 13)}•••` : "⚠ No API key — set VITE_FLUID_API_KEY in .env.local"}
            </span>
          </div>
        </div>

        {/* ── Wallet Info ── */}
        <EndpointCard
          title="getWalletInfo()" method="GET" endpoint="/api/v1/wallet/info"
          description="Returns your registered wallet addresses (Base, Ethereum, Solana), Fluid ID, and email for your API key."
          onRun={() => run("walletInfo", () => client.getWalletInfo())}
          loading={loading === "walletInfo"} result={results["walletInfo"] ?? null}
        />

        {/* ── Balance ── */}
        <EndpointCard
          title="getBalance(chain)" method="GET" endpoint="/api/v1/wallet/balance"
          description="USDC balance of your registered wallet on the specified chain."
          onRun={() => run("balance", () => client.getBalance("base"))}
          loading={loading === "balance"} result={results["balance"] ?? null}
        />

        {/* ── Resolve Fluid ID ── */}
        <EndpointCard
          title="resolveFluidId(username)" method="GET" endpoint="/api/fw-names/resolve/:username"
          description="Fluid ID → wallet address. Enter any registered Fluid username."
          onRun={() => run("resolve", () => client.resolveFluidId(fluidIdInput))}
          loading={loading === "resolve"} result={results["resolve"] ?? null}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ ...S.label, marginBottom: 3 }}>Username</div>
            <input style={inputStyle} value={fluidIdInput} onChange={e => setFluidIdInput(e.target.value)} placeholder="e.g. fluiddeveloper1" />
          </div>
        </EndpointCard>

        {/* ── Reverse Fluid ID ── */}
        <EndpointCard
          title="reverseFluidId(address)" method="GET" endpoint="/api/fw-names/reverse/:address"
          description="Wallet address → Fluid ID. Paste any EVM address to look up its Fluid name."
          onRun={() => run("reverse", () => client.reverseFluidId(addressInput))}
          loading={loading === "reverse"} result={results["reverse"] ?? null}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ ...S.label, marginBottom: 3 }}>Wallet address</div>
            <input style={inputStyle} value={addressInput} onChange={e => setAddressInput(e.target.value)} placeholder="0x..." />
          </div>
        </EndpointCard>

        {/* ── Routing Prices ── */}
        <EndpointCard
          title="getRoutingPrices(tokenIn, tokenOut, amountIn, network)" method="GET" endpoint="/api/sor/wallet-quote"
          description="Live on-chain SOR prices across 25+ DEX venues — Fluid AMM, Uniswap V3, Aerodrome, Jupiter + more."
          onRun={() => run("routing", () => client.getRoutingPrices(sorTokenIn, sorTokenOut, sorAmount, "base"))}
          loading={loading === "routing"} result={results["routing"] ?? null}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: "0.5rem" }}>
            {[["tokenIn", sorTokenIn, setSorTokenIn, "USDC"], ["tokenOut", sorTokenOut, setSorTokenOut, "USDT"], ["amountIn", sorAmount, setSorAmount, "100"]].map(([label, val, set, ph]) => (
              <div key={label as string}>
                <div style={{ ...S.label, marginBottom: 3 }}>{label as string}</div>
                <input style={inputStyle} value={val as string} onChange={e => (set as (v: string) => void)(e.target.value)} placeholder={ph as string} />
              </div>
            ))}
          </div>
        </EndpointCard>

        {/* ── SOR Quote ── */}
        <EndpointCard
          title="getQuote(tokenIn, tokenOut, amountIn, network)" method="GET" endpoint="/api/sor/quote"
          description="Best SOR route for USDC pairs — requires API key. Returns ranked venue list with price impact and gas estimates."
          onRun={() => run("quote", () => client.getQuote("USDC", "USDT", "100", "base"))}
          loading={loading === "quote"} result={results["quote"] ?? null}
        />

        {/* ── Swap History ── */}
        <EndpointCard
          title="getSwapHistory(userEmail, limit)" method="POST" endpoint="/api/swap/history"
          description="Swap transaction history for a registered developer wallet — txHash, explorer URL, venue, amounts, status."
          onRun={() => run("history", () => client.getSwapHistory(historyEmail || "your@email.com", 5))}
          loading={loading === "history"} result={results["history"] ?? null}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ ...S.label, marginBottom: 3 }}>Developer email</div>
            <input style={inputStyle} value={historyEmail} onChange={e => setHistoryEmail(e.target.value)} placeholder="your@email.com" />
          </div>
        </EndpointCard>

        {/* ── Usage Stats ── */}
        <EndpointCard
          title="getUsageStats(email)" method="GET" endpoint="/api/developer/usage"
          description="API call analytics — total calls, calls today, 7-day daily breakdown, per-endpoint counts."
          onRun={() => run("usage", () => client.getUsageStats(historyEmail || "your@email.com"))}
          loading={loading === "usage"} result={results["usage"] ?? null}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ ...S.label, marginBottom: 3 }}>Developer email</div>
            <input style={inputStyle} value={historyEmail} onChange={e => setHistoryEmail(e.target.value)} placeholder="your@email.com" />
          </div>
        </EndpointCard>

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", marginTop: "2rem", color: "#374151", fontSize: 12 }}>
          <p>
            <a href="https://fluidnative.com" target="_blank" rel="noreferrer" style={{ color: "#34d399", textDecoration: "none" }}>fluidnative.com</a>
            {" · "}
            <a href="https://www.npmjs.com/package/@fluidwalletbase/wallet-endpoints" target="_blank" rel="noreferrer" style={{ color: "#34d399", textDecoration: "none" }}>npm</a>
            {" · "}
            <a href="https://github.com/fluidbase9/fluid-sor" target="_blank" rel="noreferrer" style={{ color: "#34d399", textDecoration: "none" }}>GitHub</a>
          </p>
        </div>

      </div>
    </div>
  );
}
