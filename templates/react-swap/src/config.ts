import { base, mainnet } from "viem/chains";

// ─── Chains (all mainnet) ─────────────────────────────────────────────────────

export const CHAIN        = base;     // Base mainnet  (chain ID 8453)
export const ETH_CHAIN    = mainnet;  // Ethereum mainnet (chain ID 1)

// Public mainnet RPC endpoints — override via VITE_BASE_RPC_URL / VITE_ETH_RPC_URL
export const BASE_RPC_URL = (import.meta.env.VITE_BASE_RPC_URL as string) || "https://mainnet.base.org";
export const ETH_RPC_URL  = (import.meta.env.VITE_ETH_RPC_URL  as string) || "https://ethereum.publicnode.com";

// ─── FluidSOR contract ────────────────────────────────────────────────────────

/** FluidSOR contract address on Base mainnet. Set via VITE_FLUID_SOR_ADDRESS. */
export const FLUID_SOR_ADDRESS =
  (import.meta.env.VITE_FLUID_SOR_ADDRESS as string) ||
  "0xF24daF8Fe15383fb438d48811E8c4b43749DafAE";

export const IS_DEPLOYED =
  FLUID_SOR_ADDRESS !== "0x0000000000000000000000000000000000000000";

/**
 * Fluid SDK API key — required to call the SOR quote endpoint.
 * Derive yours at fluidnative.com → Developer Console → API Keys tab.
 * Add to .env.local:  VITE_FLUID_API_KEY=fw_sor_...
 */
export const FLUID_API_KEY = import.meta.env.VITE_FLUID_API_KEY as string | undefined;

/**
 * Your Base wallet private key — OPTIONAL.
 * Only needed to execute swaps. Quoting and balance work without it.
 * ⚠ NEVER commit this to git. Keep it in .env.local only.
 * Add to .env.local:  VITE_FLUID_PRIVATE_KEY=0x...
 */
export const FLUID_PRIVATE_KEY = import.meta.env.VITE_FLUID_PRIVATE_KEY as string | undefined;

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
