# @fluidwalletbase/wallet-endpoints

Developer SDK for the Fluid Smart Order Router — authentication, wallet generation, and USDC swap routing on Base.

**Supported chains:** Ethereum · Base · Solana
**Supported tokens:** USDC only
**Powered by:** FluidSOR smart contract (`0xF24daF8Fe15383fb438d48811E8c4b43749DafAE`)

---

## Installation

```bash
npm install @fluidwalletbase/wallet-endpoints
```

---

## Quick start

### 1. Register a developer account

Sign up at [fluidnative.com](https://fluidnative.com) or via the `/fluid-sor` homepage.

Your seed phrase is generated **in your browser** and never sent to Fluid servers.
Fluid stores only a SHA-256 hash of your derived API key.

---

### 2. Derive your API key (client-side)

```ts
import { deriveSdkApiKey, hashApiKey } from "@fluidwalletbase/wallet-endpoints";

// Done in the browser — mnemonic never leaves the device
const mnemonic   = "your twelve word seed phrase here ...";
const apiKey     = await deriveSdkApiKey(mnemonic);   // "fw_sor_..."
const keyHash    = await hashApiKey(apiKey);           // sha256(apiKey)
const keyHint    = apiKey.slice(0, 12);
```

---

### 3. Register your key and wallet addresses

```ts
import { FluidWalletClient } from "@fluidwalletbase/wallet-endpoints";

const client = new FluidWalletClient("https://fluidnative.com");

await client.registerKey(
  "you@example.com",
  keyHash,
  keyHint,
  "0xYourEthereumAddress",   // derived from same seed phrase — m/44'/60'/0'/0/0
  "0xYourBaseAddress",        // same as Ethereum (Base is EVM L2)
  "YourSolanaAddress",        // derived from same seed phrase — m/44'/501'/0'/0'
);
```

---

### 4. Get the best swap route

```ts
const client = new FluidWalletClient("https://fluidnative.com", apiKey);

const quote = await client.getQuote("USDC", "USDT", "100");
// quote.routes[0] → { venue, amountOut, priceImpact, gasEstimate, badge }
// quote.bestVenue → "Fluid Stable AMM"
```

---

### 5. Execute the swap

The quote tells you which venue and parameters to use.
You sign and broadcast the transaction with **your own wallet** (no Fluid wallet required for execution).

```ts
import { encodeFunctionData, parseUnits } from "viem";

const route   = quote.routes[0];
const amountIn = parseUnits("100", 6);   // USDC has 6 decimals
const minOut   = parseUnits(
  (parseFloat(route.amountOut) * 0.995).toFixed(6), 6   // 0.5% slippage
);

// Step 1: approve FluidSOR to spend your USDC
await walletClient.writeContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [FLUID_SOR_ADDRESS, amountIn],
});

// Step 2: execute swap
await walletClient.writeContract({
  address: FLUID_SOR_ADDRESS,
  abi: FLUID_SOR_ABI,
  functionName: "swapViaFluid",    // or swapViaUniV3 / splitSwapFluidUniV3
  args: [USDC_ADDRESS, USDT_ADDRESS, amountIn, minOut, recipientAddress, deadline],
});
```

---

## API Reference

### `FluidWalletClient`

| Method | Description |
|---|---|
| `registerKey(email, keyHash, keyHint, eth?, base?, sol?)` | Register SDK key + wallet addresses |
| `getKeyInfo(email)` | Get key status and registered wallet addresses |
| `deactivateKey(email)` | Revoke the API key |
| `getQuote(tokenIn, tokenOut, amountIn)` | Get best SOR routes (requires API key) |
| `setApiKey(key)` | Update API key at runtime |

### Helper functions

| Function | Description |
|---|---|
| `deriveSdkApiKey(mnemonic)` | Derive API key from seed phrase (client-side, HMAC-SHA256) |
| `hashApiKey(apiKey)` | SHA-256 hash of the API key (sent to server for registration) |

---

## Supported token pairs

Only USDC pairs are supported currently:

| Pair | Venue |
|---|---|
| USDC → USDT | Fluid Stable AMM (best) |
| USDT → USDC | Fluid Stable AMM (best) |
| USDC → WETH | Uniswap V3 |
| WETH → USDC | Uniswap V3 |

---

## Contract addresses (Base mainnet)

| Contract | Address |
|---|---|
| FluidSOR | `0xF24daF8Fe15383fb438d48811E8c4b43749DafAE` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDT | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` |
| WETH | `0x4200000000000000000000000000000000000006` |

---

## Security

- The seed phrase is generated in the browser and **never sent to any server**
- Fluid stores only `sha256(apiKey)` — never the key itself
- Wallet addresses are stored for identification only — Fluid cannot move your funds
- Authentication uses Firebase (industry-standard) — your password is hashed by Firebase, Fluid never sees it

---

## Links

- Homepage: [fluidnative.com/fluid-sor](https://fluidnative.com/fluid-sor)
- GitHub: [github.com/fluidbase9/fluid-sor](https://github.com/fluidbase9/fluid-sor)
- Issues: [github.com/fluidbase9/fluid-sor/issues](https://github.com/fluidbase9/fluid-sor/issues)
