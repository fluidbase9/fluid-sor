# @fluidwalletbase/sdk

> Scaffold a production-ready swap interface powered by the **Fluid Smart Order Router** on Base mainnet — in one command.

[![npm version](https://img.shields.io/npm/v/@fluidwalletbase/sdk.svg)](https://www.npmjs.com/package/@fluidwalletbase/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](./LICENSE)

---

## Quick start

```bash
npx @fluidwalletbase/sdk create my-swap-app
cd my-swap-app
```

That's it. A fully-wired React + TypeScript swap app opens in seconds.

---

## What you get

| Feature | Detail |
|---|---|
| **Wallet connection** | wagmi v2 + viem — injected (MetaMask, Coinbase) & WalletConnect |
| **FluidSOR swap** | Calls `FluidSOR.sol` on Base mainnet |
| **Multi-venue routing** | Fluid Stable AMM · Uniswap V3 · Aerodrome |
| **Split routing** | Order splitting across two venues to minimise slippage |
| **Live quotes** | Fetches ranked routes from the Fluid SOR API |
| **Connect to Fluid** | Link to [fluidnative.com](https://fluidnative.com) |
| **Zero config** | Works out of the box; one env variable to go live |

---

## Step-by-step setup

### 1. Create your project

```bash
npx @fluidwalletbase/sdk create my-swap-app
cd my-swap-app
```

### 2. Configure your environment

The **FluidSOR contract is already deployed on Base mainnet** by the Fluid Wallet team — no deployment needed.

```bash
# .env.local
VITE_FLUID_SOR_ADDRESS=0x000000000000000000000000000000000000dEaD  # replace with live address from fluidnative.com

# Optional — for WalletConnect support
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

Get the latest deployed contract address at [fluidnative.com](https://fluidnative.com).

Get a free WalletConnect project ID at [cloud.walletconnect.com](https://cloud.walletconnect.com).

### 3. Start the dev server

```bash
npm run dev
# → http://localhost:5173
```

### 4. Build for production

```bash
npm run build
```

---

## Project structure

```
my-swap-app/
├── src/
│   ├── main.tsx        # Wagmi + React Query providers
│   ├── App.tsx         # Root layout
│   ├── FluidSwap.tsx   # Swap widget — the main component
│   ├── config.ts       # Contract addresses, token registry, wagmi config
│   └── index.css       # Base styles
├── index.html
├── vite.config.ts
├── tsconfig.json
└── .env.local          # Your secrets (gitignored)
```

---

## Customising the swap widget

### Add a new token

Edit `src/config.ts`:

```ts
export const TOKENS = {
  // ...existing tokens
  DAI: {
    symbol:   "DAI",
    address:  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
    color:    "#F5AC37",
  },
};
```

### Change default slippage

In `src/FluidSwap.tsx`:

```ts
const [slippage, setSlippage] = useState(0.3); // 0.3%
```

### Use a custom RPC

In `src/config.ts`:

```ts
import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http("https://your-rpc-endpoint.com") },
  // ...
});
```

---

## FluidSOR contract

The swap widget calls the **FluidSOR** smart contract deployed on Base mainnet.
Source: [`contracts/FluidSOR.sol`](https://github.com/fluidbase9/fluid-sor/blob/main/contracts/FluidSOR.sol)

### Key functions

| Function | Description |
|---|---|
| `swapViaFluid(...)` | Swap through Fluid Stable AMM (USDC ↔ USDT) |
| `swapViaUniV3(...)` | Swap through Uniswap V3 pool |
| `swapViaAerodrome(...)` | Swap through Aerodrome Finance |
| `splitSwapFluidUniV3(...)` | Split order: Fluid AMM + Uniswap V3 |
| `getFluidQuote(...)` | On-chain view quote from Fluid AMM |

---

## Publishing your own package

If you fork this SDK and want to publish to npm:

```bash
# 1. Log in (one-time setup)
npm login

# 2. Publish
npm publish --access public
```

---

## Resources

| | |
|---|---|
| Website | [fluidnative.com](https://fluidnative.com) |
| GitHub | [github.com/fluidbase9/fluid-sor](https://github.com/fluidbase9/fluid-sor) |
| npm | [npmjs.com/package/@fluidwalletbase/sdk](https://www.npmjs.com/package/@fluidwalletbase/sdk) |
| Issues | [github.com/fluidbase9/fluid-sor/issues](https://github.com/fluidbase9/fluid-sor/issues) |

---

## License

MIT © [Fluid Wallet](https://fluidnative.com)
