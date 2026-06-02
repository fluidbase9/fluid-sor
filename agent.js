/**
 * Fluid SOR Demo Agent
 *
 * Uses your FLUID_AGENT_KEY (fk_...) to:
 *   1. Get a public SOR quote (no key needed)
 *   2. Get an authenticated SOR quote (read scope)
 *   3. Execute a live swap via Ganji SOR (swap scope)
 *      — checks balance first, prints full receipt with BaseScan link
 *
 * Run:  node agent.js
 */

"use strict";

require("dotenv").config();

const https = require("https");
const http  = require("http");

const FLUID_API   = process.env.FLUID_API_URL  || "https://fluidnative.com";
const AGENT_KEY   = process.env.FLUID_AGENT_KEY;
const FROM_TOKEN  = process.env.FROM_TOKEN  || "USDC";
const TO_TOKEN    = process.env.TO_TOKEN    || "USDT";
const AMOUNT      = process.env.SWAP_AMOUNT || "10";   // demo: swap $10

// ── ANSI colours ──────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m",
  red: "\x1b[31m", gray: "\x1b[90m", blue: "\x1b[34m",
};
const ok   = m => console.log(`  ${C.green}✓${C.reset}  ${m}`);
const info = m => console.log(`  ${C.cyan}→${C.reset}  ${m}`);
const warn = m => console.log(`  ${C.yellow}⚠${C.reset}  ${m}`);
const err  = m => console.log(`  ${C.red}✗${C.reset}  ${m}`);
const div  = () => console.log(`  ${C.gray}${"─".repeat(60)}${C.reset}`);

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(urlStr, opts = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url     = new URL(urlStr);
    const mod     = url.protocol === "https:" ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const req = mod.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === "https:" ? 443 : 80),
      path:     url.pathname + url.search,
      method:   opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":   "fluid-sor-agent/1.0",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(opts.headers || {}),
      },
    }, res => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end",  () => {
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function api(path, method = "GET", body = null) {
  return request(`${FLUID_API}${path}`, {
    method,
    headers: AGENT_KEY ? { "X-Agent-Key": AGENT_KEY } : {},
  }, body);
}

