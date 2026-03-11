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
 * Send / Swap use a relay model:
 *   1. Build + sign the transaction locally using your private key
 *      (derived from your seed phrase via ethers / @solana/web3.js)
 *   2. Pass the signed raw transaction to send() or swap()
 *   3. Fluid verifies the signer matches your registered address, broadcasts,
 *      and records the transaction to your developer history
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
   * Relay a signed USDC send transaction through Fluid.
   *
   * Fluid verifies the signer matches your registered address, broadcasts the
   * transaction on-chain, and records it to your developer history.
   *
   * You must sign the transaction locally before calling this method.
   *
   * EVM signing example (ethers v6):
   * ```ts
   * import { ethers } from "ethers";
   *
   * const wallet   = ethers.Wallet.fromPhrase(mnemonic).connect(provider);
   * const USDC     = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
   * const erc20    = new ethers.Contract(USDC, ["function transfer(address,uint256)"], wallet);
   * const tx       = await erc20.transfer.populateTransaction(to, ethers.parseUnits(amount, 6));
   * const signedTx = await wallet.signTransaction({ ...tx, chainId: 8453n });
   *
   * await client.send({ chain: "base", to, amount, signedTx });
   * ```
   *
   * Solana signing example (@solana/web3.js):
   * ```ts
   * // Build + sign the SPL token transfer, then:
   * const signedTx = tx.serialize().toString("base64");
   * await client.send({ chain: "solana", to, amount, signedTx });
   * ```
   *
   * @param params.chain     "base" | "ethereum" | "solana"
   * @param params.to        Recipient address
   * @param params.amount    Amount of USDC to send (decimal string, e.g. "10.50")
   * @param params.signedTx  Signed raw transaction — "0x..." for EVM, base64 for Solana
   */
  async send(params: {
    chain:    "base" | "ethereum" | "solana";
    to:       string;
    amount:   string;
    signedTx: string;
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
   * Supported pairs (USDC must be one side):
   *   USDC ↔ USDT, USDC ↔ WETH
   *
   * Use the returned best route's amountOut when building your swap transaction.
   *
   * @param tokenIn   e.g. "USDC"
   * @param tokenOut  e.g. "WETH"
   * @param amountIn  e.g. "100"
   */
  async getQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<SorQuoteResponse> {
    const url = `${this.baseUrl}/api/sor/quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}`;
    const res = await fetch(url, { headers: this.authHeader });
    return res.json();
  }

  // ── SOR Swap (execute) ────────────────────────────────────────────────────

  /**
   * Relay a signed FluidSOR swap transaction through Fluid.
   *
   * Flow:
   *   1. Call getQuote() to get routes + amountOut
   *   2. Build a transaction calling FluidSOR.swap() on Base mainnet
   *      (contract address from VITE_FLUID_SOR_ADDRESS / fluidnative.com)
   *   3. Sign the transaction locally with your seed-phrase-derived private key
   *   4. Call swap() — Fluid verifies, broadcasts, and records the swap
   *
   * Signing example (ethers v6):
   * ```ts
   * import { ethers } from "ethers";
   *
   * const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
   * const wallet   = ethers.Wallet.fromPhrase(mnemonic).connect(provider);
   *
   * const sorAbi   = ["function swap(address,address,uint256,uint256,uint8) returns (uint256)"];
   * const sor      = new ethers.Contract(SOR_ADDRESS, sorAbi, wallet);
   *
   * const quote    = await client.getQuote("USDC", "WETH", "100");
   * const best     = quote.routes[0];
   * const tx       = await sor.swap.populateTransaction(
   *   USDC_ADDRESS, WETH_ADDRESS,
   *   ethers.parseUnits("100", 6),
   *   ethers.parseUnits(best.amountOut, 18),
   *   0  // venue index: 0=Fluid, 1=Uniswap, 2=Aerodrome
   * );
   * const signedTx = await wallet.signTransaction({ ...tx, chainId: 8453n });
   *
   * await client.swap({ tokenIn: "USDC", tokenOut: "WETH", amountIn: "100",
   *                     amountOut: best.amountOut, signedTx });
   * ```
   *
   * @param params.tokenIn   Input token symbol  (e.g. "USDC")
   * @param params.tokenOut  Output token symbol (e.g. "WETH")
   * @param params.amountIn  Amount in           (e.g. "100")
   * @param params.amountOut Expected amount out from getQuote (e.g. "0.03521")
   * @param params.signedTx  Signed raw EVM transaction — "0x..."
   */
  async swap(params: {
    tokenIn:   string;
    tokenOut:  string;
    amountIn:  string;
    amountOut: string;
    signedTx:  string;
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
