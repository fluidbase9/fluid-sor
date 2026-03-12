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
   * @param {string} tokenIn   e.g. "USDC"
   * @param {string} tokenOut  e.g. "WETH"
   * @param {string} amountIn  e.g. "100"
   */
  async getQuote(tokenIn, tokenOut, amountIn) {
    const url = `${this.baseUrl}/api/sor/quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}`;
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
