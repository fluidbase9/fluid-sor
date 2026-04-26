import { useState, useEffect, useRef } from "react";
import { FluidWalletClient } from "@fluidwalletbase/wallet-endpoints";

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY    = import.meta.env.VITE_FLUID_API_KEY as string | undefined;
const STUDIO     = (import.meta.env.VITE_FLUID_EMAIL  as string | undefined) ?? "Studio";
const BASE_URL   = (import.meta.env.VITE_BASE_URL     as string | undefined) ?? "https://fluidnative.com";

const client = new FluidWalletClient(BASE_URL, API_KEY ?? null);

// ─── Types ────────────────────────────────────────────────────────────────────
type Chain = "base" | "ethereum" | "solana";

interface Player {
  id:      string;
  name:    string;
  address: string;
  reward:  string;
  rank?:   number;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       "#080812",
  surface:  "#0e0e1f",
  card:     "#13132a",
  border:   "#1e1e3f",
  purple:   "#8b5cf6",
  cyan:     "#22d3ee",
  green:    "#10b981",
  red:      "#f43f5e",
  yellow:   "#f59e0b",
  text:     "#e2e8f0",
  muted:    "#64748b",
  dim:      "#334155",
};

// ─── Glow button ─────────────────────────────────────────────────────────────
function GlowBtn({
  children, onClick, disabled, color = T.purple, fullWidth = false, size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const pad  = size === "sm" ? "0.3rem 0.75rem" : size === "lg" ? "0.65rem 1.5rem" : "0.45rem 1.1rem";
  const font = size === "sm" ? 11 : size === "lg" ? 14 : 12;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: pad, fontSize: font, fontWeight: 700, borderRadius: 8,
        border: `1px solid ${disabled ? T.border : color + "88"}`,
        background: disabled ? T.surface : `${color}22`,
        color: disabled ? T.muted : color,
        cursor: disabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : undefined,
        transition: "all 0.15s",
        boxShadow: disabled ? "none" : `0 0 12px ${color}33`,
        letterSpacing: "0.03em",
      }}
    >
      {children}
    </button>
  );
}

