# @fluidwalletbase/sdk

> Scaffold a production-ready swap interface powered by the **Fluid Smart Order Router** on Base mainnet — in one command.

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
2. **Base wallet private key** (`0x...`) — export from MetaMask → Account Details → Export Private Key

Both are written into `.env.local` automatically. A `.gitignore` is created to protect your private key.

```bash
cd my-swap-app
npm run dev
# → http://localhost:5173
```

---

## What you get

| Feature | Detail |
|---|---|
| **Live DEX price indexing** | Routes fetched from Fluid AMM, Uniswap V3, Aerodrome simultaneously |
| **Best price auto-selected** | All venues compared — best output highlighted with "Best" badge |
| **Two-stage swap flow** | "Route via FluidSOR" → inspect routes → "Execute Swap via \<venue\>" |
| **FluidSOR contract** | Calls `FluidSOR.sol` on Base mainnet — routes the swap to the winning venue's contract |
| **Split routing** | Order splitting across two venues to minimise slippage |
| **Direct wallet signing** | viem + private key — no MetaMask popup, no wallet extension needed |
| **USDC balance display** | Live balance via `FluidWalletClient.getBalance()` from `@fluidwalletbase/wallet-endpoints` |
| **Token selector** | USDC · USDT · WETH on Base — click token button to switch |
| **Zero config** | Works out of the box with two env vars |

---

## How the swap flow works

```
Developer enters amount
        │
        ▼
[ Route via FluidSOR ]   ← calls FluidWalletClient.getQuote()
        │                   indexes all venues simultaneously
        │
        ▼
  Ranked routes shown:
  ◈ Fluid AMM     0.03521 WETH  ← Best
  🦄 Uniswap V3   0.03518 WETH
  ⑂ Split 60/40  0.03519 WETH
        │
        ▼  (developer picks a route)
        │
[ Execute Swap via Fluid AMM ]   ← viem signs ERC-20 approve + swap
        │                           FluidSOR contract calls Fluid AMM contract
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
VITE_FLUID_PRIVATE_KEY=0x...

# Pre-filled — FluidSOR is live on Base mainnet
VITE_FLUID_SOR_ADDRESS=0xF24daF8Fe15383fb438d48811E8c4b43749DafAE
```

Get your API key at [fluidnative.com → Developer Console → API Keys](https://fluidnative.com).
Your private key: MetaMask → Account Details → Export Private Key.

---

## Project structure

```
my-swap-app/
├── src/
│   ├── main.tsx        # React root (no wallet provider needed)
│   ├── App.tsx         # Root layout + header + footer links
│   ├── FluidSwap.tsx   # Swap widget — FluidWalletClient + viem signing
│   ├── config.ts       # Contract addresses, token registry, env vars
│   └── index.css       # Base styles
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
const quote = await client.getQuote("USDC", "WETH", "100");
const best  = quote.routes[0];
// → { venue: "Fluid AMM", amountOut: "0.03521", badge: "Best" }

// Relay a signed USDC send
const result = await client.send({ chain: "base", to: "0x...", amount: "10", signedTx: "0x..." });

// Relay a signed FluidSOR swap
const result = await client.swap({ tokenIn: "USDC", tokenOut: "WETH", amountIn: "100", amountOut: best.amountOut, signedTx: "0x..." });
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

### Add a token

```ts
// src/config.ts
export const TOKENS = {
  DAI: {
    symbol:   "DAI",
    address:  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
    color:    "#F5AC37",
  },
  // ...
};
```

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
