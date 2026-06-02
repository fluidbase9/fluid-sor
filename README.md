# Ganji's DeFi SOR Protocol

**Smart Order Routing for autonomous agents and developers on Base Mainnet.**

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](./LICENSE)
[![Base Mainnet](https://img.shields.io/badge/Base-Mainnet-0052FF)](https://base.org)
[![npm](https://img.shields.io/npm/v/@fluidwalletbase/sdk.svg)](https://www.npmjs.com/package/@fluidwalletbase/sdk)

**Contract:** `0xF24daF8Fe15383fb438d48811E8c4b43749DafAE` — Base Mainnet (Chain ID: 8453)  
**Paper:** Ganji's DeFi SOR Protocol: Multi-Venue Smart Order Routing for Human and Agent-Native Crypto Swaps on Base  
**Authors:** Abhijeeth Ganji (Maryville University), Priyanka Velpula (Ex-Wipro)

---

## Public Quote Endpoint — No API Key Required

```bash
GET https://fluidnative.com/api/sor/public-quote
```

**Parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `tokenIn` | ✅ | Source token: `USDC`, `USDT`, `WETH`, `ETH` |
| `tokenOut` | ✅ | Destination token |
| `amountIn` | ✅ | Amount as a number string |

**Supported pairs:** `USDC/USDT` · `USDC/WETH` · `USDT/USDC` · `WETH/USDC`

**Rate limit:** 30 requests/minute per IP

---

### curl

```bash
curl "https://fluidnative.com/api/sor/public-quote?tokenIn=USDC&tokenOut=USDT&amountIn=1000"
```

### Python

```python
import requests

resp = requests.get("https://fluidnative.com/api/sor/public-quote", params={
    "tokenIn":  "USDC",
    "tokenOut": "USDT",
    "amountIn": "1000"
})
data = resp.json()
print(data["bestVenue"])       # "Fluid AMM + Uniswap V3 (60/40 split)"
print(data["bestAmountOut"])   # "999.90"
print(data["routes"])          # all ranked routes
```

### JavaScript / Node.js

```js
const res = await fetch(
  "https://fluidnative.com/api/sor/public-quote?tokenIn=USDC&tokenOut=USDT&amountIn=1000"
);
const { bestVenue, bestAmountOut, routes } = await res.json();
console.log(bestVenue, bestAmountOut);
```

### Response

```json
{
  "protocol":    "Ganji SOR Protocol",
  "contract":    "0xF24daF8Fe15383fb438d48811E8c4b43749DafAE",
  "chain":       "Base Mainnet",
  "chainId":     8453,
  "tokenIn":     "USDC",
  "tokenOut":    "USDT",
  "amountIn":    "1000",
  "bestVenue":   "Fluid AMM + Uniswap V3 (60/40 split)",
  "bestAmountOut": "999.90",
  "splitRouteAvailable": true,
  "routes": [
    {
      "venue":          "Fluid AMM + Uniswap V3 (60/40 split)",
      "amountOut":      "999.90",
      "priceImpactBps": "0.1",
      "gasEstimateUsd": "0.06",
      "splitBps":       6000,
      "badge":          "Max Saving",
      "recommended":    true
    },
    {
      "venue":          "Fluid Stable AMM",
      "amountOut":      "999.60",
      "priceImpactBps": "0.2",
      "gasEstimateUsd": "0.03",
      "badge":          "Fluid Best"
    },
    {
      "venue":          "Uniswap V3",
      "amountOut":      "999.30",
      "priceImpactBps": "0.7",
      "gasEstimateUsd": "0.04",
      "badge":          "Lowest Gas"
    },
    {
      "venue":          "Aerodrome Stable",
      "amountOut":      "999.10",
      "priceImpactBps": "0.9",
      "gasEstimateUsd": "0.03"
    }
  ],
  "rateLimit": { "remaining": 29, "resetAt": 1748880000000 },
  "timestamp": 1748879940000,
  "docs": "github.com/fluidbase9/fluid-sor"
}
```

---

## SDK Setup — Execute Swaps (API Key Required)

Get a free API key at **[fluidnative.com](https://fluidnative.com)**

### Install

```bash
npm install @fluidwalletbase/wallet-endpoints
```

### Quote + Swap

```js
import { FluidWalletClient } from "@fluidwalletbase/wallet-endpoints";

const client = new FluidWalletClient({ apiKey: "fk_your_key_here" });

// Get a quote
const quote = await client.quoteSwap({
  fromToken: "USDC",
  toToken:   "USDT",
  amount:    "1000"
});

// Execute the swap
const result = await client.swap({
  fromToken: "USDC",
  toToken:   "USDT",
  amount:    "1000",
  slippage:  "0.5"
});

console.log(result.txHash);
```

### Scaffold a full swap app

```bash
npx @fluidwalletbase/sdk create my-swap-app
cd my-swap-app
npm install
npm run dev
```

---

## Key Metrics (from paper)

| Metric | Value |
|--------|-------|
| Route discovery (warm cache) | **47.5 ms** |
| End-to-end latency | **~280 ms** |
| Price improvement | **+2.4 bps** vs single venue |
| REI score (stablecoin) | **0.9994** |
| REI score (volatile) | **0.9982** |
| Bellman-Ford convergence | **<50 ms** (\|V\|≈200, \|E\|≈1500) |
| Agent throughput | **10²–10³ intents/min** |
| Venues | **18+ DEXs** across 4 chains |
| MEV protection | **88% detection**, 95% prevention |

---

## Research Dataset

265,000-row simulation dataset validating all paper metrics.

📊 **Kaggle:** [kaggle.com/datasets/abhijeethganji9/ganji-defi-sor-protocol](https://www.kaggle.com/datasets/abhijeethganji9/ganji-defi-sor-protocol)

---

## License

MIT — free to use, modify, and distribute.
