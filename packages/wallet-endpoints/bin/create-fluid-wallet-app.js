#!/usr/bin/env node
"use strict";

const crypto       = require("crypto");
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
  white:  "\x1b[37m",
};

const log  = (msg = "")        => process.stdout.write(msg + "\n");
const ok   = (msg)             => log(`  ${C.green}✓${C.reset}  ${msg}`);
const warn = (msg)             => log(`  ${C.yellow}⚠${C.reset}  ${msg}`);
const err  = (msg)             => log(`  ${C.red}✗${C.reset}  ${msg}`);
const info = (label, msg)      => log(`  ${C.cyan}${label}${C.reset}  ${msg}`);
const step = (n, total, msg)   => log(`\n  ${C.bold}[${n}/${total}]${C.reset} ${msg}`);

// ─── BIP-39 wordlist (first 256 words — 96-bit entropy for 12-word phrase) ───

const BIP39 = [
  "abandon","ability","able","about","above","absent","absorb","abstract",
  "absurd","abuse","access","accident","account","accuse","achieve","acid",
  "acoustic","acquire","across","act","action","actor","actress","actual",
  "adapt","add","addict","address","adjust","admit","adult","advance",
  "advice","aerobic","afford","afraid","again","age","agent","agree",
  "ahead","aim","air","airport","aisle","alarm","album","alcohol",
  "alert","alien","all","alley","allow","almost","alone","alpha",
  "already","also","alter","always","amateur","amazing","among","amount",
  "amused","analyst","anchor","ancient","anger","angle","angry","animal",
  "ankle","announce","annual","another","answer","antenna","antique","anxiety",
  "any","apart","apology","appear","apple","approve","april","arch",
  "arctic","area","arena","argue","arm","armed","armor","army",
  "around","arrange","arrest","arrive","arrow","art","artefact","artist",
  "artwork","ask","aspect","assault","asset","assist","assume","asthma",
  "athlete","atom","attack","attend","attitude","attract","auction","audit",
  "august","aunt","author","auto","autumn","average","avocado","avoid",
  "awake","aware","away","awesome","awful","awkward","axis","baby",
  "bacon","badge","bag","balance","balcony","ball","bamboo","banana",
  "banner","bar","barely","bargain","barrel","base","basic","basket",
  "battle","beach","bean","beauty","because","become","beef","before",
  "begin","behave","behind","believe","below","belt","bench","benefit",
  "best","betray","better","between","beyond","bicycle","bid","bike",
  "bind","biology","bird","birth","bitter","black","blade","blame",
  "blanket","blast","bleak","bless","blind","blood","blossom","blouse",
  "blue","blur","blush","board","boat","body","boil","bomb",
  "bone","book","boost","border","boring","borrow","boss","bottom",
  "bounce","box","boy","bracket","brain","brand","brave","breeze",
  "brick","bridge","brief","bright","bring","brisk","broccoli","broken",
  "bronze","broom","brother","brown","brush","bubble","buddy","budget",
  "buffalo","build","bulb","bulk","bullet","bundle","bunker","burden",
  "burger","burst","bus","business","busy","butter","buyer","buzz",
  "cabbage","cabin","cable","cactus","cage","cake","call","calm",
]; // 256 words · 8 bits per word · 12 words = 96 bits entropy

// ─── Mnemonic generation ──────────────────────────────────────────────────────

function generateMnemonic() {
  const entropy = crypto.randomBytes(12); // 12 bytes → 12 words
  return Array.from(entropy).map(b => BIP39[b]); // each byte 0-255 → word
}

// ─── API key derivation (client-side only — mnemonic never sent to server) ───

function deriveSdkApiKey(words) {
  const mnemonic = words.join(" ");
  const hash = crypto.createHmac("sha256", mnemonic).update("fluid-wallet-key-v1").digest("hex");
  return `fw_sor_${hash.slice(0, 24)}`;
}

