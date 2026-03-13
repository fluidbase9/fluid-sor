/**
 * @fluidwalletbase/wallet-endpoints
 *
 * Client SDK for Fluid Wallet developer endpoints.
 * Supported chains: Ethereum · Base · Solana
 * Key auth: Seed-phrase derived API key (HMAC-SHA256, client-side only)
 * Routing: FluidSOR smart contract (Base mainnet)
 */

// ─── Crypto helpers ───────────────────────────────────────────────────────────

/**
 * Derive the Fluid SDK API key from a BIP-39 seed phrase.
 * Performed entirely client-side — the mnemonic never leaves the browser.
 * @param {string} mnemonic 12-word BIP-39 seed phrase
 * @returns {Promise<string>} API key in the form "fw_sor_<24 hex chars>"
 */
export async function deriveSdkApiKey(mnemonic) {
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
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export async function hashApiKey(apiKey) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Fluid API client ─────────────────────────────────────────────────────────

export class FluidWalletClient {
  /**
   * @param {string} baseUrl Base URL of the Fluid backend (default: "https://fluidnative.com")
   * @param {string | null} apiKey SDK API key (fw_sor_...)
   */
  constructor(baseUrl = "https://fluidnative.com", apiKey = null) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey  = apiKey;
  }

  get _authHeader() {
    if (!this.apiKey) throw new Error("API key required. Pass it to the FluidWalletClient constructor.");
    return { "x-fluid-api-key": this.apiKey };
  }

  // ── Key management ──────────────────────────────────────────────────────────

  async registerKey(email, keyHash, keyHint, ethAddress, baseAddress, solAddress) {
    const res = await fetch(`${this.baseUrl}/api/developer/register-key`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, keyHash, keyHint, ethAddress, baseAddress, solAddress }),
    });
    return res.json();
  }

  async getKeyInfo(email) {
    const res = await fetch(
      `${this.baseUrl}/api/developer/key-info?email=${encodeURIComponent(email)}`
    );
    return res.json();
  }

  async deactivateKey(email) {
    const res = await fetch(`${this.baseUrl}/api/developer/deactivate-key`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    return res.json();
  }

  // ── Wallet info ─────────────────────────────────────────────────────────────

  /**
   * Get your registered wallet addresses, Fluid ID, and email for your API key.
   * @returns {Promise<import("./index.d.ts").WalletInfoResponse>}
   */
  async getWalletInfo() {
    const res = await fetch(
      `${this.baseUrl}/api/v1/wallet/info`,
      { headers: this._authHeader }
    );
    return res.json();
  }

  // ── Usage stats ─────────────────────────────────────────────────────────────

  /**
   * Get API usage statistics for your API key.
   * @param {string} email Your registered developer email
   * @returns {Promise<import("./index.d.ts").UsageStatsResponse>}
   */
  async getUsageStats(email) {
    const res = await fetch(
      `${this.baseUrl}/api/developer/usage?email=${encodeURIComponent(email)}`
    );
    return res.json();
  }

  // ── Fluid ID ─────────────────────────────────────────────────────────────────

  /**
   * Resolve a Fluid ID (e.g. "alice") to a wallet address.
   * @param {string} username  Fluid ID without suffix — e.g. "alice"
   * @param {string} [networkId]  Optional: "ethereum" | "base" | "solana"
   * @returns {Promise<import("./index.d.ts").FluidIdResolveResponse>}
   */
  async resolveFluidId(username, networkId) {
    const qs = networkId ? `?networkId=${encodeURIComponent(networkId)}` : "";
    const res = await fetch(`${this.baseUrl}/api/fw-names/resolve/${encodeURIComponent(username)}${qs}`);
    return res.json();
  }

  /**
   * Reverse-resolve a wallet address to its Fluid ID.
   * @param {string} address  EVM (0x...) or Solana address
   * @returns {Promise<import("./index.d.ts").FluidIdReverseResponse>}
   */
  async reverseFluidId(address) {
    const res = await fetch(`${this.baseUrl}/api/fw-names/reverse/${encodeURIComponent(address)}`);
    return res.json();
  }

  // ── On-chain routing prices ───────────────────────────────────────────────────

  /**
   * Get live on-chain SOR routing prices across 25+ DEX venues.
   * Broader token support than getQuote() — all networks, real on-chain data.
   * @param {string} tokenIn   e.g. "USDC"
   * @param {string} tokenOut  e.g. "USDT"
   * @param {string} amountIn  e.g. "100"
   * @param {"base"|"ethereum"|"solana"|"injective"} [network]  default: "base"
   * @returns {Promise<import("./index.d.ts").SorQuoteResponse>}
   */
  async getRoutingPrices(tokenIn, tokenOut, amountIn, network = "base") {
    const url = `${this.baseUrl}/api/sor/wallet-quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&network=${network}`;
    const res = await fetch(url);
    return res.json();
  }

  // ── Swap history ─────────────────────────────────────────────────────────────

  /**
   * Get swap transaction history for a developer wallet.
   * @param {string} userEmail  Developer account email
   * @param {number} [limit]    Max records (1–50, default 20)
   * @returns {Promise<import("./index.d.ts").SwapHistoryResponse>}
   */
  async getSwapHistory(userEmail, limit = 20) {
    const res = await fetch(`${this.baseUrl}/api/swap/history`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userEmail, limit }),
    });
    return res.json();
  }

  // ── Balance ─────────────────────────────────────────────────────────────────

  /**
   * Get the USDC balance of your registered wallet address on the specified chain.
   * @param {"base" | "ethereum" | "solana"} chain
   * @returns {Promise<import("./index.d.ts").BalanceResponse>}
   */
  async getBalance(chain = "base") {
    const res = await fetch(
      `${this.baseUrl}/api/v1/wallet/balance?chain=${chain}`,
      { headers: this._authHeader }
    );
    return res.json();
  }

  // ── Send ────────────────────────────────────────────────────────────────────

  /**
   * Relay a signed USDC send transaction through Fluid.
   * @param {{ chain: string, to: string, amount: string, signedTx: string }} params
   */
  async send(params) {
    const res = await fetch(`${this.baseUrl}/api/v1/wallet/send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...this._authHeader },
      body:    JSON.stringify(params),
    });
    return res.json();
  }

  // ── SOR Quote ───────────────────────────────────────────────────────────────

  /**
   * Get the best swap routes from the Fluid Smart Order Router.
   * @param {string} tokenIn   e.g. "SOL", "USDC", "WETH"
   * @param {string} tokenOut  e.g. "USDC", "USDT", "WETH"
   * @param {string} amountIn  e.g. "100"
   * @param {"base"|"ethereum"|"solana"|"injective"} network  default: "base"
   */
  async getQuote(tokenIn, tokenOut, amountIn, network = "base") {
    const url = `${this.baseUrl}/api/sor/wallet-quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&network=${network}`;
    const res = await fetch(url, { headers: this._authHeader });
    return res.json();
  }

  // ── SOR Swap (execute) ──────────────────────────────────────────────────────

  /**
   * Relay a signed FluidSOR swap transaction through Fluid.
   * @param {{ tokenIn: string, tokenOut: string, amountIn: string, amountOut: string, signedTx: string }} params
   */
  async swap(params) {
    const res = await fetch(`${this.baseUrl}/api/v1/sor/swap`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...this._authHeader },
      body:    JSON.stringify(params),
    });
    return res.json();
  }

  /** Update the API key at runtime */
  setApiKey(apiKey) { this.apiKey = apiKey; }
}
