#!/usr/bin/env node
"use strict";

const path   = require("path");
const fs     = require("fs");
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
};

const log  = (msg)             => process.stdout.write(msg + "\n");
const info = (label, msg)      => log(`  ${C.cyan}${label}${C.reset}  ${msg}`);
const ok   = (msg)             => log(`  ${C.green}✓${C.reset}  ${msg}`);
const warn = (msg)             => log(`  ${C.yellow}!${C.reset}  ${msg}`);
const err  = (msg)             => log(`  ${C.red}✗${C.reset}  ${msg}`);
const step = (n, total, msg)   => log(`\n  ${C.bold}[${n}/${total}]${C.reset} ${msg}`);

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
  const args = process.argv.slice(2);
  // strip the "create" sub-command if present
  const filtered = args.filter((a) => a !== "create" && !a.startsWith("--"));
  const name = filtered[0];
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
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.name = projectName.toLowerCase().replace(/\s+/g, "-");
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner();

  const projectName = getProjectName();
  const projectPath = path.resolve(process.cwd(), projectName);
  const templateDir = path.resolve(__dirname, "../templates/react-swap");
  const TOTAL_STEPS = 4;

  if (fs.existsSync(projectPath)) {
    err(`Directory ${C.cyan}${projectName}${C.reset} already exists.`);
    err("Choose a different name or remove the directory first.");
    process.exit(1);
  }

  if (!fs.existsSync(templateDir)) {
    err("Template files missing. Please reinstall @fluidwalletbase/sdk.");
    process.exit(1);
  }

  step(1, TOTAL_STEPS, `Scaffolding ${C.cyan}${projectName}${C.reset}…`);
  copyDir(templateDir, projectPath);
  patchPackageJson(projectPath, projectName);
  ok(`Copied template → ${C.gray}./${projectName}${C.reset}`);

  step(2, TOTAL_STEPS, "Installing dependencies…");
  const pm = detectPm();
  try {
    execSync(`${pm} install`, { cwd: projectPath, stdio: "pipe" });
    ok(`Dependencies installed (${C.cyan}${pm}${C.reset})`);
  } catch {
    warn("Auto-install failed. Run manually:");
    info("  →", `cd ${projectName} && npm install`);
  }

  step(3, TOTAL_STEPS, "Writing .env.local…");
  const envContent = [
    "# FluidSOR contract address on Base mainnet",
    "# Deploy contracts/FluidSOR.sol then paste the address here",
    "VITE_FLUID_SOR_ADDRESS=",
    "",
    "# WalletConnect project ID — get one free at https://cloud.walletconnect.com",
    "VITE_WALLETCONNECT_PROJECT_ID=",
  ].join("\n");
  fs.writeFileSync(path.join(projectPath, ".env.local"), envContent);
  ok("Created .env.local");

  step(4, TOTAL_STEPS, "Done! 🎉");
  log("");
  log(`  ${C.green}${C.bold}Your Fluid swap app is ready.${C.reset}`);
  log("");
  log(`  ${C.bold}Next steps:${C.reset}`);
  info("1.", `cd ${C.cyan}${projectName}${C.reset}`);
  info("2.", `Fill in ${C.gray}.env.local${C.reset} with your ${C.cyan}VITE_FLUID_SOR_ADDRESS${C.reset}`);
  info("3.", `${C.cyan}npm run dev${C.reset}  — opens at http://localhost:5173`);
  log("");
  log(`  ${C.bold}What's inside:${C.reset}`);
  log(`  ${C.gray}·${C.reset} React 18 + Vite + TypeScript`);
  log(`  ${C.gray}·${C.reset} wagmi v2 + viem wallet connection`);
  log(`  ${C.gray}·${C.reset} FluidSOR swap interface (USDC / USDT / WETH on Base)`);
  log(`  ${C.gray}·${C.reset} "Connect Wallet" + "Connect to Fluid" buttons`);
  log(`  ${C.gray}·${C.reset} Live route quotes from the Fluid SOR API`);
  log(`  ${C.gray}·${C.reset} Multi-path split routing across Fluid AMM, Uniswap V3, Aerodrome`);
  log("");
  log(`  ${C.bold}Resources:${C.reset}`);
  info("Docs",    "https://fluidnative.com/sdk");
  info("GitHub",  "https://github.com/fluidwallet/fluid-sor");
  info("npm",     "https://www.npmjs.com/package/@fluidwalletbase/sdk");
  log("");
  log(`  ${C.cyan}${C.bold}Powered by Fluid · https://fluidnative.com${C.reset}`);
  log("");
}

main().catch((e) => {
  err("Unexpected error: " + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
