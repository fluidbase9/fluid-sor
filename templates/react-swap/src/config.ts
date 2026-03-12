import { base, mainnet } from "viem/chains";

// ─── Chains ───────────────────────────────────────────────────────────────────

export const CHAIN     = base;
export const ETH_CHAIN = mainnet;

export const BASE_RPC_URL = (import.meta.env.VITE_BASE_RPC_URL as string) || "https://mainnet.base.org";
export const ETH_RPC_URL  = (import.meta.env.VITE_ETH_RPC_URL  as string) || "https://ethereum.publicnode.com";

// ─── FluidSOR contract (Base mainnet) ─────────────────────────────────────────

export const FLUID_SOR_ADDRESS =
  (import.meta.env.VITE_FLUID_SOR_ADDRESS as string) ||
  "0xF24daF8Fe15383fb438d48811E8c4b43749DafAE";

export const IS_DEPLOYED =
  FLUID_SOR_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const FLUID_API_KEY     = import.meta.env.VITE_FLUID_API_KEY     as string | undefined;
export const FLUID_PRIVATE_KEY = import.meta.env.VITE_FLUID_PRIVATE_KEY as string | undefined;

// ─── Networks ─────────────────────────────────────────────────────────────────

export type Network = "base" | "ethereum" | "solana" | "injective";

export interface NetworkMeta {
  id:       Network;
  label:    string;
  color:    string;
  icon:     string;
  canSwap:  boolean;   // FluidSOR execution only supported on Base
}

export const NETWORKS: NetworkMeta[] = [
  { id: "base",      label: "Base",      color: "#0052FF", icon: "🔵", canSwap: true  },
  { id: "ethereum",  label: "Ethereum",  color: "#627EEA", icon: "Ξ",  canSwap: false },
  { id: "solana",    label: "Solana",    color: "#9945FF", icon: "◎",  canSwap: false },
  { id: "injective", label: "Injective", color: "#00C2FF", icon: "⬡",  canSwap: false },
];

// ─── Token registry ───────────────────────────────────────────────────────────

export interface Token {
  symbol:   string;
  address:  string;
  decimals: number;
  color:    string;
  network:  Network;
}

export const TOKENS_BY_NETWORK: Record<Network, Record<string, Token>> = {
  base: {
    USDC: { symbol: "USDC",  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6,  color: "#2775CA", network: "base" },
    USDT: { symbol: "USDT",  address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6,  color: "#26A17B", network: "base" },
    WETH: { symbol: "WETH",  address: "0x4200000000000000000000000000000000000006", decimals: 18, color: "#627EEA", network: "base" },
    cbBTC:{ symbol: "cbBTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8,  color: "#F7931A", network: "base" },
    LINK: { symbol: "LINK",  address: "0x88Fb150BDc53A65Fe94Dea0c9BA0a6dAf8C6e196", decimals: 18, color: "#2A5ADA", network: "base" },
    AAVE: { symbol: "AAVE",  address: "0xA700b4eB416Be35b2911fd5Dee80678ff64fF6C9", decimals: 18, color: "#B6509E", network: "base" },
    DAI:  { symbol: "DAI",   address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18, color: "#F5AC37", network: "base" },
  },
  ethereum: {
    USDC:  { symbol: "USDC",  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6,  color: "#2775CA", network: "ethereum" },
    USDT:  { symbol: "USDT",  address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6,  color: "#26A17B", network: "ethereum" },
    WETH:  { symbol: "WETH",  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, color: "#627EEA", network: "ethereum" },
    WBTC:  { symbol: "WBTC",  address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8,  color: "#F7931A", network: "ethereum" },
    LINK:  { symbol: "LINK",  address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, color: "#2A5ADA", network: "ethereum" },
    stETH: { symbol: "stETH", address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", decimals: 18, color: "#00A3FF", network: "ethereum" },
    DAI:   { symbol: "DAI",   address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, color: "#F5AC37", network: "ethereum" },
  },
  solana: {
    USDC:  { symbol: "USDC",  address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6,  color: "#2775CA", network: "solana" },
    USDT:  { symbol: "USDT",  address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6,  color: "#26A17B", network: "solana" },
    SOL:   { symbol: "SOL",   address: "So11111111111111111111111111111111111111112",  decimals: 9,  color: "#9945FF", network: "solana" },
    JUP:   { symbol: "JUP",   address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6,  color: "#C7F284", network: "solana" },
    BONK:  { symbol: "BONK",  address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5,  color: "#FC8E03", network: "solana" },
    WIF:   { symbol: "WIF",   address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6,  color: "#E8A44A", network: "solana" },
    JTO:   { symbol: "JTO",   address: "jtojtomepa8bdwd4nfga5dtj9uupwutzfkrba4fhv3",  decimals: 9,  color: "#00C2FF", network: "solana" },
    PYTH:  { symbol: "PYTH",  address: "HZ1JovNiVvGrCNiiYWY1ZoZGpQUQo3atkB9oY3DDMFxT", decimals: 6,  color: "#E6DAFE", network: "solana" },
  },
  injective: {
    INJ:  { symbol: "INJ",  address: "inj",                                          decimals: 18, color: "#00C2FF", network: "injective" },
    USDT: { symbol: "USDT", address: "peggy0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, color: "#26A17B", network: "injective" },
    USDC: { symbol: "USDC", address: "peggy0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, color: "#2775CA", network: "injective" },
    WETH: { symbol: "WETH", address: "peggy0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, color: "#627EEA", network: "injective" },
    ATOM: { symbol: "ATOM", address: "ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9", decimals: 6, color: "#6F4CD2", network: "injective" },
  },
};

// Legacy flat map for Base (used by swap execution logic)
export const TOKENS = TOKENS_BY_NETWORK.base;

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const BASE_CHAIN_ID = base.id;
export const BASESCAN      = "https://basescan.org";
export const FLUID_SITE    = "https://fluidnative.com";
export const FLUID_GITHUB  = "https://github.com/fluidbase9/fluid-sor";
export const FLUID_NPM     = "https://www.npmjs.com/package/@fluidwalletbase/sdk";