// ─── Stat badge ───────────────────────────────────────────────────────────────
function StatBadge({ label, value, color = T.purple }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

// ─── Rank badge ───────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank?: number }) {
  const colors: Record<number, string> = { 1: "#f59e0b", 2: "#94a3b8", 3: "#b45309" };
  const color = rank && rank <= 3 ? colors[rank] : T.dim;
  const label = rank ? (rank <= 3 ? ["🥇","🥈","🥉"][rank - 1] : `#${rank}`) : "—";
  return (
    <span style={{ fontSize: 13, fontWeight: 800, color, minWidth: 24, textAlign: "center", display: "inline-block" }}>
      {label}
    </span>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [walletInfo,     setWalletInfo]     = useState<any>(null);
  const [balance,        setBalance]        = useState<string>("—");
  const [chain,          setChain]          = useState<Chain>("base");
  const [balLoading,     setBalLoading]     = useState(false);
  const [distributing,   setDistributing]   = useState(false);
  const [result,         setResult]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [players,        setPlayers]        = useState<Player[]>([
    { id: "1", name: "Player 1", address: "", reward: "", rank: 1 },
    { id: "2", name: "Player 2", address: "", reward: "", rank: 2 },
    { id: "3", name: "Player 3", address: "", reward: "", rank: 3 },
  ]);
  const [totalPool, setTotalPool] = useState("0.00");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!API_KEY) return;
    client.getWalletInfo().then((info: unknown) => setWalletInfo(info)).catch(() => {});
    fetchBalance("base");
  }, []);

  useEffect(() => {
    const total = players.reduce((sum, p) => sum + (parseFloat(p.reward) || 0), 0);
    setTotalPool(total.toFixed(2));
  }, [players]);

  async function fetchBalance(c: Chain) {
    setBalLoading(true);
    try {
      const res = await client.getBalance(c);
      setBalance(res.success ? (res.balance ?? "0.0000") : "—");
    } catch { setBalance("—"); }
    finally { setBalLoading(false); }
  }

  function switchChain(c: Chain) { setChain(c); fetchBalance(c); }

  // ── Player management ──────────────────────────────────────────────────────

  function addPlayer() {
    if (players.length >= 100) return;
    const next = players.length + 1;
    setPlayers(p => [...p, { id: Date.now().toString(), name: `Player ${next}`, address: "", reward: "", rank: next }]);
  }

  function removePlayer(id: string) {
    if (players.length <= 1) return;
    setPlayers(p => p.filter(x => x.id !== id).map((x, i) => ({ ...x, rank: i + 1 })));
  }

  function updatePlayer(id: string, field: keyof Player, value: string) {
    setPlayers(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));
  }

  // ── Distribute rewards ─────────────────────────────────────────────────────

  async function distributeRewards() {
    const valid = players.filter(p => p.address.trim() && p.reward && parseFloat(p.reward) > 0);
    if (!valid.length) {
      setResult({ ok: false, msg: "Add at least one player with an address and reward amount." });
      return;
    }
    setDistributing(true);
    setResult(null);
    let sent = 0;
    for (const p of valid) {
      try {
        const res = await client.send({ chain, to: p.address.trim(), amount: p.reward });
        if (res.success) sent++;
      } catch {}
    }
    setDistributing(false);
    setResult({
      ok:  sent > 0,
      msg: sent > 0
        ? `Rewards sent to ${sent} of ${valid.length} player${valid.length > 1 ? "s" : ""}!`
        : "Distribution failed — check addresses and prize pool balance.",
    });
    if (sent > 0) fetchBalance(chain);
  }

  // ── CSV import ─────────────────────────────────────────────────────────────

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines  = (ev.target?.result as string).split("\n").filter(Boolean);
      const parsed = lines
        .map(l => l.split(",").map(s => s.trim()))
        .filter(c => c.length >= 2 && c[0])
        .slice(0, 100)
        .map(([address, reward, name], i) => ({
          id: `csv-${i}-${Date.now()}`, address, reward: reward ?? "",
          name: name ?? `Player ${i + 1}`, rank: i + 1,
        }));
      if (parsed.length) setPlayers(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const address = walletInfo?.addresses?.[chain] ?? walletInfo?.addresses?.base ?? null;
  const fluidId = walletInfo?.fluidId ?? null;
  const balNum  = parseFloat(balance) || 0;
  const poolNum = parseFloat(totalPool) || 0;
  const canPay  = balNum >= poolNum && poolNum > 0;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        background: `${T.surface}cc`,
        borderBottom: `1px solid ${T.border}`,
        backdropFilter: "blur(12px)",
        padding: "0 2rem",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🎮</span>
            <span style={{
              fontSize: 17, fontWeight: 900, letterSpacing: "-0.5px",
              background: `linear-gradient(90deg, ${T.purple}, ${T.cyan})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Game Studio
            </span>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, color: T.purple,
            background: `${T.purple}18`, border: `1px solid ${T.purple}44`,
            padding: "2px 8px", borderRadius: 20, letterSpacing: "0.06em",
          }}>
            POWERED BY FLUID WALLET
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: T.muted }}>{STUDIO}</span>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: API_KEY ? T.green : T.red,
            boxShadow: API_KEY ? `0 0 6px ${T.green}` : "none",
            display: "inline-block",
          }} />
        </div>
      </header>

      {/* ── API key warning ───────────────────────────────────────────────── */}
      {!API_KEY && (
        <div style={{ background: `${T.yellow}18`, borderBottom: `1px solid ${T.yellow}44`, padding: "8px 2rem", fontSize: 12, color: T.yellow }}>
          ⚠ No API key — set <code>VITE_FLUID_API_KEY</code> in <code>.env.local</code> to go live.
        </div>
      )}

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <main style={{
        maxWidth: 1100,
        margin: "2rem auto",
        padding: "0 1.5rem",
        display: "grid",
        gridTemplateColumns: "300px 1fr",
        gap: "1.5rem",
        alignItems: "start",
      }}>

        {/* ── Left: Prize Pool Treasury ─────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Treasury card */}
          <section style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: "1.5rem",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Glow accent */}
            <div style={{
              position: "absolute", top: -40, right: -40, width: 120, height: 120,
              background: `radial-gradient(circle, ${T.purple}33, transparent 70%)`,
              pointerEvents: "none",
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.25rem" }}>
              <span style={{ fontSize: 16 }}>💰</span>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: T.text, margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Prize Pool Treasury
              </h2>
            </div>

            {/* Balance */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Available Balance
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{
                  fontSize: 28, fontWeight: 900, fontVariantNumeric: "tabular-nums",
                  background: balLoading ? "none" : `linear-gradient(90deg, ${T.cyan}, ${T.purple})`,
                  WebkitBackgroundClip: balLoading ? "unset" : "text",
                  WebkitTextFillColor: balLoading ? T.muted : "transparent",
                  color: balLoading ? T.muted : undefined,
                }}>
                  {balLoading ? "···" : balance}
                </span>
                <select
                  value={chain}
                  onChange={e => switchChain(e.target.value as Chain)}
                  style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: "3px 8px", fontSize: 11,
                    color: T.text, cursor: "pointer", outline: "none",
                  }}
                >
                  <option value="base">BASE</option>
                  <option value="ethereum">ETH</option>
                  <option value="solana">SOL</option>
                </select>
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>USDC</div>
            </div>

            {/* Pool required */}
            <div style={{
              background: T.surface, borderRadius: 8, padding: "0.6rem 0.75rem",
              border: `1px solid ${canPay ? T.green + "44" : poolNum > 0 ? T.red + "44" : T.border}`,
              marginBottom: "1rem",
            }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Total Rewards Queued
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: poolNum > 0 ? (canPay ? T.green : T.red) : T.muted, fontVariantNumeric: "tabular-nums" }}>
                {totalPool} USDC
              </span>
              {poolNum > 0 && !canPay && (
                <div style={{ fontSize: 10, color: T.red, marginTop: 3 }}>⚠ Insufficient balance</div>
              )}
              {canPay && (
                <div style={{ fontSize: 10, color: T.green, marginTop: 3 }}>✓ Ready to distribute</div>
              )}
            </div>

            {/* Address */}
            {address && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Treasury Address
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <code style={{ fontSize: 10, color: T.muted, wordBreak: "break-all", flex: 1, lineHeight: 1.5 }}>
                    {address}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(address)}
                    style={{
                      background: "none", border: `1px solid ${T.border}`,
                      borderRadius: 4, padding: "2px 6px", fontSize: 9,
                      color: T.muted, cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {fluidId && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                  Fluid ID
                </div>
                <span style={{ fontSize: 12, color: T.purple, fontWeight: 700 }}>{fluidId}</span>
              </div>
            )}

            <GlowBtn color={T.cyan} fullWidth disabled={!API_KEY} onClick={() => alert("Faucet: testnet USDC incoming!")}>
              ⛽ Fund Treasury (Testnet)
            </GlowBtn>
          </section>

          {/* Stats card */}
          <section style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: "1.25rem",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
              Tournament Stats
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
              <StatBadge label="Players"     value={String(players.length)}            color={T.purple} />
              <StatBadge label="Prize Pool"  value={`${totalPool} USDC`}               color={T.cyan} />
              <StatBadge label="Avg Reward"  value={players.length ? `${(poolNum / players.length).toFixed(2)}` : "0.00"} color={T.yellow} />
              <StatBadge label="Network"     value={chain.toUpperCase()}                color={T.green} />
            </div>
          </section>
        </div>

        {/* ── Right: Player Rewards ─────────────────────────────────────── */}
        <section style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: "1.5rem",
        }}>

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🏆</span>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: T.text, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Player Rewards
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="file" ref={fileRef} accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
              <GlowBtn size="sm" color={T.muted} onClick={() => fileRef.current?.click()}>
                Import CSV
              </GlowBtn>
              <GlowBtn size="sm" color={T.purple} onClick={addPlayer} disabled={players.length >= 100}>
                + Add Player
              </GlowBtn>
            </div>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "36px 1fr 1fr 130px 64px",
            gap: 8, marginBottom: 8,
            padding: "0 0.25rem",
          }}>
            {["Rank", "Player Name", "Wallet Address", "Reward (USDC)", ""].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
            ))}
          </div>

          {/* Player rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
            {players.map(p => (
              <div key={p.id} style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 1fr 130px 64px",
                gap: 8, alignItems: "center",
                background: T.surface,
                border: `1px solid ${p.rank === 1 ? T.yellow + "44" : p.rank === 2 ? T.muted + "44" : p.rank === 3 ? "#b45309" + "44" : T.border}`,
                borderRadius: 8, padding: "0.4rem 0.5rem",
              }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <RankBadge rank={p.rank} />
                </div>
                <input
                  value={p.name}
                  onChange={e => updatePlayer(p.id, "name", e.target.value)}
                  placeholder="Player name"
                  style={{
                    background: "transparent", border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: "0.3rem 0.5rem",
                    fontSize: 12, color: T.text, outline: "none", width: "100%",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  value={p.address}
                  onChange={e => updatePlayer(p.id, "address", e.target.value)}
                  placeholder="0x… or wallet address"
                  style={{
                    background: "transparent", border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: "0.3rem 0.5rem",
                    fontSize: 11, color: T.muted, outline: "none", width: "100%",
                    boxSizing: "border-box", fontFamily: "monospace",
                  }}
                />
                <input
                  type="number"
                  value={p.reward}
                  onChange={e => updatePlayer(p.id, "reward", e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  style={{
                    background: "transparent", border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: "0.3rem 0.5rem",
                    fontSize: 12, color: T.cyan, outline: "none", width: "100%",
                    boxSizing: "border-box", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                  }}
                />
                <GlowBtn size="sm" color={T.red} onClick={() => removePlayer(p.id)} disabled={players.length <= 1}>
                  ✕
                </GlowBtn>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: "1.25rem", paddingTop: "1rem",
            borderTop: `1px solid ${T.border}`,
          }}>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <StatBadge label="Players queued" value={String(players.filter(p => p.address && p.reward).length)} color={T.purple} />
              <StatBadge label="Total payout"   value={`${totalPool} USDC`} color={T.cyan} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              {result && (
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: result.ok ? T.green : T.red,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {result.ok ? "🎉" : "⚠"} {result.msg}
                </div>
              )}
              <GlowBtn
                size="lg"
                color={canPay && API_KEY ? T.purple : T.muted}
                onClick={distributeRewards}
                disabled={distributing || !API_KEY || !canPay}
              >
                {distributing ? "⚡ Distributing…" : "⚡ Distribute Rewards"}
              </GlowBtn>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ textAlign: "center", padding: "2rem 1rem 3rem", fontSize: 11, color: T.dim }}>
        <a href="https://fluidnative.com" target="_blank" rel="noreferrer" style={{ color: T.muted, textDecoration: "none" }}>fluidnative.com</a>
        {" · "}
        <a href="https://www.npmjs.com/package/@fluidwalletbase/wallet-endpoints" target="_blank" rel="noreferrer" style={{ color: T.muted, textDecoration: "none" }}>npm</a>
        {" · "}
        <a href="https://github.com/fluidbase9/fluid-wallet-endpoints" target="_blank" rel="noreferrer" style={{ color: T.muted, textDecoration: "none" }}>GitHub</a>
      </footer>
    </div>
  );
}
