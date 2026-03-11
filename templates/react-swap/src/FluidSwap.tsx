import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { encodeFunctionData, parseUnits, formatUnits } from "viem";
import {
  TOKENS,
  FLUID_SOR_ADDRESS,
  FLUID_SITE,
  IS_DEPLOYED,
  BASE_CHAIN_ID,
  BASESCAN,
  FLUID_API_KEY,
  type Token,
} from "./config";

// ─── FluidSOR ABI (minimal) ──────────────────────────────────────────────────

const FLUID_SOR_ABI = [
  // swapViaFluid(address,address,uint256,uint256,address,uint256)
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
  // swapViaUniV3(address,address,uint256,uint24,uint256,address,uint256)
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
  // splitSwapFluidUniV3(address,address,uint256,uint256,uint24,uint256,address,uint256)
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

// ERC-20 approve ABI
const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "#0d0d0d",
    border: "1px solid #1f1f1f",
    borderRadius: 16,
    padding: "1.25rem",
  } as React.CSSProperties,
  inputRow: {
    background: "#111",
    border: "1px solid #1f1f1f",
    borderRadius: 12,
    padding: "0.75rem 1rem",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  } as React.CSSProperties,
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: "1.25rem",
    fontWeight: 700,
    width: "100%",
  } as React.CSSProperties,
  select: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    color: "#fff",
    padding: "0.4rem 0.75rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,
  btn: (color: string, disabled?: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "0.85rem",
    borderRadius: 12,
    border: "none",
    background: disabled ? "#1f1f1f" : color,
    color: disabled ? "#4b5563" : "#fff",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity 0.15s",
  }),
  badge: (color: string): React.CSSProperties => ({
    display: "inline-block",
    background: color + "22",
    border: `1px solid ${color}44`,
    color,
    borderRadius: 6,
    padding: "0.15rem 0.5rem",
    fontSize: "0.7rem",
    fontWeight: 600,
  }),
  flipBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#111",
    border: "1px solid #1f1f1f",
    cursor: "pointer",
    margin: "0.4rem auto",
    color: "#6b7280",
    fontSize: "1rem",
  } as React.CSSProperties,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function FluidSwap() {
  const { address, isConnected, chain } = useAccount();
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();

  const { sendTransaction, data: txHash, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const [fromSym,  setFromSym]  = useState("USDC");
  const [toSym,    setToSym]    = useState("USDT");
  const [amount,   setAmount]   = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [routes,   setRoutes]   = useState<RouteQuote[]>([]);
  const [selRoute, setSelRoute] = useState(0);
  const [quoting,  setQuoting]  = useState(false);
  const [step,     setStep]     = useState<"idle" | "approving" | "swapping">("idle");
  const [error,    setError]    = useState<string | null>(null);

  const tokenIn  = TOKENS[fromSym];
  const tokenOut = TOKENS[toSym];
  const wrongChain = isConnected && chain?.id !== BASE_CHAIN_ID;

  // ── Quote ───────────────────────────────────────────────────────────────

  const fetchQuote = useCallback(async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setRoutes([]); return; }
    setQuoting(true);
    try {
      const headers: Record<string, string> = {};
      if (FLUID_API_KEY) headers["x-fluid-api-key"] = FLUID_API_KEY;
      const r = await fetch(
        `https://fluidnative.com/api/sor/quote?tokenIn=${fromSym}&tokenOut=${toSym}&amountIn=${amount}`,
        { headers }
      );
      if (!r.ok) throw new Error();
      const data = await r.json();
      setRoutes(data.routes ?? []);
      setSelRoute(0);
    } catch {
      setRoutes([]);
    } finally {
      setQuoting(false);
    }
  }, [amount, fromSym, toSym]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  // ── Swap ─────────────────────────────────────────────────────────────────

  const handleSwap = async () => {
    if (!isConnected || !address || !routes.length) return;
    setError(null);

    const route = routes[selRoute];
    const amountIn = parseUnits(amount, tokenIn.decimals);
    const minOut   = parseUnits(
      (parseFloat(route.amountOut) * (1 - slippage / 100)).toFixed(tokenOut.decimals),
      tokenOut.decimals
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
    const venueKey = route.venue;

    try {
      // Step 1: approve
      setStep("approving");
      const approveData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [FLUID_SOR_ADDRESS as `0x${string}`, amountIn],
      });
      sendTransaction({
        to:   tokenIn.address as `0x${string}`,
        data: approveData,
      });
    } catch (e: any) {
      setError(e?.message ?? "Transaction failed");
      setStep("idle");
    }
  };

  // After approve confirms, send the swap
  useEffect(() => {
    if (!isConfirmed || step !== "approving" || !address || !routes.length) return;

    const route   = routes[selRoute];
    const amountIn = parseUnits(amount, tokenIn.decimals);
    const minOut   = parseUnits(
      (parseFloat(route.amountOut) * (1 - slippage / 100)).toFixed(tokenOut.decimals),
      tokenOut.decimals
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
    const venueKey = route.venue;

    setStep("swapping");

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

    sendTransaction({
      to:   FLUID_SOR_ADDRESS as `0x${string}`,
      data: swapData,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  useEffect(() => {
    if (isConfirmed && step === "swapping") setStep("idle");
  }, [isConfirmed, step]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const isBusy     = isSending || isConfirming || step !== "idle";
  const canSwap    = isConnected && routes.length > 0 && !isBusy && !wrongChain;
  const currentOut = routes[selRoute]?.amountOut ?? "";

  return (
    <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {/* You pay */}
      <div>
        <div style={{ fontSize: "0.7rem", color: "#6b7280", marginBottom: "0.4rem" }}>You pay</div>
        <div style={S.inputRow}>
          <input
            style={S.input}
            type="number"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            style={S.select}
            value={fromSym}
            onChange={(e) => { setFromSym(e.target.value); setRoutes([]); }}
          >
            {Object.keys(TOKENS).filter((t) => t !== toSym).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Flip */}
      <button
        style={S.flipBtn}
        onClick={() => { setFromSym(toSym); setToSym(fromSym); setRoutes([]); }}
        title="Flip tokens"
      >
        ⇅
      </button>

      {/* You receive */}
      <div>
        <div style={{ fontSize: "0.7rem", color: "#6b7280", marginBottom: "0.4rem" }}>You receive</div>
        <div style={S.inputRow}>
          <div style={{ ...S.input, color: currentOut ? "#4ade80" : "#374151" }}>
            {quoting ? "…" : currentOut || "—"}
          </div>
          <select
            style={S.select}
            value={toSym}
            onChange={(e) => { setToSym(e.target.value); setRoutes([]); }}
          >
            {Object.keys(TOKENS).filter((t) => t !== fromSym).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Slippage */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "#6b7280" }}>
        <span>Slippage:</span>
        {[0.1, 0.5, 1.0].map((s) => (
          <button
            key={s}
            onClick={() => setSlippage(s)}
            style={{
              padding: "0.2rem 0.5rem",
              borderRadius: 6,
              border: slippage === s ? "1px solid #22d3ee55" : "1px solid #1f1f1f",
              background: slippage === s ? "#22d3ee15" : "#111",
              color: slippage === s ? "#22d3ee" : "#6b7280",
              cursor: "pointer",
              fontSize: "0.7rem",
            }}
          >
            {s}%
          </button>
        ))}
      </div>

      {/* Routes */}
      {routes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.65rem", color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Routes
          </div>
          {routes.map((r, i) => (
            <button
              key={i}
              onClick={() => setSelRoute(i)}
              style={{
                textAlign: "left",
                padding: "0.65rem 0.75rem",
                borderRadius: 10,
                border: selRoute === i ? "1px solid #22d3ee44" : "1px solid #1f1f1f",
                background: selRoute === i ? "#22d3ee08" : "#111",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.875rem" }}>{r.amountOut} {toSym}</span>
                {r.badge && (
                  <span style={S.badge("#22d3ee")}>{r.badge}</span>
                )}
              </div>
              <div style={{ color: "#6b7280", fontSize: "0.7rem" }}>
                {r.venue} · {r.priceImpact}% impact · {r.gasEstimate} gas
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Wrong chain warning */}
      {wrongChain && (
        <div style={{ background: "#f59e0b15", border: "1px solid #f59e0b44", borderRadius: 10, padding: "0.65rem 0.75rem", fontSize: "0.8rem", color: "#fbbf24" }}>
          ⚠ Switch your wallet to Base mainnet to swap.
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#ef444415", border: "1px solid #ef444444", borderRadius: 10, padding: "0.65rem 0.75rem", fontSize: "0.8rem", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* Missing API key notice */}
      {!FLUID_API_KEY && (
        <div style={{ background: "#ef444408", border: "1px solid #ef444433", borderRadius: 10, padding: "0.65rem 0.75rem", fontSize: "0.75rem", color: "#f87171" }}>
          <strong>API key required.</strong> Add <code>VITE_FLUID_API_KEY=fw_sor_...</code> to{" "}
          <code>.env.local</code>.{" "}
          <a href="https://fluidnative.com" target="_blank" rel="noopener noreferrer" style={{ color: "#67e8f9", textDecoration: "underline" }}>
            Get your key → fluidnative.com
          </a>
        </div>
      )}

      {/* Contract not deployed notice */}
      {!IS_DEPLOYED && (
        <div style={{ background: "#f59e0b08", border: "1px solid #f59e0b33", borderRadius: 10, padding: "0.65rem 0.75rem", fontSize: "0.75rem", color: "#d97706" }}>
          Set <code>VITE_FLUID_SOR_ADDRESS</code> in .env.local after deploying FluidSOR.sol.
        </div>
      )}

      {/* Swap / Connect button */}
      {!isConnected ? (
        <button
          style={S.btn("#7c3aed")}
          onClick={() => connect({ connector: injected() })}
        >
          Connect Wallet
        </button>
      ) : (
        <button
          style={S.btn("#0891b2", !canSwap)}
          onClick={handleSwap}
          disabled={!canSwap}
        >
          {step === "approving"  ? "Approving…"
           : step === "swapping" ? "Swapping…"
           : isConfirming        ? "Confirming…"
           : routes.length === 0 && amount ? "Getting quote…"
           : "Swap via Fluid SOR"}
        </button>
      )}

      {/* Success */}
      {isConfirmed && step === "idle" && txHash && (
        <div style={{ background: "#4ade8015", border: "1px solid #4ade8044", borderRadius: 10, padding: "0.65rem 0.75rem", fontSize: "0.8rem", color: "#4ade80", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>✓ Swap confirmed!</span>
          <a href={`${BASESCAN}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: "#4ade80", fontSize: "0.7rem" }}>
            View ↗
          </a>
        </div>
      )}

      {/* Footer: connect to fluid + disconnect */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
        <a
          href={FLUID_SITE}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: "0.7rem", color: "#22d3ee", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25rem" }}
        >
          Connect to Fluid ↗
        </a>
        {isConnected && (
          <button
            onClick={() => disconnect()}
            style={{ background: "none", border: "none", color: "#4b5563", fontSize: "0.7rem", cursor: "pointer" }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
