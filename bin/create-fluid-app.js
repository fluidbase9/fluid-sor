#!/usr/bin/env node
"use strict";

const path         = require("path");
const fs           = require("fs");
const readline     = require("readline");
const { execSync } = require("child_process");

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
      `  ${C.cyan}?${C.reset} Paste API key ${C.dim}(fw_sor_...)${C.reset}: `
    );
    if (!key.trim()) {
      err(`API key is required. Get yours at ${C.cyan}fluidnative.com${C.reset} → Developer Console → API Keys.`);
      continue;
    }
    if (!key.trim().startsWith("fw_sor_")) {
      err(`Invalid format — keys start with ${C.cyan}fw_sor_${C.reset}. Try again.`);
      continue;
    }
    ok(`API key accepted  ${C.dim}${key.slice(0, 13)}${"•".repeat(10)}${C.reset}`);
    return key.trim();
  }
}

// ─── Interactive seed phrase prompt ───────────────────────────────────────────

async function promptSeedPhrase() {
  log("");
  log(`  ${C.bold}Fluid Account Seed Phrase${C.reset}`);
  log(`  ${C.gray}Your 12 or 24-word BIP-39 mnemonic — the master key for your Fluid wallet.${C.reset}`);
  log(`  ${C.gray}Used to derive your wallet address and sign transactions server-side.${C.reset}`);
  log(`  ${C.yellow}!${C.reset}  ${C.gray}Never share this with anyone. It is written only to ${C.cyan}.env.local${C.gray} (git-ignored).${C.reset}`);
  log("");

  while (true) {
    const phrase = await prompt(
      `  ${C.cyan}?${C.reset} Paste seed phrase ${C.dim}(12 or 24 words)${C.reset}: `
    );
    if (!phrase.trim()) {
      err("Seed phrase is required to set up your Fluid wallet. Cannot proceed without it.");
      continue;
    }
    const words = phrase.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      err(`Expected 12 or 24 words — got ${words.length}. Check your phrase and try again.`);
      continue;
    }
    const preview = `${words[0]} ${words[1]} ${words[2]} … ${words[words.length - 1]}`;
    ok(`Seed phrase accepted  ${C.dim}(${words.length} words: ${preview})${C.reset}`);
    return phrase.trim();
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

  // ── Step 2: Seed phrase ────────────────────────────────────────────────────
  step(2, TOTAL_STEPS, "Fluid account seed phrase");
  const seedPhrase = await promptSeedPhrase();

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

  const envContent = [
    "# ─── Fluid SDK API key (REQUIRED) ───────────────────────────────────────────",
    "# Derive yours: fluidnative.com → Developer Console → API Keys tab",
    `VITE_FLUID_API_KEY=${apiKey}`,
    "",
    "# ─── Fluid account seed phrase (REQUIRED) ───────────────────────────────────",
    "# Your 12 or 24-word BIP-39 mnemonic — derives your wallet addresses",
    `VITE_FLUID_SEED_PHRASE=${seedPhrase}`,
    "",
    "# ─── FluidSOR contract (pre-filled — live on Base mainnet) ──────────────────",
    "VITE_FLUID_SOR_ADDRESS=0xF24daF8Fe15383fb438d48811E8c4b43749DafAE",
  ].join("\n");

  fs.writeFileSync(path.join(projectPath, ".env.local"), envContent);

  // Write .gitignore
  const gitignore = ["node_modules", ".env.local", "dist", ".DS_Store"].join("\n");
  fs.writeFileSync(path.join(projectPath, ".gitignore"), gitignore + "\n");

  ok(`API key + seed phrase written to ${C.gray}.env.local${C.reset}`);

  // ── Done ───────────────────────────────────────────────────────────────────
  log("");
  log(`  ${C.green}${C.bold}Your Fluid swap app is ready.${C.reset}`);
  log("");
  log(`  ${C.bold}Next steps:${C.reset}`);
  info("1.", `cd ${C.cyan}${projectName}${C.reset}`);

  info("2.", `${C.cyan}npm run dev${C.reset}  — opens at http://localhost:5173`);

  log("");
  log(`  ${C.bold}What's inside:${C.reset}`);
  log(`  ${C.gray}·${C.reset} React 18 + Vite + TypeScript`);
  log(`  ${C.gray}·${C.reset} FluidSOR swap interface — live DEX price indexing`);
  log(`  ${C.gray}·${C.reset} Routes from Fluid AMM, Uniswap V3, Aerodrome — best price auto-selected`);
  log(`  ${C.gray}·${C.reset} Server-side execution — no private key or MetaMask needed`);
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
