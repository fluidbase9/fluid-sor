#!/usr/bin/env node
"use strict";

const path         = require("path");
const fs           = require("fs");
const readline     = require("readline");
const crypto       = require("crypto");
const { execSync } = require("child_process");

// ─── BIP-39 → BIP-44 private key derivation (pure Node.js crypto) ─────────────

/** BIP-39: mnemonic + optional passphrase → 64-byte seed */
function mnemonicToSeed(mnemonic, passphrase = "") {
  return crypto.pbkdf2Sync(
    Buffer.from(mnemonic.normalize("NFKD"), "utf8"),
    Buffer.from(("mnemonic" + passphrase).normalize("NFKD"), "utf8"),
    2048, 64, "sha512"
  );
}

/** secp256k1 compressed public key from a 32-byte private key */
function compressedPubKey(privKeyBuf) {
  const ecdh = crypto.createECDH("secp256k1");
  ecdh.setPrivateKey(privKeyBuf);
  return ecdh.getPublicKey(null, "compressed"); // 33 bytes
}

/** BIP-32 child key derivation (hardened or normal) */
function deriveChild(node, index) {
  const hardened = (index >>> 0) >= 0x80000000;
  const data = Buffer.alloc(37);
  if (hardened) {
    data[0] = 0x00;
    node.key.copy(data, 1);
  } else {
    compressedPubKey(node.key).copy(data, 0);
  }
  data.writeUInt32BE(index >>> 0, 33);
  const I  = crypto.createHmac("sha512", node.chainCode).update(data).digest();
  const IL = I.slice(0, 32);
  const n  = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  const childBig = (BigInt("0x" + IL.toString("hex")) + BigInt("0x" + node.key.toString("hex"))) % n;
  return {
    key:       Buffer.from(childBig.toString(16).padStart(64, "0"), "hex"),
    chainCode: I.slice(32),
  };
}

/**
 * Derives the EVM private key from a BIP-39 mnemonic.
 * Path: m/44'/60'/0'/0/0  (standard Ethereum / Base BIP-44)
 * Returns the private key as "0x..." hex string.
 */
function deriveEvmPrivateKey(mnemonic) {
  const seed = mnemonicToSeed(mnemonic.trim().toLowerCase());
  const Imaster = crypto.createHmac("sha512", "Bitcoin seed").update(seed).digest();
  let node = { key: Imaster.slice(0, 32), chainCode: Imaster.slice(32) };
  // m / 44' / 60' / 0' / 0 / 0
  for (const idx of [0x8000002C, 0x8000003C, 0x80000000, 0, 0]) {
    node = deriveChild(node, idx);
  }
  return "0x" + node.key.toString("hex");
}

// ─── ANSI colours ─────────────────────────────────────────────────────────────

const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  gray:   "\x1b[90m",
  dim:    "\x1b[2m",
};

const log  = (msg)           => process.stdout.write(msg + "\n");
const info = (label, msg)    => log(`  ${C.cyan}${label}${C.reset}  ${msg}`);
const ok   = (msg)           => log(`  ${C.green}✓${C.reset}  ${msg}`);
const warn = (msg)           => log(`  ${C.yellow}!${C.reset}  ${msg}`);
const err  = (msg)           => log(`  ${C.red}✗${C.reset}  ${msg}`);
const step = (n, total, msg) => log(`\n  ${C.bold}[${n}/${total}]${C.reset} ${msg}`);

// ─── Banner ───────────────────────────────────────────────────────────────────

function banner() {
  log("");
  log(`${C.cyan}${C.bold}  ╔══════════════════════════════════════════╗${C.reset}`);
  log(`${C.cyan}${C.bold}  ║   @fluidwalletbase/sdk · create-fluid-app   ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ║   Smart Order Routing on Base Mainnet    ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ╚══════════════════════════════════════════╝${C.reset}`);
  log(`  ${C.gray}Powered by FluidSOR · fluidnative.com${C.reset}`);
  log("");
}

// ─── Parse args ───────────────────────────────────────────────────────────────

function getProjectName() {
  const args     = process.argv.slice(2);
  const filtered = args.filter((a) => a !== "create" && !a.startsWith("--"));
  const name     = filtered[0];
  if (!name) {
    err("Please provide a project name:");
    log(`    npx @fluidwalletbase/sdk create ${C.cyan}my-swap-app${C.reset}`);
    log("");
    process.exit(1);
  }
  return name;
}

// ─── Copy template ────────────────────────────────────────────────────────────

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function patchPackageJson(projectPath, projectName) {
  const pkgPath = path.join(projectPath, "package.json");
  const pkg     = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.name      = projectName.toLowerCase().replace(/\s+/g, "-");
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

// ─── Detect package manager ───────────────────────────────────────────────────

function detectPm() {
  const ua = process.env.npm_config_user_agent || "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun"))  return "bun";
  return "npm";
}

