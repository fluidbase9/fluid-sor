# @fluidwalletbase/sdk

> Scaffold a production-ready swap interface powered by the **Fluid Smart Order Router** — identical UI to the Fluid SOR page, in one command.

[![npm version](https://img.shields.io/npm/v/@fluidwalletbase/sdk.svg)](https://www.npmjs.com/package/@fluidwalletbase/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](./LICENSE)

---

## Packages

| Package | Description |
|---|---|
| [`@fluidwalletbase/sdk`](https://www.npmjs.com/package/@fluidwalletbase/sdk) | CLI scaffold — creates a full swap app in one command |
| [`@fluidwalletbase/wallet-endpoints`](https://www.npmjs.com/package/@fluidwalletbase/wallet-endpoints) | Developer SDK — `FluidWalletClient` for balance, quotes, send, swap |

---

## Quick start

```bash
npx @fluidwalletbase/sdk create my-swap-app
```

The CLI will interactively ask for:
1. **Fluid API key** (`fw_sor_...`) — get it at [fluidnative.com → Developer Console → API Keys](https://fluidnative.com)
2. **12-word seed phrase** — your signing key is derived automatically (BIP-44 `m/44'/60'/0'/0/0`), no MetaMask needed

Both are written into `.env.local` automatically. A `.gitignore` is created to protect your keys.

```
# [1/5] Fluid API key setup
# ? Paste API key (fw_sor_...): fw_sor_...
#
# [2/5] Wallet setup — derive signing key from seed phrase
# ? Enter seed phrase (12 words):
#   abandon word1 word2 ... word12
# ✓ Key derived from seed phrase  0x1ab42cc•••••••••••••
#   Path: m/44'/60'/0'/0/0  (standard Ethereum / Base)
#
# [3/5] Scaffolding my-swap-app…
# [4/5] Installing dependencies…
# [5/5] Writing .env.local…  ✓ API key  ✓ Signing key derived
```

```bash
cd my-swap-app
npm run dev
# → http://localhost:5173
```

---

## What you get (v1.0.20)

The scaffolded app ships the **same UI as the Fluid Smart Order Routing page** — drop it straight into your dApp.

| Feature | Detail |
|---|---|
| **Network image logos** | Base · Ethereum · Solana · Injective — hosted image buttons, not emoji |
| **25+ DEX venue logos** | Uniswap, Aerodrome, Curve, Odos, 1inch, Balancer, PancakeSwap, SushiSwap, Velodrome, KyberSwap, DODO, Bancor, Trader Joe, GMX, WOOFi, Hashflow, Maverick, Ambient, Clipper, OpenOcean + more |
| **Live scanning animation** | 25-venue sweep carousel with per-venue logo images during routing |
| **Best price auto-selected** | All venues queried simultaneously — best output highlighted with rank badges |
| **Two-stage swap flow** | "Route via FluidSOR" → inspect routes → swipe-to-confirm execution |
| **Swipe-to-confirm UX** | Drag gesture required before signing any on-chain transaction |
| **Live balance card** | Token balances across all 4 networks — refreshes automatically after swap |
| **Gas awareness** | Native gas balance check per network — warns if insufficient for execution |
| **Multi-network quoting** | Base (25 venues) · Ethereum (Uniswap V3) · Solana (Jupiter) · Injective (Helix) |
| **FluidSOR contract** | Calls `FluidSOR.sol` on Base mainnet — routes the swap to the winning venue |
| **Split routing** | Order splitting across two venues to minimise slippage |
| **Direct wallet signing** | viem + derived private key — no MetaMask popup, no wallet extension needed |
| **Fluid Intelligence branding** | Matching header with Fluid logo + Fluid Intelligence subheading |
| **Zero config** | Works out of the box after `npx @fluidwalletbase/sdk create` |

---

## How the swap flow works

```
Developer enters amount
        │
        ▼
[ Route via FluidSOR ]   ← FluidWalletClient.getQuote()
        │                   25 venues scanned simultaneously with live animation
        │
        ▼
  Ranked routes shown with venue logos:
  🖼  Fluid AMM     100.11 USDT  ← BEST
  🖼  Uniswap V3   100.08 USDT
  🖼  Aerodrome    100.05 USDT
        │
        ▼  (user swipes to confirm)
        │
[ Execute Swap via Fluid AMM ]   ← viem signs ERC-20 approve + swap
        │                           FluidSOR contract calls Fluid AMM on-chain
        ▼
  ✓ Swap confirmed — view on Basescan
```

---

## Environment variables

```bash
# .env.local  (auto-written by the CLI — gitignored)

# Required for route fetching
VITE_FLUID_API_KEY=fw_sor_...

# Required for signing swaps (⚠ never commit this)
VITE_FLUID_PRIVATE_KEY=0x...            # derived from seed phrase by CLI

# Pre-filled — FluidSOR is live on Base mainnet
VITE_FLUID_SOR_ADDRESS=0xF24daF8Fe15383fb438d48811E8c4b43749DafAE
```

Get your API key at [fluidnative.com → Developer Console → API Keys](https://fluidnative.com).

---

## Project structure

```
my-swap-app/
├── src/
│   ├── main.tsx        # React root (no wallet provider needed)
│   ├── App.tsx         # Header (Fluid logo + Fluid Intelligence branding) + footer
│   ├── FluidSwap.tsx   # Swap widget — FluidWalletClient + viem signing
│   ├── config.ts       # Network registry (with imgUrl), token registry, env vars
│   └── index.css       # Base styles + routing animations
├── index.html
├── vite.config.ts
├── tsconfig.json
├── .env.local          # Your secrets (gitignored)
└── .gitignore          # Auto-created — protects .env.local
```

---

## Using `@fluidwalletbase/wallet-endpoints` in your own project

The scaffolded app uses this package internally. You can also install it standalone:

```bash
npm install @fluidwalletbase/wallet-endpoints
```

```ts
import { FluidWalletClient } from "@fluidwalletbase/wallet-endpoints";

const client = new FluidWalletClient(
  "https://fluidnative.com",
  process.env.FLUID_API_KEY   // fw_sor_...
);

// Get USDC balance of your registered wallet
const { balance } = await client.getBalance("base");
// → "250.00"

// Get ranked swap routes from all DEXs
// Base: 25 venues · Solana: Jupiter · Ethereum: Uniswap V3 · Injective: Helix
const quote = await client.getQuote("USDC", "USDT", "100", "base");
const best  = quote.routes[0];
// → { venue: "Fluid AMM", amountOut: "100.11", badge: "Best" }

// Relay a signed USDC send
const result = await client.send({ chain: "base", to: "0x...", amount: "10", signedTx: "0x..." });

// Relay a signed FluidSOR swap
const result = await client.swap({ tokenIn: "USDC", tokenOut: "USDT", amountIn: "100", amountOut: best.amountOut, signedTx: "0x..." });
```

See [wallet-endpoints README](./packages/wallet-endpoints/README.md) for signing examples.

---

## FluidSOR contract

The swap widget calls **FluidSOR** deployed on Base mainnet:
`0xF24daF8Fe15383fb438d48811E8c4b43749DafAE`

Source: [`contracts/FluidSOR.sol`](https://github.com/fluidbase9/fluid-sor/blob/main/contracts/FluidSOR.sol)

| Function | Venue |
|---|---|
| `swapViaFluid(...)` | Fluid Stable AMM (USDC ↔ USDT) |
| `swapViaUniV3(...)` | Uniswap V3 pool |
| `splitSwapFluidUniV3(...)` | Split order across both venues |

FluidSOR selects the correct function based on the route returned by `getQuote()` — no manual selection needed.

---

## Customising the swap widget

### Change default slippage

```ts
// src/FluidSwap.tsx
const [slippage, setSlippage] = useState(0.3); // 0.3%
```

### Use a custom RPC

```ts
// src/config.ts  (and src/FluidSwap.tsx)
import { http } from "viem";
const publicClient = createPublicClient({ chain: base, transport: http("https://your-rpc.com") });
```

---

## Resources

| | |
|---|---|
| Website | [fluidnative.com](https://fluidnative.com) |
| Developer Console | [fluidnative.com → Developer Console](https://fluidnative.com) |
| GitHub | [github.com/fluidbase9/fluid-sor](https://github.com/fluidbase9/fluid-sor) |
| npm — SDK | [npmjs.com/package/@fluidwalletbase/sdk](https://www.npmjs.com/package/@fluidwalletbase/sdk) |
| npm — wallet-endpoints | [npmjs.com/package/@fluidwalletbase/wallet-endpoints](https://www.npmjs.com/package/@fluidwalletbase/wallet-endpoints) |
| Issues | [github.com/fluidbase9/fluid-sor/issues](https://github.com/fluidbase9/fluid-sor/issues) |

---

## License

MIT © [Fluid Wallet](https://fluidnative.com)
