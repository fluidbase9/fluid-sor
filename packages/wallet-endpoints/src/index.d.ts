export type WalletType = "client" | "developer";

export interface WalletSet {
  mnemonic:    string;
  ethAddress:  string;
  baseAddress: string;
  solAddress:  string;
  apiKey:      string;
  walletType?: WalletType;
  totpEnabled?: boolean;
}

export interface RegisterKeyResponse {
  success:         boolean;
  supportedChains: string[];
  supportedTokens: string[];
  wallets: { ethereum: string | null; base: string | null; solana: string | null };
  error?:          string;
}

export interface KeyInfoResponse {
  success:          boolean;
  registered:       boolean;
  keyHint?:         string;
  active?:          boolean;
  createdAt?:       string;
  lastUsedAt?:      string | null;
  supportedChains?: string[];
  supportedTokens?: string[];
  wallets?:         { ethereum: string | null; base: string | null; solana: string | null };
  error?:           string;
}

export interface FluidIdResolveResponse {
  success:      boolean;
  username?:    string;
  address?:     string;
  networkId?:   string;
  displayName?: string | null;
  avatarUrl?:   string | null;
  error?:       string;
}

export interface FluidIdReverseResponse {
  success:   boolean;
  username?: string | null;
  address?:  string;
  message?:  string;
  error?:    string;
}

export interface SwapHistoryEntry {
  id:           number;
  fromChain:    string;
  toChain:      string;
  fromToken:    string;
  toToken:      string;
  fromAmount:   string;
  toAmount?:    string | null;
  usdValue?:    string | null;
  txHash?:      string | null;
  explorerUrl?: string | null;
  provider?:    string | null;
  venue?:       string | null;
  status:       string;
  createdAt:    string;
}

export interface SwapHistoryResponse {
  success: boolean;
  history: SwapHistoryEntry[];
  error?:  string;
}

export interface SorRoute {
  venue:        string;
  amountOut:    string;
  amountOutRaw: number;
  priceImpact:  string;
  gasEstimate:  string;
  splitBps?:    number;
  badge?:       string;
  badgeColor?:  string;
  recommended?: boolean;
}

export interface SorQuoteResponse {
  routes:    SorRoute[];
  tokenIn:   string;
  tokenOut:  string;
  amountIn:  string;
  bestVenue: string;
  timestamp: number;
  error?:    string;
}

export interface WalletInfoResponse {
  success:    boolean;
  email?:     string | null;
  fluidId?:   string | null;
  addresses?: { ethereum: string | null; base: string | null; solana: string | null };
  error?:     string;
}

export interface UsageStatsResponse {
  success:    boolean;
  totalCalls: number;
  callsToday: number;
  daily:      { day: string; count: number }[];
  endpoints:  { endpoint: string; count: number }[];
  error?:     string;
}

export interface BalanceResponse {
  success: boolean;
  balance: string;
  address: string;
  chain:   string;
  token:   "USDC";
  error?:  string;
}

export interface SendResponse {
  success:      boolean;
  txHash?:      string;
  explorerUrl?: string;
  from?:        string;
  to?:          string;
  amount?:      string;
  chain?:       string;
  error?:       string;
  message?:     string;
}

export interface SwapResponse {
  success:      boolean;
  txHash?:      string;
  explorerUrl?: string;
  from?:        string;
  tokenIn?:     string;
  tokenOut?:    string;
  amountIn?:    string;
  amountOut?:   string | null;
  chain?:       string;
  error?:       string;
  message?:     string;
}

export function deriveSdkApiKey(mnemonic: string): Promise<string>;
export function hashApiKey(apiKey: string): Promise<string>;

export class FluidWalletClient {
  constructor(baseUrl?: string, apiKey?: string | null);
  registerKey(email: string, keyHash: string, keyHint: string, ethAddress?: string, baseAddress?: string, solAddress?: string, walletType?: WalletType, totpEnabled?: boolean, totpSecretHint?: string): Promise<RegisterKeyResponse>;
  getKeyInfo(email: string): Promise<KeyInfoResponse>;
  deactivateKey(email: string): Promise<{ success: boolean; error?: string }>;
  getWalletInfo(): Promise<WalletInfoResponse>;
  getUsageStats(email: string): Promise<UsageStatsResponse>;
  resolveFluidId(username: string, networkId?: string): Promise<FluidIdResolveResponse>;
  reverseFluidId(address: string): Promise<FluidIdReverseResponse>;
  getRoutingPrices(tokenIn: string, tokenOut: string, amountIn: string, network?: "base" | "ethereum" | "solana" | "injective"): Promise<SorQuoteResponse>;
  getSwapHistory(userEmail: string, limit?: number): Promise<SwapHistoryResponse>;
  getBalance(chain?: "base" | "ethereum" | "solana"): Promise<BalanceResponse>;
  send(params: { chain: "base" | "ethereum" | "solana"; to: string; amount: string; signedTx: string }): Promise<SendResponse>;
  getQuote(tokenIn: string, tokenOut: string, amountIn: string, network?: "base" | "ethereum" | "solana" | "injective"): Promise<SorQuoteResponse>;
  swap(params: { tokenIn: string; tokenOut: string; amountIn: string; amountOut: string; signedTx: string }): Promise<SwapResponse>;
  setApiKey(apiKey: string): void;
}