// ─── Prompt helper ────────────────────────────────────────────────────────────

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

// ─── Interactive API key prompt ───────────────────────────────────────────────

async function promptApiKey() {
  log(`  ${C.bold}Fluid SDK API Key${C.reset}`);
  log(`  ${C.gray}Gates access to the SOR quote endpoint (live DEX price indexing).${C.reset}`);
  log(`  ${C.gray}Derive yours: ${C.cyan}fluidnative.com${C.gray} → Developer Console → API Keys tab${C.reset}`);
  log("");

  while (true) {
    const key = await prompt(
      `  ${C.cyan}?${C.reset} Paste API key ${C.dim}(fw_sor_...)${C.reset} or ${C.yellow}Enter${C.reset} to skip: `
    );
    if (!key) {
      warn(`Skipped — add ${C.cyan}VITE_FLUID_API_KEY=fw_sor_...${C.reset} to ${C.gray}.env.local${C.reset} before running.`);
      return "";
    }
    if (!key.startsWith("fw_sor_")) {
      err(`Invalid format — keys start with ${C.cyan}fw_sor_${C.reset}. Try again.`);
      continue;
    }
    ok(`API key accepted  ${C.dim}${key.slice(0, 13)}${"•".repeat(10)}${C.reset}`);
    return key;
  }
}

// ─── Derive private key from seed phrase ──────────────────────────────────────

