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
  log(`${C.cyan}${C.bold}  ╔══════════════════════════════════════════════════╗${C.reset}`);
  log(`${C.cyan}${C.bold}  ║   @fluidwalletbase/wallet-endpoints              ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ║   Fluid Developer Starter App                    ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ╚══════════════════════════════════════════════════╝${C.reset}`);
  log(`  ${C.gray}FluidWalletClient · fluidnative.com${C.reset}`);
  log("");
}

// ─── Parse args ───────────────────────────────────────────────────────────────

function getProjectName() {
  const args     = process.argv.slice(2);
  const filtered = args.filter(a => a !== "create" && !a.startsWith("--"));
  const name     = filtered[0];
  if (!name) {
    err("Please provide a project name:");
    log(`    npx @fluidwalletbase/wallet-endpoints create ${C.cyan}my-fluid-app${C.reset}`);
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
  log(`  ${C.gray}Required to call authenticated endpoints (balance, quote, send, swap).${C.reset}`);
  log(`  ${C.gray}Get yours: ${C.cyan}fluidnative.com${C.gray} → Developer Console → API Keys tab${C.reset}`);
  log("");

  while (true) {
    const key = await prompt(`  ${C.cyan}?${C.reset} Paste API key ${C.dim}(fw_sor_...)${C.reset}: `);
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner();

  const projectName = getProjectName();
  const projectPath = path.resolve(process.cwd(), projectName);
  const templateDir = path.resolve(__dirname, "../templates/starter");
  const TOTAL_STEPS = 4;

  if (fs.existsSync(projectPath)) {
    err(`Directory ${C.cyan}${projectName}${C.reset} already exists.`);
    err("Choose a different name or remove the directory first.");
    process.exit(1);
  }

  if (!fs.existsSync(templateDir)) {
    err("Template files missing. Please reinstall @fluidwalletbase/wallet-endpoints.");
    process.exit(1);
  }

  // ── Step 1: API key ────────────────────────────────────────────────────────
  step(1, TOTAL_STEPS, "Fluid API key setup");
  const apiKey = await promptApiKey();

  // ── Step 2: Scaffold ───────────────────────────────────────────────────────
  step(2, TOTAL_STEPS, `Scaffolding ${C.cyan}${projectName}${C.reset}…`);
  copyDir(templateDir, projectPath);
  patchPackageJson(projectPath, projectName);
  ok(`Copied template → ${C.gray}./${projectName}${C.reset}`);

  // ── Step 3: Install deps ───────────────────────────────────────────────────
  step(3, TOTAL_STEPS, "Installing dependencies…");
  const pm = detectPm();
  try {
    execSync(`${pm} install`, { cwd: projectPath, stdio: "pipe" });
    ok(`Dependencies installed (${C.cyan}${pm}${C.reset})`);
  } catch {
    warn("Auto-install failed. Run manually:");
    info("  →", `cd ${projectName} && npm install`);
  }

  // ── Step 4: Write .env.local ───────────────────────────────────────────────
  step(4, TOTAL_STEPS, "Writing .env.local…");

  const envContent = [
    "# ─── Fluid SDK API key (REQUIRED) ───────────────────────────────────────────",
    "# Derive yours: fluidnative.com → Developer Console → API Keys tab",
    `VITE_FLUID_API_KEY=${apiKey}`,
    "",
    "# ─── Optional: override the backend URL (defaults to https://fluidnative.com) ─",
    "# VITE_BASE_URL=https://fluidnative.com",
  ].join("\n");

  fs.writeFileSync(path.join(projectPath, ".env.local"), envContent);

  const gitignore = ["node_modules", ".env.local", "dist", ".DS_Store"].join("\n");
  fs.writeFileSync(path.join(projectPath, ".gitignore"), gitignore + "\n");

  ok(`API key written  ${C.dim}${apiKey.slice(0, 13)}•••${C.reset}`);
  ok(`.env.local created  ${C.dim}(git-ignored)${C.reset}`);

  // ── Done ──────────────────────────────────────────────────────────────────
  log("");
  log(`  ${C.green}${C.bold}Your Fluid developer starter is ready!${C.reset}`);
  log("");
  log(`  ${C.bold}Next steps:${C.reset}`);
  info("cd", `${projectName}`);
  info("npm run dev", `→ ${C.cyan}http://localhost:5173${C.reset}`);
  log("");
  log(`  ${C.gray}The app opens a live endpoint explorer — run any FluidWalletClient${C.reset}`);
  log(`  ${C.gray}method directly from the browser and see the raw JSON response.${C.reset}`);
  log("");
  log(`  ${C.bold}Available endpoints:${C.reset}`);
  log(`  ${C.cyan}•${C.reset} getWalletInfo()             — addresses, Fluid ID`);
  log(`  ${C.cyan}•${C.reset} getBalance("base")          — USDC balance`);
  log(`  ${C.cyan}•${C.reset} resolveFluidId(username)    — Fluid ID → address`);
  log(`  ${C.cyan}•${C.reset} reverseFluidId(address)     — address → Fluid ID`);
  log(`  ${C.cyan}•${C.reset} getRoutingPrices(...)        — live 25+ DEX prices`);
  log(`  ${C.cyan}•${C.reset} getQuote(...)               — best SOR route`);
  log(`  ${C.cyan}•${C.reset} getSwapHistory(email)       — tx history`);
  log(`  ${C.cyan}•${C.reset} getUsageStats(email)        — API call analytics`);
  log("");
  log(`  ${C.gray}Docs: ${C.cyan}fluidnative.com${C.gray} · npm: ${C.cyan}@fluidwalletbase/wallet-endpoints${C.reset}`);
  log("");
}

main().catch(e => {
  process.stderr.write("\n  " + String(e) + "\n\n");
  process.exit(1);
});