function sha256hex(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// ─── Base32 (RFC 4648) ────────────────────────────────────────────────────────

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  while (out.length % 8) out += "=";
  return out;
}

function base32Decode(str) {
  const chars = str.toUpperCase().replace(/=+$/, "");
  let bits = 0, value = 0;
  const out = [];
  for (const ch of chars) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

// ─── TOTP (RFC 6238 / HOTP RFC 4226) ─────────────────────────────────────────

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20)).replace(/=+$/, ""); // 160-bit secret
}

function verifyTOTP(secret, token, window = 1) {
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    const counter  = BigInt(now + i);
    const buf      = Buffer.alloc(8);
    buf.writeBigUInt64BE(counter);
    const hmac     = crypto.createHmac("sha1", key).update(buf).digest();
    const offset   = hmac[19] & 0xf;
    const code     = (
      ((hmac[offset]     & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8)  |
       (hmac[offset + 3] & 0xff)
    ) % 1_000_000;
    if (String(code).padStart(6, "0") === token.trim()) return true;
  }
  return false;
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function banner() {
  log();
  log(`${C.cyan}${C.bold}  ╔══════════════════════════════════════════════════╗${C.reset}`);
  log(`${C.cyan}${C.bold}  ║   @fluidwalletbase/wallet-endpoints              ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ║   Fluid Developer Starter App                    ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ╚══════════════════════════════════════════════════╝${C.reset}`);
  log(`  ${C.gray}FluidWalletClient · fluidnative.com${C.reset}`);
  log();
}

// ─── Args ─────────────────────────────────────────────────────────────────────

function getProjectName() {
  const args = process.argv.slice(2).filter(a => a !== "create" && !a.startsWith("--"));
  const name = args[0];
  if (!name) {
    err("Please provide a project name:");
    log(`    npx @fluidwalletbase/wallet-endpoints create ${C.cyan}my-fluid-app${C.reset}`);
    log();
    process.exit(1);
  }
  return name;
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

// Password prompt with • masking and backspace support
async function promptPassword(label) {
  return new Promise(resolve => {
    process.stdout.write(`  ${C.cyan}?${C.reset} ${label}: `);
    let password = "";

    // Fall back to plain prompt if raw mode unsupported (e.g. CI pipe)
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: null });
      rl.question("", answer => { rl.close(); resolve(answer.trim()); process.stdout.write("\n"); });
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function onData(char) {
      if (char === "\r" || char === "\n" || char === "") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(password);
      } else if (char === "") {
        process.stdout.write("\n");
        process.exit(0);
      } else if (char === "" || char === "") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(`  ${C.cyan}?${C.reset} ${label}: ${"•".repeat(password.length)}`);
        }
      } else if (char.charCodeAt(0) >= 32) {
        password += char;
        process.stdout.write("•");
      }
    }

    process.stdin.on("data", onData);
  });
}

// ─── Step 1 — Wallet type ─────────────────────────────────────────────────────

async function promptWalletType() {
  log(`  ${C.bold}Wallet Type${C.reset}`);
  log(`  ${C.gray}Choose the wallet for your Fluid integration.${C.reset}`);
  log();
  log(`    ${C.cyan}1${C.reset}  ${C.bold}Client Wallet${C.reset}      — for end users of your app`);
  log(`    ${C.cyan}2${C.reset}  ${C.bold}Developer Wallet${C.reset}   — server-side / backend wallet`);
  log();

  while (true) {
    const choice = await prompt(`  ${C.cyan}?${C.reset} Enter 1 or 2: `);
    if (choice === "1") return "client";
    if (choice === "2") return "developer";
    err("Please enter 1 or 2.");
  }
}

// ─── Step 2 — Account details ─────────────────────────────────────────────────