async function promptSeedPhrase() {
  log("");
  log(`  ${C.bold}Wallet Setup — Derive signing key from your Fluid seed phrase${C.reset}`);
  log(`  ${C.gray}Your seed phrase (12 words) auto-derives your Base/Ethereum private key.${C.reset}`);
  log(`  ${C.gray}No MetaMask needed — same seed you used to set up your Fluid wallet.${C.reset}`);
  log(`  ${C.yellow}!${C.reset}  ${C.gray}The seed phrase is NEVER stored. Only the derived key is written to .env.local.${C.reset}`);
  log(`  ${C.yellow}!${C.reset}  ${C.gray}Skipping this is fine — quoting & routing work without it.${C.reset}`);
  log("");

  while (true) {
    const phrase = await prompt(
      `  ${C.cyan}?${C.reset} Enter seed phrase ${C.dim}(12 words)${C.reset} or ${C.yellow}Enter${C.reset} to skip: `
    );
    if (!phrase.trim()) {
      info("ℹ", `Skipped — quoting & routing work without it. Add ${C.cyan}VITE_FLUID_PRIVATE_KEY${C.reset} to ${C.gray}.env.local${C.reset} later to enable swap execution.`);
      return "";
    }
    const words = phrase.trim().split(/\s+/);
    if (words.length !== 12) {
      err(`Expected 12 words, got ${words.length}. Try again.`);
      continue;
    }
    try {
      const privateKey = deriveEvmPrivateKey(phrase);
      ok(`Key derived from seed phrase  ${C.dim}${privateKey.slice(0, 10)}${"•".repeat(12)}${C.reset}`);
      log(`  ${C.gray}Path: m/44'/60'/0'/0/0  (standard Ethereum / Base)${C.reset}`);
      return privateKey;
    } catch (e) {
      err(`Derivation failed: ${e.message}. Check your seed phrase and try again.`);
      continue;
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner();

  const projectName = getProjectName();
  const projectPath = path.resolve(process.cwd(), projectName);
  const templateDir = path.resolve(__dirname, "../templates/react-swap");
  const TOTAL_STEPS = 5;

  if (fs.existsSync(projectPath)) {
    err(`Directory ${C.cyan}${projectName}${C.reset} already exists.`);
    err("Choose a different name or remove the directory first.");
    process.exit(1);
  }

  if (!fs.existsSync(templateDir)) {
    err("Template files missing. Please reinstall @fluidwalletbase/sdk.");
    process.exit(1);
  }

  // ── Step 1: API key ────────────────────────────────────────────────────────
  step(1, TOTAL_STEPS, "Fluid API key setup");
  const apiKey = await promptApiKey();

  // ── Step 2: Derive private key from seed phrase ────────────────────────────
  step(2, TOTAL_STEPS, "Wallet setup — derive signing key from seed phrase");
  const privateKey = await promptSeedPhrase();

  // ── Step 3: Scaffold ───────────────────────────────────────────────────────
  step(3, TOTAL_STEPS, `Scaffolding ${C.cyan}${projectName}${C.reset}…`);
  copyDir(templateDir, projectPath);
  patchPackageJson(projectPath, projectName);
  ok(`Copied template → ${C.gray}./${projectName}${C.reset}`);

  // ── Step 4: Install deps ───────────────────────────────────────────────────
  step(4, TOTAL_STEPS, "Installing dependencies…");
  const pm = detectPm();
  try {
    execSync(`${pm} install`, { cwd: projectPath, stdio: "pipe" });
    ok(`Dependencies installed (${C.cyan}${pm}${C.reset})`);
  } catch {
    warn("Auto-install failed. Run manually:");
    info("  →", `cd ${projectName} && npm install`);
  }

  // ── Step 5: Write .env.local ───────────────────────────────────────────────
  step(5, TOTAL_STEPS, "Writing .env.local…");

  const apiKeyLine = apiKey
    ? `VITE_FLUID_API_KEY=${apiKey}`
    : `VITE_FLUID_API_KEY=          # paste your fw_sor_... key here`;

  const privateKeyLine = privateKey
    ? `VITE_FLUID_PRIVATE_KEY=${privateKey}`
    : `VITE_FLUID_PRIVATE_KEY=       # paste your 0x... Base wallet private key here`;

  const envContent = [
    "# ─── Fluid SDK API key (REQUIRED for quotes) ────────────────────────────────",
    "# Derive yours: fluidnative.com → Developer Console → API Keys tab",
    apiKeyLine,
    "",
    "# ─── Base wallet private key (OPTIONAL — only needed to execute swaps) ────────",
    "# ⚠ NEVER commit this file to git. It is already in .gitignore.",
    "# Without this: quoting, routing, and balance work fine. Swap execution is disabled.",
    "# To enable execution: export your 0x... private key for the wallet registered above.",
    privateKeyLine,
    "",
    "# ─── FluidSOR contract (pre-filled — live on Base mainnet) ──────────────────",
    "VITE_FLUID_SOR_ADDRESS=0xF24daF8Fe15383fb438d48811E8c4b43749DafAE",
  ].join("\n");

  fs.writeFileSync(path.join(projectPath, ".env.local"), envContent);

  // Write .gitignore to protect the private key
  const gitignore = ["node_modules", ".env.local", "dist", ".DS_Store"].join("\n");
  fs.writeFileSync(path.join(projectPath, ".gitignore"), gitignore + "\n");

  if (apiKey)     ok(`API key written to ${C.gray}.env.local${C.reset}`);
  else            warn(`API key missing — open ${C.gray}.env.local${C.reset} and add ${C.cyan}VITE_FLUID_API_KEY${C.reset}`);
  if (privateKey) ok(`Private key written to ${C.gray}.env.local${C.reset}  ${C.green}(swap execution enabled)${C.reset}`);
  else            info(`ℹ`, `No private key — quoting & routing work. Add ${C.cyan}VITE_FLUID_PRIVATE_KEY${C.reset} later to enable swap execution.`);

  // ── Done ───────────────────────────────────────────────────────────────────
  log("");
  log(`  ${C.green}${C.bold}Your Fluid swap app is ready.${C.reset}`);
  log("");
  log(`  ${C.bold}Next steps:${C.reset}`);
  info("1.", `cd ${C.cyan}${projectName}${C.reset}`);

  let stepN = 2;
  if (!apiKey) {
    info(`${stepN++}.`, `${C.yellow}[Required]${C.reset} Add ${C.cyan}VITE_FLUID_API_KEY=fw_sor_...${C.reset} to ${C.gray}.env.local${C.reset}`);
    info("   ", `Get it: ${C.cyan}fluidnative.com${C.reset} → Developer Console → API Keys`);
  }
  if (!privateKey) {
    info(`${stepN++}.`, `${C.dim}[Optional]${C.reset} Add ${C.cyan}VITE_FLUID_PRIVATE_KEY=0x...${C.reset} to ${C.gray}.env.local${C.reset} ${C.dim}(enables swap execution)${C.reset}`);
  }
  info(`${stepN}.`, `${C.cyan}npm run dev${C.reset}  — opens at http://localhost:5173`);

  log("");
  log(`  ${C.bold}What's inside:${C.reset}`);
  log(`  ${C.gray}·${C.reset} React 18 + Vite + TypeScript + viem`);
  log(`  ${C.gray}·${C.reset} FluidSOR swap interface — live DEX price indexing`);
  log(`  ${C.gray}·${C.reset} Routes from Fluid AMM, Uniswap V3, Aerodrome — best price auto-selected`);
  log(`  ${C.gray}·${C.reset} Direct private key signing — no MetaMask popup needed`);
  log(`  ${C.gray}·${C.reset} One-click "Route via FluidSOR" button executes the best swap`);
  log("");
  log(`  ${C.bold}Resources:${C.reset}`);
  info("Docs",   "https://fluidnative.com/sdk");
  info("GitHub", "https://github.com/fluidbase9/fluid-sor");
  info("npm",    "https://www.npmjs.com/package/@fluidwalletbase/sdk");
  log("");
  log(`  ${C.cyan}${C.bold}Powered by Fluid · https://fluidnative.com${C.reset}`);
  log("");
}

main().catch((e) => {
  err("Unexpected error: " + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
