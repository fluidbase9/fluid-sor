# fluid-sor

> Smart Order Routing for autonomous agents on Base Mainnet — multi-venue, split-route, MEV-protected.

[![Base](https://img.shields.io/badge/chain-Base%20Mainnet-0052FF)](https://base.org)
[![npm](https://img.shields.io/npm/v/@fluidwalletbase/wallet-endpoints.svg)](https://www.npmjs.com/package/@fluidwalletbase/wallet-endpoints)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](./LICENSE)
[![Agent Economy](https://img.shields.io/badge/Agent_Economy-Ready-ff6b35)](https://fluidnative.com)

**Contract:** `0xF24daF8Fe15383fb438d48811E8c4b43749DafAE` — Base Mainnet (Chain ID: 8453)  
**Paper:** Ganji's DeFi SOR Protocol: Multi-Venue Smart Order Routing for Human and Agent-Native Crypto Swaps on Base  
**Authors:** Abhijeeth Ganji (Maryville University), Priyanka Velpula (Ex-Wipro)

---

## What's inside

| File | What it does |
|------|-------------|
| `contracts/` | FluidSOR smart contract on Base Mainnet |
| `packages/` | `@fluidwalletbase/wallet-endpoints` — SDK for quotes and swaps |
| `bin/` | CLI scaffold for swap apps |

---

## Quick start

```bash
# 1. Clone the repo
git clone https://github.com/fluidbase9/fluid-sor
cd fluid-sor

# 2. Install dependencies
npm install

# 3. Create a free Fluid Wallet account + generate your Agent Key
#    → go to fluidnative.com → sign up
#    → Settings → Agent Keys → Create Key
#    → select scopes: read, swap
#    → copy your key: fk_...
#    → add to your shell:
echo 'export FLUID_AGENT_KEY=fk_your_key_here' >> ~/.zshrc
source ~/.zshrc

# 4. Run a quote (no key needed — public endpoint)
curl "https://fluidnative.com/api/sor/public-quote?tokenIn=USDC&tokenOut=USDT&amountIn=1000"

# 5. Execute a swap (Agent Key required)
curl -X POST https://fluidnative.com/v1/agents/swap \
  -H "X-Agent-Key: $FLUID_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fromToken":"USDC","toToken":"USDT","amount":"100"}'
```

---

## Keys

| Key | How you get it | Used for |
|-----|---------------|----------|
| `FLUID_AGENT_KEY` (`fk_...`) | [fluidnative.com](https://fluidnative.com) → Settings → Agent Keys → Create Key | Authenticated SOR quotes + swap execution |
| None needed | Built-in, rate-limited | Public read-only quotes via `/api/sor/public-quote` |

**Scopes**

| Scope | What it allows |
|-------|---------------|
| `read` | Price quotes, route discovery, gas estimates |
| `swap` | Execute token swaps via the SOR contract |

---

## Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/sor/public-quote` | None | Ranked route quotes — 30 req/min, no key |
| `POST /v1/agents/quote-swap` | `read` scope | Authenticated quote with higher rate limits |
| `POST /v1/agents/swap` | `swap` scope | Execute swap via SOR on Base Mainnet |
| `POST /v1/agents/estimate-gas` | `read` scope | Gas estimate for a swap |

**Supported pairs:** `USDC/USDT` · `USDC/WETH` · `USDT/USDC` · `WETH/USDC`

---

## The SOR routing flow

```
agent calls  →  GET /api/sor/public-quote?tokenIn=USDC&tokenOut=USDT&amountIn=1000
                     ↓
Ganji SOR   →  GanjiRoute-BellmanFord scans 18+ venues
               |V|≈200, |E|≈1500, convergence <50ms
                     ↓
SOR returns →  ranked routes: Fluid AMM, Uniswap V3, Aerodrome, split routes
               { bestVenue: "Fluid AMM + Uniswap V3 (60/40)", bestAmountOut: "999.90" }
                     ↓
agent swaps →  POST /v1/agents/swap
               X-Agent-Key: fk_...
               { fromToken: "USDC", toToken: "USDT", amount: "1000" }
                     ↓
SOR executes → on-chain via 0xF24daF8Fe15383fb438d48811E8c4b43749DafAE
               MEV-protected · Pauli Proof attached · VER score ≥ 0.998
```

---

## Code examples

### Python — quote + swap

```python
import requests, os

KEY = os.environ["FLUID_AGENT_KEY"]
BASE = "https://fluidnative.com"

# 1. Get best route (no key needed)
quote = requests.get(f"{BASE}/api/sor/public-quote", params={
    "tokenIn": "USDC", "tokenOut": "USDT", "amountIn": "1000"
}).json()
print(quote["bestVenue"], "→", quote["bestAmountOut"])

# 2. Execute swap (key required)
swap = requests.post(f"{BASE}/v1/agents/swap",
    headers={"X-Agent-Key": KEY, "Content-Type": "application/json"},
    json={"fromToken": "USDC", "toToken": "USDT", "amount": "1000", "slippage": "0.5"}
).json()
print(swap)
```

### JavaScript / Node.js

```js
import { FluidWalletClient } from "@fluidwalletbase/wallet-endpoints";

const client = new FluidWalletClient({ apiKey: process.env.FLUID_AGENT_KEY });

// Quote
const quote = await client.quoteSwap({ fromToken: "USDC", toToken: "USDT", amount: "1000" });
console.log(quote.bestVenue, quote.bestAmountOut);

// Swap
const result = await client.swap({ fromToken: "USDC", toToken: "USDT", amount: "1000" });
console.log(result.txHash);
```

### Install the SDK

```bash
npm install @fluidwalletbase/wallet-endpoints
```

### Scaffold a full swap app

```bash
npx @fluidwalletbase/sdk create my-sor-app
cd my-sor-app
npm install
npm run dev
```

---

## Key metrics (from paper)

| Metric | Value |
|--------|-------|
| Route discovery (warm cache) | **47.5 ms** |
| End-to-end latency | **~280 ms** |
| Price improvement | **+2.4 bps** vs single venue |
| REI score (stablecoin) | **0.9994** |
| REI score (volatile) | **0.9982** |
| VCS score | **~0.85** (18+ venues, 4 chains) |
| BF convergence | **<50 ms** (|V|≈200, |E|≈1500) |
| Agent throughput | **10²–10³ intents/min** |
| MEV protection | **88% detection**, 95% prevention |

---

## Research dataset

265,000-row simulation dataset validating all paper metrics across 10 CSV files.

📊 [kaggle.com/datasets/abhijeethganji9/ganji-defi-sor-protocol](https://www.kaggle.com/datasets/abhijeethganji9/ganji-defi-sor-protocol)

---

## Related

| Repo / Package | Description |
|----------------|-------------|
| [fluid-agent-demo](https://github.com/fluidbase9/fluid-agent-demo) | Full agent demo with FADP payment flow |
| [`@fluidwalletbase/wallet-endpoints`](https://npmjs.com/package/@fluidwalletbase/wallet-endpoints) | SDK — quotes, swaps, balance |
| [`@fluidwalletbase/sdk`](https://npmjs.com/package/@fluidwalletbase/sdk) | CLI scaffold |
| [fluidnative.com](https://fluidnative.com) | Get your Agent Key + dashboard |

---

## License

MIT — [Fluid Wallet](https://fluidnative.com)