// ── Receipt printer ───────────────────────────────────────────────────────────
function printReceipt(body) {
  const { txHash, explorerUrl } = body || {};
  if (!txHash) return;
  console.log("");
  console.log(`  ${C.bold}${C.green}  ┌─ SWAP RECEIPT ────────────────────────────────────────┐${C.reset}`);
  console.log(`  ${C.bold}  │ Protocol:  ${C.reset}Ganji SOR — Base Mainnet (Chain 8453)`);
  console.log(`  ${C.bold}  │ Contract:  ${C.reset}0xF24daF8Fe15383fb438d48811E8c4b43749DafAE`);
  console.log(`  ${C.bold}  │ Tx Hash:   ${C.reset}${txHash}`);
  const link = explorerUrl ?? `https://basescan.org/tx/${txHash}`;
  console.log(`  ${C.bold}  │ BaseScan:  ${C.reset}${C.blue}${link}${C.reset}`);
  console.log(`  ${C.bold}${C.green}  └───────────────────────────────────────────────────────┘${C.reset}`);
  console.log("");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}  ╔══════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║     Fluid SOR Demo Agent                 ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║     Ganji's DeFi SOR Protocol            ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ╚══════════════════════════════════════════╝${C.reset}`);
  console.log(`  ${C.gray}Pair:   ${FROM_TOKEN} → ${TO_TOKEN}  |  Amount: $${AMOUNT}${C.reset}`);
  console.log(`  ${C.gray}API:    ${FLUID_API}${C.reset}\n`);

  // ── Step 1: Public quote (no key required) ────────────────────────────────
  console.log(`${C.bold}  Step 1: Public SOR Quote (no API key needed)${C.reset}`);
  div();
  info(`GET /api/sor/public-quote?tokenIn=${FROM_TOKEN}&tokenOut=${TO_TOKEN}&amountIn=${AMOUNT}`);

  const pub = await request(
    `${FLUID_API}/api/sor/public-quote?tokenIn=${FROM_TOKEN}&tokenOut=${TO_TOKEN}&amountIn=${AMOUNT}`
  );

  if (pub.status === 200) {
    const { routes = [], bestVenue, bestAmountOut, rateLimit } = pub.body;
    ok(`Best route: ${C.green}${bestVenue}${C.reset}`);
    ok(`Best out:   ${C.green}${bestAmountOut} ${TO_TOKEN}${C.reset}`);
    console.log(`\n  ${C.bold}  All Routes:${C.reset}`);
    for (const r of routes) {
      const star = r.recommended ? ` ${C.cyan}← recommended${C.reset}` : "";
      console.log(`    ${r.recommended ? C.green : C.gray}${r.venue}${C.reset}`);
      console.log(`      Out: ${r.amountOut} ${TO_TOKEN}  |  Impact: ${r.priceImpactBps} bps  |  Gas: ${r.gasEstimateUsd}${star}`);
    }
    if (rateLimit) {
      console.log(`\n  ${C.dim}  Rate limit: ${rateLimit.remaining}/30 remaining${C.reset}`);
    }
  } else {
    warn(`Public quote failed (${pub.status}): ${JSON.stringify(pub.body)}`);
  }

  // ── Step 2: Authenticated quote (read scope) ──────────────────────────────
  console.log(`\n${C.bold}  Step 2: Authenticated SOR Quote (read scope)${C.reset}`);
  div();

  if (!AGENT_KEY) {
    warn("FLUID_AGENT_KEY not set — skipping authenticated quote");
    warn("Run: rm -rf ~/.npm/_npx && npx @fluidwallet/fadp-cli@latest");
  } else {
    info(`POST /v1/agents/quote-swap`);
    const auth = await api("/v1/agents/quote-swap", "POST", {
      fromToken: FROM_TOKEN, toToken: TO_TOKEN, amount: AMOUNT,
    });
    if (auth.status === 200) {
      ok(`Authenticated quote received`);
      console.log(`  ${C.gray}${JSON.stringify(auth.body, null, 4)}${C.reset}`);
    } else {
      warn(`Auth quote failed (${auth.status}): ${JSON.stringify(auth.body)}`);
    }
  }

  // ── Step 3: Check balance ─────────────────────────────────────────────────
  console.log(`\n${C.bold}  Step 3: Wallet Balance Check${C.reset}`);
  div();

  if (!AGENT_KEY) {
    warn("FLUID_AGENT_KEY not set — skipping balance check and swap");
    console.log(`\n  ${C.dim}  Get your key: rm -rf ~/.npm/_npx && npx @fluidwallet/fadp-cli@latest${C.reset}\n`);
    console.log(`${C.green}${C.bold}  ✓  Public quote demo complete (no key needed)${C.reset}\n`);
    return;
  }

  const bal = await api("/v1/agents/balance?chain=base");
  if (bal.status === 200) {
    const { balances = [], walletAddress } = bal.body;
    console.log(`  ${C.bold}  Wallet (Base Mainnet):${C.reset}`);
    for (const b of balances) {
      const hl = b.token?.toUpperCase() === FROM_TOKEN ? C.green : C.gray;
      ok(`${hl}${b.token}: ${b.amount}${C.reset}`);
    }
    if (walletAddress) {
      console.log(`  ${C.dim}  Address: ${walletAddress}${C.reset}`);
      console.log(`  ${C.dim}  BaseScan: https://basescan.org/address/${walletAddress}${C.reset}`);
    }
    // Check if enough balance
    const usdcBal = parseFloat(balances.find(b => b.token?.toUpperCase() === FROM_TOKEN)?.amount ?? "0");
    const needed  = parseFloat(AMOUNT);
    if (usdcBal < needed) {
      warn(`Insufficient ${FROM_TOKEN}: have ${usdcBal}, need ${needed}`);
      warn(`Fund your wallet with ${FROM_TOKEN} on Base mainnet and run again`);
      console.log(`\n${C.green}${C.bold}  ✓  Demo complete (fund wallet to run live swap)${C.reset}\n`);
      return;
    }
  }

  // ── Step 4: Execute swap (swap scope) ─────────────────────────────────────
  console.log(`\n${C.bold}  Step 4: Execute Swap via Ganji SOR${C.reset}`);
  div();
  info(`POST /v1/agents/swap — ${AMOUNT} ${FROM_TOKEN} → ${TO_TOKEN}`);

  const swap = await api("/v1/agents/swap", "POST", {
    fromToken: FROM_TOKEN,
    toToken:   TO_TOKEN,
    amount:    AMOUNT,
    slippage:  "0.5",
  });

  if (swap.status === 200) {
    ok(`Swap executed via Ganji SOR!`);
    printReceipt(swap.body);
  } else {
    err(`Swap failed (${swap.status}): ${JSON.stringify(swap.body)}`);
  }

  console.log(`${C.green}${C.bold}  ✓  Agent run complete${C.reset}\n`);
}

main().catch(e => {
  console.error(`\n  ${C.red}Fatal:${C.reset}`, e.message ?? e);
  process.exit(1);
});
