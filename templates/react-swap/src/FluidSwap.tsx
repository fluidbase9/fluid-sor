import { useState, useEffect, useCallback, useRef } from "react";
import {
  createPublicClient,
  createWalletClient,
  http,
  privateKeyToAccount,
  encodeFunctionData,
  parseUnits,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import {
  TOKENS,
  FLUID_SOR_ADDRESS,
  FLUID_SITE,
  IS_DEPLOYED,
  BASESCAN,
  FLUID_API_KEY,
  FLUID_PRIVATE_KEY,
  type Token,
} from "./config";

// ─── Viem clients ─────────────────────────────────────────────────────────────

const publicClient = createPublicClient({ chain: base, transport: http() });

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
  ? createWalletClient({ account, chain: base, transport: http() })
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteQuote {
  venue:        string;
  amountOut:    string;
  amountOutRaw: number;
  priceImpact:  string;
  gasEstimate:  string;
  splitBps?:    number;
  badge?:       string;
}

// ─── Venue config ─────────────────────────────────────────────────────────────

const VENUE_META: Record<string, { color: string; icon: string }> = {
  "Fluid AMM":    { color: "#22d3ee", icon: "◈" },
  "Uniswap V3":  { color: "#ff007a", icon: "🦄" },
  "Aerodrome":   { color: "#3b82f6", icon: "✈" },
  "Split":       { color: "#a78bfa", icon: "⑂" },
};

function venueStyle(venue: string) {
  const key = Object.keys(VENUE_META).find((k) => venue.includes(k)) ?? "Split";
  return VENUE_META[key] ?? { color: "#6b7280", icon: "◈" };
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
    transition: "border-color 0.15s, color 0.15s",
  } as React.CSSProperties,
};

// ─── Token selector modal ──────────────────────────────────────────────────────

