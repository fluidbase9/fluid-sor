/**
 * @fluidwalletbase/wallet-endpoints
 *
 * Client SDK for Fluid Wallet developer endpoints.
 *
 * Supported chains  : Ethereum · Base · Solana
 * Supported tokens  : USDC only
 * Key auth          : Seed-phrase derived API key (HMAC-SHA256, client-side only)
 * Routing           : FluidSOR smart contract (Base mainnet)
 *
 * The seed phrase NEVER leaves the browser / your server.
 * Only a SHA-256 hash of the derived API key is sent to the Fluid backend.
 *
 * Send / Swap use server-side execution:
 *   The Fluid backend executes transactions using the developer's Fluid in-app
 *   wallet (derived from their email via walletDerivationService).
 *   No local signing required — just pass chain, to, amount (for send) or
 *   tokenIn, tokenOut, amountIn (for swap).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletSet {
  mnemonic:    string;   // BIP-39 seed phrase (12 words) — keep secret, never send to server
  apiKey:      string;   // Fluid SDK key: fw_sor_... (HMAC-SHA256 of mnemonic, client-side only)
  // Wallet addresses are derived server-side from email via walletDerivationService.
  // The fields below are returned by registerKey() after server-side derivation.
  ethAddress?:  string;   // Ethereum mainnet address (server-derived)
  baseAddress?: string;   // Base mainnet address     (server-derived)
  solAddress?:  string;   // Solana mainnet address   (server-derived)
}

export interface RegisterKeyResponse {
  success:          boolean;
  supportedChains:  string[];
  supportedTokens:  string[];
  wallets: {
    ethereum: string | null;
    base:     string | null;
    solana:   string | null;
  };
  error?: string;
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
  wallets?: {
    ethereum: string | null;
    base:     string | null;
    solana:   string | null;
  };
  error?: string;
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
  routes:     SorRoute[];
  tokenIn:    string;
  tokenOut:   string;
  amountIn:   string;
  bestVenue:  string;
  timestamp:  number;
  error?:     string;
}

export interface BalanceResponse {
  success:  boolean;
  balance:  string;   // USDC balance as a decimal string e.g. "42.50"
  address:  string;   // The registered wallet address queried
  chain:    string;
  token:    "USDC";
  error?:   string;
}

export interface SendResponse {
  success:     boolean;
  txHash?:     string;
  explorerUrl?: string;
  from?:       string;
  to?:         string;
  amount?:     string;
  chain?:      string;
  error?:      string;
  message?:    string;
}

export interface SwapResponse {
  success:     boolean;
  txHash?:     string;
  explorerUrl?: string;
  from?:       string;
  tokenIn?:    string;
  tokenOut?:   string;
  amountIn?:   string;
  amountOut?:  string | null;
  chain?:      string;
  error?:      string;
  message?:    string;
}

// ─── Crypto helpers ──────────────────────────────────────────────────────────

/**
 * Derive the Fluid SDK API key from a BIP-39 seed phrase.
 * Performed entirely client-side — the mnemonic never leaves the browser.
 *
 * @param mnemonic  12-word BIP-39 seed phrase
 * @returns         API key in the form "fw_sor_<24 hex chars>"
 */
export async function deriveSdkApiKey(mnemonic: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(mnemonic),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", keyMaterial, enc.encode("fluid-sor-api-key-v1"))
  );
  const hex = Array.from(sig).map(b => b.toString(16).padStart(2, "0")).join("");
  return `fw_sor_${hex.slice(0, 24)}`;
}