async function promptAccountDetails(walletType) {
  const label = walletType === "client" ? "Client Wallet" : "Developer Wallet";
  log(`  ${C.bold}Account Details${C.reset}  ${C.gray}(${label})${C.reset}`);
  log();

  let email;
  while (true) {
    email = await prompt(`  ${C.cyan}?${C.reset} Your email address: `);
    if (email && email.includes("@") && email.includes(".")) break;
    err("Please enter a valid email address.");
  }

  let password;
  while (true) {
    password        = await promptPassword("Create a password");
    const confirmed = await promptPassword("Confirm password");
    if (password.length < 8)  { err("Password must be at least 8 characters."); continue; }
    if (password !== confirmed){ err("Passwords do not match. Try again."); continue; }
    break;
  }

  ok(`Account details set  ${C.dim}${email}${C.reset}`);
  return { email, password };
}

// ─── Step 3 — Seed phrase ─────────────────────────────────────────────────────

async function generateAndConfirmSeedPhrase() {
  const words = generateMnemonic();

  log();
  log(`  ${C.yellow}${C.bold}╔══════════════════════════════════════════════════════════════╗${C.reset}`);
  log(`  ${C.yellow}${C.bold}║  ⚠  YOUR SEED PHRASE — READ CAREFULLY BEFORE CONTINUING      ║${C.reset}`);
  log(`  ${C.yellow}${C.bold}╠══════════════════════════════════════════════════════════════╣${C.reset}`);
  log(`  ${C.yellow}║${C.reset}  This is the ONLY backup for your Fluid Wallet.              ${C.yellow}║${C.reset}`);
  log(`  ${C.yellow}║${C.reset}  Write it on paper and keep it offline and secret.           ${C.yellow}║${C.reset}`);
  log(`  ${C.yellow}║${C.reset}  You CANNOT recover your wallet without this phrase.         ${C.yellow}║${C.reset}`);
  log(`  ${C.yellow}║${C.reset}  Fluid ${C.bold}cannot${C.reset} recover it — it ${C.bold}never leaves this device.${C.reset}       ${C.yellow}║${C.reset}`);
  log(`  ${C.yellow}${C.bold}╚══════════════════════════════════════════════════════════════╝${C.reset}`);
  log();

  log(`  ${C.bold}Your 12-word seed phrase:${C.reset}`);
  log();
  for (let i = 0; i < 12; i += 3) {
    const cols = [i, i + 1, i + 2].map(j => {
      const num  = String(j + 1).padStart(2, " ");
      const word = (words[j] || "").padEnd(12, " ");
      return `${C.dim}${num}.${C.reset} ${C.bold}${C.white}${word}${C.reset}`;
    });
    log(`  ${cols.join("   ")}`);
  }

  log();
  log(`  ${C.yellow}⚠  This phrase will ${C.bold}NOT${C.reset}${C.yellow} be shown again. Write it down NOW.${C.reset}`);
  log();

  while (true) {
    const confirm = await prompt(
      `  ${C.cyan}?${C.reset} Type ${C.bold}SAVED${C.reset} to confirm you have written down your seed phrase: `
    );
    if (confirm === "SAVED") break;
    warn(`Type exactly ${C.bold}SAVED${C.reset} (all caps) to continue.`);
  }

  ok(`Seed phrase confirmed`);
  return words;
}

// ─── Step 4 — Two-factor authentication (TOTP + QR code) ─────────────────────

