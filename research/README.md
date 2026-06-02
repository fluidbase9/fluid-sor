# Ganji's DeFi SOR Protocol — Research Materials

**Paper:** Ganji's DeFi SOR Protocol: Multi-Venue Smart Order Routing for Human and Agent-Native Crypto Swaps on Base  
**Authors:** Abhijeeth Ganji (M.S. Data Science, Maryville University of St. Louis), Priyanka Velpula (Ex-Wipro)  
**Contract:** `0xF24daF8Fe15383fb438d48811E8c4b43749DafAE` on Base Mainnet (Chain ID: 8453)  
**MVP:** [fluidnative.com](https://fluidnative.com)  
**Dataset:** [kaggle.com/datasets/abhijeethganji9/ganji-defi-sor-protocol](https://www.kaggle.com/datasets/abhijeethganji9/ganji-defi-sor-protocol)

---

## Public SOR Quote Endpoint (no API key required)

```
GET https://fluidnative.com/api/sor/public-quote?tokenIn=USDC&tokenOut=USDT&amountIn=1000
```

Supported pairs: `USDC/USDT`, `USDC/WETH`, `USDT/USDC`, `WETH/USDC`  
Rate limit: 30 req/min per IP

**Example:**
```bash
curl "https://fluidnative.com/api/sor/public-quote?tokenIn=USDC&tokenOut=USDT&amountIn=1000"
```

---

## Contents

| File | Description |
|------|-------------|
| `dataset/generate_sor_dataset.js` | Generates 265,000-row simulation dataset (Node.js, zero deps) |
| `dataset/CODEBOOK.txt` | Full column-by-column documentation for all 10 CSV files |
| `dataset/README.txt` | Dataset overview and citation |
| `dataset/dataset-metadata.json` | Kaggle metadata (title, license, keywords) |
| `benchmarks/fadp_sor_benchmark.ts` | Real benchmark: measures actual SOR latency vs paper targets |
| `Ganji_SOR_Protocol_Presentation.pptx` | 12-slide research presentation |

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Route discovery (warm cache) | **47.5 ms** mean |
| End-to-end latency | **~280 ms** |
| REI score (stablecoin) | **0.9994** |
| REI score (volatile) | **0.9982** |
| VCS score | **~0.85** |
| Price improvement | **+2.4 bps** vs single-venue |
| Agent throughput | **10²–10³ intents/min** |
| BF convergence | **\|V\|≈200, \|E\|≈1500, <50ms** |

---

## Run the Dataset Generator

```bash
node dataset/generate_sor_dataset.js
# Generates 265,000 rows across 10 CSV files in ~2 seconds
```

## Run the Benchmark

```bash
npx tsx benchmarks/fadp_sor_benchmark.ts --sor-only
```

---

## Citation

```
Ganji, Abhijeeth; Velpula, Priyanka, 2026,
"Ganji's DeFi SOR Protocol — Large Scale Research Dataset"
Kaggle: kaggle.com/datasets/abhijeethganji9/ganji-defi-sor-protocol
GitHub: github.com/fluidbase9/fluid-sor
License: CC BY 4.0
```