/**
 * SHA-256 hash of the API key — this is what the server stores, never the key itself.
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Fluid API client ─────────────────────────────────────────────────────────

export class FluidWalletClient {
  private baseUrl: string;
  private apiKey:  string | null;

  /**
   * @param baseUrl  Base URL of the Fluid backend (default: "https://fluidnative.com")
   * @param apiKey   SDK API key (fw_sor_...) — required for all protected endpoints
   */
  constructor(baseUrl = "https://fluidnative.com", apiKey: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey  = apiKey;
  }

  private get authHeader(): Record<string, string> {
    if (!this.apiKey) throw new Error("API key required. Pass it to the FluidWalletClient constructor.");
    return { "x-fluid-api-key": this.apiKey };
  }

  // ── Key management ─────────────────────────────────────────────────────────

  /**
   * Register your SDK API key and wallet addresses with Fluid.
   *
   * Never pass the raw mnemonic — use deriveSdkApiKey() + hashApiKey() first.
   * This is called once from the Fluid Wallet Developer Console.
   */
  async registerKey(
    email:        string,
    keyHash:      string,
    keyHint:      string,
    ethAddress?:  string,
    baseAddress?: string,
    solAddress?:  string,
  ): Promise<RegisterKeyResponse> {
    const res = await fetch(`${this.baseUrl}/api/developer/register-key`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, keyHash, keyHint, ethAddress, baseAddress, solAddress }),
    });
    return res.json();
  }

  /**
   * Look up your API key metadata by email.
   * Returns wallet addresses and key status — never the key hash itself.
   */
  async getKeyInfo(email: string): Promise<KeyInfoResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/developer/key-info?email=${encodeURIComponent(email)}`
    );
    return res.json();
  }

  /**
   * Deactivate your API key. All subsequent API requests using it will be rejected.
   */
  async deactivateKey(email: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/developer/deactivate-key`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    return res.json();
  }

  // ── Balance ────────────────────────────────────────────────────────────────

  /**
   * Get the USDC balance of your registered wallet address on the specified chain.
   *
   * The address used is the one registered when you derived your API key.
   * No signing required — read-only.
   *
   * @param chain  "base" (default) | "ethereum" | "solana"
   *
   * @example
   * const { balance } = await client.getBalance("base");
   * console.log(`${balance} USDC on Base`);
   */
  async getBalance(chain: "base" | "ethereum" | "solana" = "base"): Promise<BalanceResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/wallet/balance?chain=${chain}`,
      { headers: this.authHeader }
    );
    return res.json();
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  /**
   * Send USDC through Fluid. The server executes the transaction using your
   * Fluid in-app wallet (derived server-side from your email). No local signing required.
   *
   * For Solana, a signed transaction is still required (server-side Solana execution coming soon).
   *
   * @param params.chain     "base" | "ethereum" | "solana"
   * @param params.to        Recipient address
   * @param params.amount    Amount of USDC to send (decimal string, e.g. "10.50")
   * @param params.signedTx  Optional — only required for Solana (base64 encoded tx)
   */
  async send(params: {
    chain:     "base" | "ethereum" | "solana";
    to:        string;
    amount:    string;
    signedTx?: string;
  }): Promise<SendResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/wallet/send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...this.authHeader },
      body:    JSON.stringify(params),
    });
    return res.json();
  }

  // ── SOR Quote ──────────────────────────────────────────────────────────────

  /**
   * Get the best swap routes from the Fluid Smart Order Router.
   *
   * Supported networks and their routers:
   *   base      → Fluid AMM, Uniswap V3, Aerodrome, PancakeSwap, SushiSwap, Odos, Balancer + more
   *   ethereum  → Uniswap V3, SushiSwap, PancakeSwap, Balancer + more
   *   solana    → Jupiter (aggregates Raydium, Orca, Meteora, Phoenix, etc.)
   *   injective → Helix DEX (price-based)
   *
   * @param tokenIn   e.g. "SOL", "USDC", "WETH"
   * @param tokenOut  e.g. "USDC", "USDT", "WETH"
   * @param amountIn  e.g. "100"
   * @param network   "base" | "ethereum" | "solana" | "injective"  (default: "base")
   */
  async getQuote(
    tokenIn:  string,
    tokenOut: string,
    amountIn: string,
    network:  "base" | "ethereum" | "solana" | "injective" = "base",
  ): Promise<SorQuoteResponse> {
    const url = `${this.baseUrl}/api/sor/wallet-quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&network=${network}`;
    const res = await fetch(url, { headers: this.authHeader });
    return res.json();
  }

  // ── SOR Swap (execute) ────────────────────────────────────────────────────

  /**
   * Execute a FluidSOR swap through Fluid. The server executes the swap using
   * your Fluid in-app wallet (derived server-side from your email).
   * No local signing required — just provide the token symbols and amounts.
   *
   * Flow:
   *   1. Call getQuote() to get routes + amountOut
   *   2. Call swap() with tokenIn, tokenOut, amountIn, and amountOut from the quote
   *   3. Fluid executes the swap server-side and records it to your swap history
   *
   * @param params.tokenIn   Input token symbol  (e.g. "USDC")
   * @param params.tokenOut  Output token symbol (e.g. "WETH")
   * @param params.amountIn  Amount in           (e.g. "100")
   * @param params.amountOut Expected amount out from getQuote (e.g. "0.03521")
   * @param params.signedTx  Optional — accepted for backwards compat but not required
   */
  async swap(params: {
    tokenIn:    string;
    tokenOut:   string;
    amountIn:   string;
    amountOut?: string;
    signedTx?:  string;
  }): Promise<SwapResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/sor/swap`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...this.authHeader },
      body:    JSON.stringify(params),
    });
    return res.json();
  }

  /** Update the API key at runtime */
  setApiKey(apiKey: string) { this.apiKey = apiKey; }
}
