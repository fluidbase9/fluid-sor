/**
 * @fluidwalletbase/wallet-endpoints
 *
 * Client SDK for Fluid Wallet developer endpoints.
 *
 * Supported chains  : Ethereum · Base · Solana
 * Supported tokens  : USDC only
 * Wallet auth       : Fluid Firebase authentication
 * Routing           : FluidSOR smart contract (Base mainnet)
 *
 * The seed phrase NEVER leaves the browser.
 * Only a SHA-256 hash of the derived API key is sent to the server.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletSet {
  mnemonic:    string;   // BIP-39 seed phrase (12 words) — keep secret, never send to server
  ethAddress:  string;   // Ethereum mainnet address  (m/44'/60'/0'/0/0)
  baseAddress: string;   // Base mainnet address      (same key as ETH — Base is EVM L2)
  solAddress:  string;   // Solana mainnet address    (m/44'/501'/0'/0')
  apiKey:      string;   // Fluid SDK key: fw_sor_... (HMAC-SHA256 of mnemonic, client-side only)
}

export interface RegisterKeyResponse {
  success:          boolean;
  supportedChains:  string[];   // ["ethereum", "base", "solana"]
  supportedTokens:  string[];   // ["USDC"]
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

// ─── Crypto helpers ──────────────────────────────────────────────────────────

/**
 * Derive the Fluid SDK API key from a BIP-39 seed phrase.
 * Performed entirely client-side — the mnemonic never leaves the browser.
 *
 * @param mnemonic  12-word BIP-39 seed phrase
 * @returns         API key in the form "fw_sor_<48 hex chars>"
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
   * @param baseUrl   Base URL of the Fluid backend (default: "https://fluidnative.com")
   * @param apiKey    SDK API key (fw_sor_...) — required for /api/sor/quote
   */
  constructor(baseUrl = "https://fluidnative.com", apiKey: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey  = apiKey;
  }

  // ── Authentication ─────────────────────────────────────────────────────────

  /**
   * Register an SDK developer API key and wallet addresses with Fluid.
   *
   * IMPORTANT: Never pass the raw mnemonic to this method.
   * Use deriveSdkApiKey() + hashApiKey() client-side first.
   *
   * @param email       Developer's email (Fluid Firebase account)
   * @param keyHash     sha256(apiKey)  — 64-char hex
   * @param keyHint     First 12 chars of apiKey for display e.g. "fw_sor_a3f8c"
   * @param ethAddress  Ethereum wallet address (0x...)
   * @param baseAddress Base wallet address   (0x...)  — same as ethAddress
   * @param solAddress  Solana wallet address (base58)
   */
  async registerKey(
    email:       string,
    keyHash:     string,
    keyHint:     string,
    ethAddress?: string,
    baseAddress?: string,
    solAddress?: string,
  ): Promise<RegisterKeyResponse> {
    const res = await fetch(`${this.baseUrl}/api/developer/register-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, keyHash, keyHint, ethAddress, baseAddress, solAddress }),
    });
    return res.json();
  }

  /**
   * Look up API key metadata by email.
   * Returns wallet addresses and key status — never the key itself.
   */
  async getKeyInfo(email: string): Promise<KeyInfoResponse> {
    const res = await fetch(`${this.baseUrl}/api/developer/key-info?email=${encodeURIComponent(email)}`);
    return res.json();
  }

  /**
   * Deactivate an API key. All subsequent requests using this key will be rejected.
   */
  async deactivateKey(email: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/developer/deactivate-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return res.json();
  }

  // ── SOR Quote ──────────────────────────────────────────────────────────────

  /**
   * Get the best swap routes from the Fluid Smart Order Router.
   *
   * Requires a registered SDK API key (set via constructor or setApiKey()).
   *
   * Currently only USDC pairs are supported:
   *   USDC → USDT, USDT → USDC, USDC → WETH, WETH → USDC
   *
   * @param tokenIn   Input token symbol  (e.g. "USDC")
   * @param tokenOut  Output token symbol (e.g. "USDT")
   * @param amountIn  Amount to swap      (e.g. "100")
   */
  async getQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<SorQuoteResponse> {
    if (!this.apiKey) throw new Error("API key required. Pass it to the FluidWalletClient constructor.");
    const url = `${this.baseUrl}/api/sor/quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}`;
    const res = await fetch(url, { headers: { "x-fluid-api-key": this.apiKey } });
    return res.json();
  }

  /** Update the API key at runtime */
  setApiKey(apiKey: string) { this.apiKey = apiKey; }
}