async function setupOTP(email) {
  const secret     = generateTotpSecret();
  const otpauthUrl = `otpauth://totp/FluidWallet:${encodeURIComponent(email)}?secret=${secret}&issuer=FluidWallet&algorithm=SHA1&digits=6&period=30`;

  log();
  log(`  ${C.bold}Two-Factor Authentication Setup${C.reset}`);
  log(`  ${C.gray}Open Google Authenticator, Authy, or any TOTP app.${C.reset}`);
  log(`  ${C.gray}Scan the QR code below — or enter the secret manually.${C.reset}`);
  log();

  try {
    const QRCode = require("qrcode");
    const qr = await QRCode.toString(otpauthUrl, { type: "terminal", small: true });
    log(qr);
  } catch {
    log(`  ${C.dim}(QR rendering unavailable — use the secret key below)${C.reset}`);
    log();
  }

  log(`  ${C.bold}Secret key:${C.reset}  ${C.cyan}${secret}${C.reset}`);
  log(`  ${C.gray}Manual entry: Account = ${C.reset}${C.dim}FluidWallet · ${email}${C.reset}`);
  log(`  ${C.gray}              Period  = 30 s  ·  Digits = 6  ·  Algorithm = SHA-1${C.reset}`);
  log();

  let attempts = 0;
  while (true) {
    const token = await prompt(`  ${C.cyan}?${C.reset} Enter the 6-digit code from your authenticator: `);
    if (!/^\d{6}$/.test(token.trim())) { err("Enter exactly 6 digits."); continue; }
    if (verifyTOTP(secret, token)) {
      ok(`OTP verified  ${C.dim}2FA is active${C.reset}`);
      return secret;
    }
    attempts++;
    if (attempts >= 5) {
      warn("Too many incorrect codes. Check your authenticator app's time sync and try again.");
      warn(`Continuing without OTP verification — re-run setup to enable 2FA.`);
      return null;
    }
    err(`Incorrect code (${attempts}/5). Wait for the next 30-second code and try again.`);
  }
}

// ─── Step 5 — Register with Fluid backend ────────────────────────────────────

