import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// ─── Chain ────────────────────────────────────────────────────────────────────

export const CHAIN = base;

// ─── Wagmi config ─────────────────────────────────────────────────────────────

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

export const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
  connectors: [
    injected(),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
});

// ─── FluidSOR contract ────────────────────────────────────────────────────────

/** FluidSOR contract address on Base mainnet. Set via VITE_FLUID_SOR_ADDRESS. */
export const FLUID_SOR_ADDRESS =
  (import.meta.env.VITE_FLUID_SOR_ADDRESS as string) ||
  "0xF24daF8Fe15383fb438d48811E8c4b43749DafAE";

export const IS_DEPLOYED =
  FLUID_SOR_ADDRESS !== "0x0000000000000000000000000000000000000000";

// ─── Token registry ───────────────────────────────────────────────────────────

export interface Token {
  symbol:   string;
  address:  string;
  decimals: number;
  color:    string;
}

export const TOKENS: Record<string, Token> = {
  USDC: {
    symbol:   "USDC",
    address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    color:    "#2775CA",
  },
  USDT: {
    symbol:   "USDT",
    address:  "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    decimals: 6,
    color:    "#26A17B",
  },
  WETH: {
    symbol:   "WETH",
    address:  "0x4200000000000000000000000000000000000006",
    decimals: 18,
    color:    "#627EEA",
  },
};

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const BASE_CHAIN_ID = base.id;           // 8453
export const BASESCAN      = "https://basescan.org";
export const FLUID_SITE    = "https://fluidnative.com";
export const FLUID_GITHUB  = "https://github.com/fluidwallet/fluid-sor";
export const FLUID_NPM     = "https://www.npmjs.com/package/@fluidwallet/sdk";