function TokenSelect({
  value, exclude, onChange, onClose,
}: { value: string; exclude: string; onChange: (t: string) => void; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#000a", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111", border: "1px solid #2a2a2a", borderRadius: 16,
          padding: "1.25rem", minWidth: 220,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>Select token</div>
        {Object.values(TOKENS).filter((t) => t.symbol !== exclude).map((t) => {
          const meta = venueStyle("Fluid AMM");
          return (
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
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: t.color }}>
                {t.symbol.slice(0, 1)}
              </span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>{t.symbol}</div>
                <div style={{ fontSize: "0.65rem", color: "#4b5563" }}>{t.address.slice(0, 10)}…</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Route card ───────────────────────────────────────────────────────────────

function RouteCard({
  route, toSym, selected, onClick, rank,
}: { route: RouteQuote; toSym: string; selected: boolean; onClick: () => void; rank: number }) {
  const { color, icon } = venueStyle(route.venue);
  const impact = parseFloat(route.priceImpact);

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "0.8rem 0.9rem",
        borderRadius: 12,
        border: selected ? `1px solid ${color}66` : "1px solid #1f1f1f",
        background: selected ? color + "0a" : "#0d0d0d",
        cursor: "pointer",
        width: "100%",
        transition: "all 0.15s",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1rem" }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#fff" }}>{route.venue}</div>
            <div style={{ fontSize: "0.65rem", color: "#4b5563", marginTop: "0.1rem" }}>
              {impact > 0 ? `${impact.toFixed(3)}% price impact` : "< 0.001% impact"} · est. {route.gasEstimate} gas
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: rank === 0 ? "#4ade80" : "#fff" }}>
            {route.amountOut} {toSym}
          </div>
          <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end", marginTop: "0.25rem" }}>
            {route.badge && <span style={S.badge(color)}>{route.badge}</span>}
            {rank === 0 && <span style={S.badge("#4ade80")}>Best</span>}
          </div>
        </div>
      </div>
      {selected && (
        <div style={{
          position: "absolute", top: 8, right: 8, width: 8, height: 8,
          borderRadius: "50%", background: color,
        }} />
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FluidSwap() {
  const [fromSym,   setFromSym]   = useState("USDC");
  const [toSym,     setToSym]     = useState("WETH");
  const [amount,    setAmount]    = useState("");
  const [slippage,  setSlippage]  = useState(0.5);
  const [routes,    setRoutes]    = useState<RouteQuote[]>([]);
  const [selRoute,  setSelRoute]  = useState(0);
  const [quoting,   setQuoting]   = useState(false);
  const [quoteErr,  setQuoteErr]  = useState<string | null>(null);
  const [step,      setStep]      = useState<"idle" | "approving" | "swapping">("idle");
  const [txHash,    setTxHash]    = useState<Hash | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [showFrom,  setShowFrom]  = useState(false);
  const [showTo,    setShowTo]    = useState(false);

  const tokenIn  = TOKENS[fromSym];
  const tokenOut = TOKENS[toSym];
  const hasWallet = !!account;
  const address   = account?.address;

  // ── Quote fetch ─────────────────────────────────────────────────────────────

  const fetchQuote = useCallback(async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setRoutes([]); setQuoteErr(null); return; }
    setQuoting(true);
    setQuoteErr(null);
    try {
      const headers: Record<string, string> = {};
      if (FLUID_API_KEY) headers["x-fluid-api-key"] = FLUID_API_KEY;
      const r = await fetch(
        `https://fluidnative.com/api/sor/quote?tokenIn=${fromSym}&tokenOut=${toSym}&amountIn=${amount}`,
        { headers }
      );
      const data = await r.json();
      if (!r.ok) {
        setQuoteErr(data?.error ?? `API error ${r.status}`);
        setRoutes([]);
        return;
      }
      const sorted = (data.routes ?? []).sort(
        (a: RouteQuote, b: RouteQuote) => b.amountOutRaw - a.amountOutRaw
      );
      setRoutes(sorted);
      setSelRoute(0);
    } catch (e: any) {
      setQuoteErr("Network error — check your connection.");
      setRoutes([]);
    } finally {
      setQuoting(false);
    }
  }, [amount, fromSym, toSym]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 600);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  // ── Swap execution ──────────────────────────────────────────────────────────

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
      const approveData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [FLUID_SOR_ADDRESS as `0x${string}`, amountIn],
      });
      const approveHash = await walletClient.sendTransaction({
        to:   tokenIn.address as `0x${string}`,
        data: approveData,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2 — Swap via FluidSOR
      setStep("swapping");
      const venueKey = route.venue;
      let swapData: `0x${string}`;

      if (venueKey.includes("Fluid AMM") && !venueKey.includes("+")) {
        swapData = encodeFunctionData({
          abi: FLUID_SOR_ABI,
          functionName: "swapViaFluid",
          args: [
            tokenIn.address  as `0x${string}`,
            tokenOut.address as `0x${string}`,
            amountIn, minOut,
            address as `0x${string}`,
            deadline,
          ],
        });
      } else if (venueKey.includes("Uniswap V3") && !venueKey.includes("+")) {
        swapData = encodeFunctionData({
          abi: FLUID_SOR_ABI,
          functionName: "swapViaUniV3",
          args: [
            tokenIn.address  as `0x${string}`,
            tokenOut.address as `0x${string}`,
            amountIn, 500, minOut,
            address as `0x${string}`,
            deadline,
          ],
        });
      } else {
        swapData = encodeFunctionData({
          abi: FLUID_SOR_ABI,
          functionName: "splitSwapFluidUniV3",
          args: [
            tokenIn.address  as `0x${string}`,
            tokenOut.address as `0x${string}`,
            amountIn,
            BigInt(route.splitBps ?? 6000),
            500,
            minOut,
            address as `0x${string}`,
            deadline,
          ],
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
    } catch (e: any) {
      setSwapError(e?.shortMessage ?? e?.message ?? "Transaction failed");
      setStep("idle");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const isBusy     = step !== "idle";
  const bestRoute  = routes[selRoute];
  const canRoute   = hasWallet && routes.length > 0 && !isBusy && IS_DEPLOYED;

  return (
    <div style={S.card}>

      {/* ── Missing API key ── */}
      {!FLUID_API_KEY && (
        <div style={S.warn("#f87171")}>
          <strong>API key missing.</strong> Add <code>VITE_FLUID_API_KEY=fw_sor_...</code> to{" "}
          <code>.env.local</code> — get yours at{" "}
          <a href="https://fluidnative.com" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>
            fluidnative.com → Developer Console → API Keys
          </a>
        </div>
      )}

      {/* ── Missing private key ── */}
      {!hasWallet && (
        <div style={S.warn("#fbbf24")}>
          <strong>Wallet not configured.</strong> Add{" "}
          <code>VITE_FLUID_PRIVATE_KEY=0x...</code> to <code>.env.local</code> to enable swapping.
          <br />
          <span style={{ color: "#9ca3af" }}>Export from MetaMask → Account Details → Export Private Key</span>
        </div>
      )}

      {/* ── Wallet info bar ── */}
      {hasWallet && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          background: "#22d3ee0a", border: "1px solid #22d3ee22",
          borderRadius: 10, padding: "0.5rem 0.75rem",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} />
          <span style={{ fontSize: "0.72rem", color: "#22d3ee", fontWeight: 600 }}>Fluid Wallet</span>
          <span style={{ fontSize: "0.72rem", color: "#4b5563", marginLeft: "auto", fontFamily: "monospace" }}>
            {address?.slice(0, 8)}…{address?.slice(-6)}
          </span>
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
            onChange={(e) => { setAmount(e.target.value); setRoutes([]); setTxHash(null); }}
          />
          <button style={S.tokenBtn(tokenIn.color)} onClick={() => setShowFrom(true)}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: tokenIn.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>
              {tokenIn.symbol[0]}
            </span>
            {fromSym}
            <span style={{ color: "#4b5563", fontSize: "0.75rem" }}>▾</span>
          </button>
        </div>
      </div>

      {/* ── Flip ── */}
      <button
        style={S.flipBtn}
        onClick={() => { setFromSym(toSym); setToSym(fromSym); setRoutes([]); setAmount(""); }}
        title="Flip tokens"
      >
        ⇅
      </button>

      {/* ── You receive ── */}
      <div>
        <div style={{ fontSize: "0.68rem", color: "#4b5563", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>You receive</div>
        <div style={S.inputBox}>
          <div style={{ ...S.inputNum, color: bestRoute ? "#4ade80" : "#374151", fontSize: "1.4rem" }}>
            {quoting
              ? <span style={{ color: "#22d3ee", fontSize: "0.9rem" }}>Fetching routes…</span>
              : bestRoute
                ? bestRoute.amountOut
                : <span style={{ color: "#1f2937" }}>—</span>}
          </div>
          <button style={S.tokenBtn(tokenOut.color)} onClick={() => setShowTo(true)}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: tokenOut.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>
              {tokenOut.symbol[0]}
            </span>
            {toSym}
            <span style={{ color: "#4b5563", fontSize: "0.75rem" }}>▾</span>
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
              color: slippage === s ? "#22d3ee" : "#4b5563",
              cursor: "pointer",
            }}
          >{s}%</button>
        ))}
        <span style={{ marginLeft: "auto", color: "#374151", fontSize: "0.68rem" }}>
          FluidSOR · Base mainnet
        </span>
      </div>

      {/* ── Live routes from all DEXs ── */}
      {routes.length > 0 && (
        <div>
          <div style={{ fontSize: "0.65rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", display: "inline-block", animation: "pulse 2s infinite" }} />
            Live routes · {routes.length} source{routes.length > 1 ? "s" : ""} indexed
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
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
        </div>
      )}

      {/* ── Quote error ── */}
      {quoteErr && amount && (
        <div style={S.warn("#f87171")}>{quoteErr}</div>
      )}

      {/* ── Swap error ── */}
      {swapError && (
        <div style={S.warn("#f87171")}>{swapError}</div>
      )}

      {/* ── Contract not deployed ── */}
      {!IS_DEPLOYED && (
        <div style={S.warn("#f59e0b")}>
          Set <code>VITE_FLUID_SOR_ADDRESS</code> in .env.local after deploying FluidSOR.sol.
        </div>
      )}

      {/* ── Route / Swap button ── */}
      <button
        style={S.btn(
          step === "approving" ? "#0891b2"
          : step === "swapping" ? "#22d3ee"
          : canRoute ? "#22d3ee"
          : "#1a1a1a",
          !canRoute
        )}
        onClick={handleSwap}
        disabled={!canRoute}
      >
        {step === "approving"
          ? "Approving token…"
          : step === "swapping"
          ? "Executing swap via FluidSOR…"
          : quoting && amount
          ? "Searching routes…"
          : routes.length > 0
          ? `Route via ${routes[selRoute]?.venue ?? "FluidSOR"}`
          : !amount
          ? "Enter an amount"
          : !FLUID_API_KEY
          ? "Add API key to fetch routes"
          : "No routes found"}
      </button>

      {/* ── Success ── */}
      {txHash && step === "idle" && (
        <div style={{
          background: "#4ade8015", border: "1px solid #4ade8044",
          borderRadius: 12, padding: "0.75rem 1rem",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.8rem", color: "#4ade80",
        }}>
          <span>✓ Swap confirmed via FluidSOR</span>
          <a
            href={`${BASESCAN}/tx/${txHash}`}
            target="_blank" rel="noreferrer"
            style={{ color: "#4ade80", fontSize: "0.7rem", textDecoration: "underline" }}
          >
            View on Basescan ↗
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
        <TokenSelect
          value={fromSym}
          exclude={toSym}
          onChange={(t) => { setFromSym(t); setRoutes([]); }}
          onClose={() => setShowFrom(false)}
        />
      )}
      {showTo && (
        <TokenSelect
          value={toSym}
          exclude={fromSym}
          onChange={(t) => { setToSym(t); setRoutes([]); }}
          onClose={() => setShowTo(false)}
        />
      )}
    </div>
  );
}