async function registerWallet({ email, password, apiKey, totpSecret, walletType }) {
  const keyHash = sha256hex(apiKey);
  const keyHint = apiKey.slice(0, 13);

  process.stdout.write(`  ${C.gray}Contacting Fluid backend…${C.reset}\n`);
  try {
    const body = JSON.stringify({
      email,
      keyHash,
      keyHint,
      walletType,
      totpEnabled:     !!totpSecret,
      totpSecretHint:  totpSecret ? totpSecret.slice(0, 8) : null,
    });

    const res  = await fetch("https://fluidnative.com/api/developer/register-key", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();

    if (data.success && data.wallets) {
      ok(`Wallet registered with Fluid`);
      log();
      if (data.wallets.base)     ok(`Base:     ${C.dim}${data.wallets.base}${C.reset}`);
      if (data.wallets.ethereum) ok(`Ethereum: ${C.dim}${data.wallets.ethereum}${C.reset}`);
      if (data.wallets.solana)   ok(`Solana:   ${C.dim}${data.wallets.solana}${C.reset}`);
      return data.wallets;
    }

    warn(`Registration note: ${data.error ?? JSON.stringify(data)}`);
    warn("Your API key is still valid — it will be fully activated on first use.");
    return null;
  } catch (e) {
    warn(`Could not reach Fluid backend (${e.message}).`);
    warn("Your API key is ready — registration completes automatically on first API call.");
    return null;
  }
}

// ─── Template scaffold helpers ────────────────────────────────────────────────

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function patchPackageJson(projectPath, projectName) {
  const pkgPath = path.join(projectPath, "package.json");
  const pkg     = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.name      = projectName.toLowerCase().replace(/\s+/g, "-");
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

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
  const templateDir = path.resolve(__dirname, "../templates/starter");
  const TOTAL = 7;

  if (fs.existsSync(projectPath)) {
    err(`Directory ${C.cyan}${projectName}${C.reset} already exists.`);
    err("Choose a different name or remove the directory first.");
    process.exit(1);
  }
  if (!fs.existsSync(templateDir)) {
    err("Template files missing. Please reinstall @fluidwalletbase/wallet-endpoints.");
    process.exit(1);
  }

  // ── 1 · Wallet type ────────────────────────────────────────────────────────
  step(1, TOTAL, "Wallet Setup");
  const walletType = await promptWalletType();

  // ── 2 · Account details ────────────────────────────────────────────────────
  step(2, TOTAL, "Account Details");
  const { email, password } = await promptAccountDetails(walletType);

  // ── 3 · Seed phrase ────────────────────────────────────────────────────────
  step(3, TOTAL, "Seed Phrase");
  const seedWords = await generateAndConfirmSeedPhrase();
  const apiKey    = deriveSdkApiKey(seedWords);

  // ── 4 · OTP / 2FA ──────────────────────────────────────────────────────────
  step(4, TOTAL, "Two-Factor Authentication");
  const totpSecret = await setupOTP(email);

  // ── 5 · Register ───────────────────────────────────────────────────────────
  step(5, TOTAL, "Registering wallet…");
  await registerWallet({ email, password, apiKey, totpSecret, walletType });

  // ── 6 · Scaffold ───────────────────────────────────────────────────────────
  step(6, TOTAL, `Scaffolding ${C.cyan}${projectName}${C.reset}…`);
  copyDir(templateDir, projectPath);
  patchPackageJson(projectPath, projectName);
  ok(`Template copied → ${C.gray}./${projectName}${C.reset}`);

  const pm = detectPm();
  try {
    execSync(`${pm} install`, { cwd: projectPath, stdio: "pipe" });
    ok(`Dependencies installed (${C.cyan}${pm}${C.reset})`);
  } catch {
    warn("Auto-install failed. Run manually:");
    info("  →", `cd ${projectName} && npm install`);
  }

  // ── 7 · Write .env.local ───────────────────────────────────────────────────
  step(7, TOTAL, "Writing environment config…");

  const walletLabel = walletType === "client" ? "Client Wallet" : "Developer Wallet";
  const envLines = [
    `# ─── Fluid ${walletLabel} · generated ${new Date().toISOString()} ─────────`,
    `# ⚠  This file contains secrets — it is git-ignored automatically`,
    "",
    `VITE_FLUID_API_KEY=${apiKey}`,
    `VITE_FLUID_EMAIL=${email}`,
    `VITE_WALLET_TYPE=${walletType}`,
    "",
    "# ─── Optional: override backend URL ─────────────────────────────────────────",
    "# VITE_BASE_URL=https://fluidnative.com",
    "",
    "# ─── TOTP secret (needed for server-side 2FA verification) ──────────────────",
    totpSecret
      ? `# FLUID_TOTP_SECRET=${totpSecret}`
      : "# FLUID_TOTP_SECRET=<not set — re-run setup to enable 2FA>",
    "# (uncomment FLUID_TOTP_SECRET and move to a server-only env file for production)",
  ];

  fs.writeFileSync(path.join(projectPath, ".env.local"), envLines.join("\n") + "\n");
  fs.writeFileSync(
    path.join(projectPath, ".gitignore"),
    ["node_modules", ".env.local", "dist", ".DS_Store"].join("\n") + "\n"
  );

  ok(`API key written     ${C.dim}${apiKey.slice(0, 13)}${"•".repeat(10)}${C.reset}`);
  ok(`.env.local created  ${C.dim}(git-ignored)${C.reset}`);

  // ── Done ──────────────────────────────────────────────────────────────────
  log();
  log(`  ${C.green}${C.bold}Your Fluid ${walletLabel} starter is ready!${C.reset}`);
  log();
  log(`  ${C.bold}Next steps:${C.reset}`);
  info("cd", projectName);
  info("npm run dev", `→ ${C.cyan}http://localhost:5173${C.reset}`);
  log();
  log(`  ${C.bold}Available endpoints in the starter app:${C.reset}`);
  log(`  ${C.cyan}•${C.reset} Wallet info  — address, Fluid ID, chain`);
  log(`  ${C.cyan}•${C.reset} USDC balance — Base / Ethereum / Solana`);
  log(`  ${C.cyan}•${C.reset} Payout panel — send to multiple recipients`);
  log(`  ${C.cyan}•${C.reset} SOR quotes   — live 25+ DEX routing prices`);
  log();
  log(`  ${C.gray}Docs: ${C.cyan}fluidnative.com${C.gray} · npm: ${C.cyan}@fluidwalletbase/wallet-endpoints${C.reset}`);
  log();
}

main().catch(e => {
  process.stderr.write("\n  " + String(e) + "\n\n");
  process.exit(1);
});
