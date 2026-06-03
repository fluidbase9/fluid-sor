#!/usr/bin/env node
"use strict";

const path         = require("path");
const fs           = require("fs");
const readline     = require("readline");
const crypto       = require("crypto");
const { execSync } = require("child_process");
const https        = require("https");
const http         = require("http");

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

const W    = process.stdout.columns || 72;
const hr   = (ch = "─") => C.dim + ch.repeat(W) + C.reset;
const log  = (msg = "")       => process.stdout.write(msg + "\n");
const ok   = (msg)            => log(`  ${C.green}✓${C.reset}  ${msg}`);
const warn = (msg)            => log(`  ${C.yellow}⚠${C.reset}  ${msg}`);
const fail = (msg)            => log(`  ${C.red}✗${C.reset}  ${msg}`);
const step = (n, tot, msg)    => log(`\n${C.bold}${C.cyan}── Step ${n}/${tot}: ${msg}${C.reset}\n`);
const label = (k, v)          => log(`  ${C.gray}${k.padEnd(26)}${C.reset}${v}`);

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function apiPost(url, body) {
  return new Promise((resolve) => {
    const parsed  = new URL(url);
    const mod     = parsed.protocol === "https:" ? https : http;
    const payload = JSON.stringify(body);
    const req     = mod.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.pathname,
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, res => {
      let d = "";
      res.on("data", c => (d += c));
      res.on("end",  () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on("error", () => resolve({}));
    req.write(payload);
    req.end();
  });
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function banner() {
  log("");
  log(`${C.cyan}${C.bold}  ╔══════════════════════════════════════════╗${C.reset}`);
  log(`${C.cyan}${C.bold}  ║      fluid-sor · create-fluid-app        ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ║   Smart Order Routing on Base Mainnet    ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ╚══════════════════════════════════════════╝${C.reset}`);
  log(`  ${C.gray}Powered by FluidSOR · fluidnative.com${C.reset}`);
  log("");
}

// ─── Parse args ───────────────────────────────────────────────────────────────

function getProjectNameFromArgs() {
  const args     = process.argv.slice(2);
  const filtered = args.filter(a => a !== "create" && !a.startsWith("--"));
  return filtered[0] || null;
}

async function askProjectName() {
  let name = getProjectNameFromArgs();
  if (name) return name;
  while (true) {
    name = (await prompt(`  ${C.cyan}?${C.reset} Project name: `)).trim();
    if (name) return name;
    warn("Please enter a project name");
  }
}

// ─── Mode selector ────────────────────────────────────────────────────────────

async function selectMode() {
  const modes = [
    {
      key:      "a",
      title:    `${C.bold}${C.cyan}Scaffold project with SOR protocol  (developer)${C.reset}`,
      desc:     `${C.gray}Full scaffold — React + SOR routing, all keys auto-generated.${C.reset}`,
      disabled: false,
    },
    {
      key:      "b",
      title:    `${C.bold}${C.cyan}Install SOR in my existing project  (developer)${C.reset}`,
      desc:     `${C.gray}Add SOR routing + price feeds to your project. Wallet optional.${C.reset}`,
      disabled: false,
    },
    {
      key:      "c",
      title:    `${C.bold}${C.gray}Scaffold project with SOR protocol  (agents)${C.reset}  ${C.yellow}(coming soon)${C.reset}`,
      desc:     `${C.gray}Full scaffold with agent wallet auto-setup + SOR skills.${C.reset}`,
      disabled: true,
    },
    {
      key:      "d",
      title:    `${C.bold}${C.gray}Install SOR in existing project  (agents)${C.reset}  ${C.yellow}(coming soon)${C.reset}`,
      desc:     `${C.gray}Add SOR agent skills + wallet to your existing agent project.${C.reset}`,
      disabled: true,
    },
  ];

  log(`  ${C.bold}What would you like to do?${C.reset}`);
  log("");
  for (const m of modes) {
    log(`  ${C.cyan}[${m.key}]${C.reset}  ${m.title}`);
    log(`       ${m.desc}`);
    log("");
  }

  while (true) {
    const ans = (await prompt(`Choose ${C.cyan}a${C.reset}, ${C.cyan}b${C.reset}, ${C.cyan}c${C.reset} or ${C.cyan}d${C.reset}: `)).toLowerCase().trim();
    if (ans === "c" || ans === "d") { warn("Coming soon — choose a or b"); continue; }
    if (ans === "a" || ans === "b") return ans;
    warn("Enter a or b");
  }
}

// ─── Copy template ────────────────────────────────────────────────────────────

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

// ─── Detect package manager ───────────────────────────────────────────────────

function detectPm() {
  const ua = process.env.npm_config_user_agent || "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun"))  return "bun";
  return "npm";
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
  });
}

function promptPassword(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    let value = "";
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = char => {
      if (char === "\r" || char === "\n") {
        process.stdout.write("\n");
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resolve(value);
      } else if (char === "") {
        process.stdout.write("\n"); process.exit(1);
      } else if (char === "" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function pressEnter(msg) {
  await prompt(`  ${C.gray}${msg} — press ENTER to continue${C.reset}`);
}

// ─── EC P-256 key pair (FLDP signing key) ─────────────────────────────────────

function generateECKeyPair(email) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve:           "P-256",
    publicKeyEncoding:    { type: "spki",  format: "pem" },
    privateKeyEncoding:   { type: "pkcs8", format: "pem" },
  });
  const orgSlug     = crypto.createHash("sha256").update(email).digest("hex").slice(0, 8);
  const keyId       = crypto.randomBytes(4).toString("hex");
  const keyName     = `fluid/devkeys/${orgSlug}/${keyId}`;
  const privateKeyJson = { name: keyName, publicKey, privateKey, type: "fldp_api_key", createdAt: new Date().toISOString() };
  return { keyName, publicKeyPem: publicKey, privateKeyJson };
}

// ─── BIP-39 mnemonic generation (Node built-ins only) ─────────────────────────

// Standard BIP-39 English wordlist (2048 words)
const BIP39_WORDLIST = "abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice aerobic afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena argue arm armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware away awesome awful awkward axis baby bachelor bacon badge bag balance balcony ball bamboo banana banner bar barely bargain barrel base basic basket battle beach bean beauty because become beef before begin behave behind believe below belt bench benefit best betray better between beyond bicycle bid bike bind biology bird birth bitter black blade blame blanket blast bleak bless blind blood blossom blouse blue blur blush board boat body boil bomb bone book boost border boring borrow boss bottom bounce box boy bracket brain brand brave breeze brick bridge brief bright bring brisk broccoli broken bronze broom brother brown brush bubble buddy budget buffalo build bulb bulk bullet bundle bunker burden burger burst bus business busy butter buyer buzz cabbage cabin cable cactus cage cake call calm camera camp can canal cancel candy cannon canvas canyon capable capital captain car carbon card cargo carpet carry cart case cash casino castle casual cat catalog catch category cattle cause caution cave ceiling celery cement census chair chalk champion change chaos chapter charge chase chat cheap check cheese chef cherry chest chicken chief child chimney choice choose chronic chuckle chunk circle citizen city civil claim clap clarify claw clay clean clerk clever click client cliff climb clinic clip clock clog close cloth cloud clown club clump cluster clutch coach coast coconut code coffee coil coin collect color column combine come comfort comic common company concert conduct confirm congress connect consider control convince cook cool copper copy coral core corn correct cost cotton couch country couple course cousin cover coyote crack cradle craft cram crane crash crater crawl crazy cream credit creek crew cricket crime crisp critic cross crouch crowd crucial cruel cruise crumble crunch crush cry crystal cube culture cup cupboard curious current curtain curve cushion custom cute cycle dad damage damp dance danger daring dash daughter dawn day deal debate debris decade december decide decline decorate decrease deer defense define defy degree delay deliver demand demise denial dentist deny depart depend deposit depth deputy derive describe desert design desk despair destroy detail detect develop device devote diagram dial diamond diary dice diesel diet differ digital dignity dilemma dinner dinosaur direct dirt disagree discover disease dish dismiss disorder display distance divert divide divorce dizzy doctor document dog doll dolphin domain donate donkey donor door dose double dove draft dragon drama drastic draw dream dress drift drill drink drip drive drop drum dry duck dumb dune during dust dutch duty dwarf dynamic eager eagle early earn earth easily east easy echo ecology edge edit educate effort egg eight either elbow elder electric elegant element elephant elevator elite else embark embody embrace emerge emotion employ empower empty enable enact endless endorse enemy engage engine enhance enjoy enlist enough enrich enroll ensure enter entire entry envelope episode equal equip erase erode erosion error erupt escape essay essence estate eternal ethics evidence evil evoke evolve exact example excess exchange excite exclude exercise exhaust exhibit exile exist exit exotic expand expire explain expose express extend extra eye fable face faculty fade faint faith fall false fame family famous fan fancy fantasy far fashion fat fatal father fatigue fault favorite feature february federal fee feed feel feet fellow felt fence festival fetch fever few fiber fiction field figure file film filter final find fine finger finish fire firm first fiscal fish fit fitness fix flag flame flash flat flavor flee flight flip float flock floor flower fluid flush fly foam focus fog foil follow food foot force forest forget fork fortune forum forward fossil foster found fox fragile frame frequent fresh friend fringe frog front frost frown frozen fruit fuel fun funny furnace fury future gadget gain galaxy gallery game gap garbage garden garlic garment gas gasp gate gather gauge gaze general genius genre gentle genuine gesture ghost giant gift giggle ginger giraffe girl give glad glance glare glass glide glimpse globe gloom glory glove glow glue goat goddess gold good goose gorilla gospel gossip govern gown grab grace grain grant grape grasp grass gravity great green grid grief grit grocery group grow grunt guard guide guilt guitar gun gym habit hair half hammer hamster hand happy harsh harvest hat have hawk hazard head health heart heavy hedgehog height hello helmet help hen hero hidden high hill hint hip hire history hobby hockey hold hole holiday hollow home honey hood hope horn hospital host hour hover hub huge human humble humor hundred hungry hunt hurdle hurry hurt husband hybrid ice icon ignore ill illegal image imitate immense immune impact impose improve impulse inbox income increase index indicate indoor industry infant inflict inform inhale inherit initial inject injury inmate inner innocent input inquiry insane insect inside inspire install intact interest into invest invite involve iron island isolate issue item ivory jacket jaguar jar jazz jealous jeans jelly jewel job join joke journey joy judge juice jump jungle junior junk just kangaroo keen keep ketchup key kick kid kingdom kiss kit kitchen kite kitten kiwi knee knife knock know lab ladder lamp language laptop large later laugh laundry lava lawn lawsuit layer lazy leader learn leave lecture left leg legal legend leisure lemon lend length lens leopard lesson letter level liar liberty library license life lift light like limb limit link lion liquid list little live lizard load loan lobster local lock logic lonely long loop lottery loud lounge love loyal lucky luggage lunar lunch luxury lyric machine mad magic magnet maid main major make mammal mango mansion manual maple marble march margin marine market marriage mask mass master match material math matrix matter maximum maze meadow mean medal media melody melt member memory mention mentor menu mercy merge merit merry mesh message metal method middle midnight milk million mimic mind minimum minor minute miracle miss mitten model modify mom monitor monkey monster month moon moral more morning mosquito mother motion motive mountain mouse move movie much muffin mule multiply muscle museum mushroom music must mutual myself mystery naive name napkin narrow nasty natural nature near neck need negative neglect neither nephew nerve nest network news next nice night noble noise nominee noodle normal notable note nothing notice novel now nuclear nurse nut oak obey object oblige obscure obtain ocean october odor off offer office often oil okay old olive olympic omit once onion open oppose option orange orbit orchard order ordinary organ orient original orphan ostrich other outdoor outside oval over own oyster ozone pace pack paddle page pair palace palm panda panel panic panther paper parade parent park parrot party pass patch path patrol pause pave payment peace peanut peasant pelican pen penalty pencil people pepper perfect permit person pet phone photo phrase physical piano picnic picture piece pig pigeon pill pilot pink pioneer pipe pistol pitch pizza place planet plastic plate play please pledge pluck plug plunge poem poet point polar pole police pond pony popular portion position possible post potato poverty powder power practice praise predict prefer prepare present pretty prevent price pride primary print priority prison private prize problem process produce profit program project promote proof property prosper protect proud provide public pudding pull pulp pulse pumpkin punish pupil purchase purpose push put puzzle pyramid quality quantum quarter question quick quit quiz quote rabbit raccoon race rack radar radio rage rail rain raise rally ramp ranch random range rapid rare rate rather raven reach ready real reason rebel rebuild recall receive recipe record recycle reduce reflect reform refuse region regret regular reject relax release relief rely remain remember remind remove render renew rent reopen repair repeat replace report require rescue resemble resist resource response result retire retreat return reunion reveal review reward rhythm ribbon rice rich ride rifle right rigid ring riot ripple risk ritual rival river road roast robot robust rocket romance roof rookie rotate rough round route royal rubber rude rug rule run runway rural sad saddle sadness safe sail salad salmon salon salt salute same sample sand satisfy satoshi sauce sausage save say scale scan scare scatter scene scheme school science scissors scorpion scout scrap screen script scrub sea search season seat second secret section security seek segment select sell seminar senior sense sentence series service session settle setup seven shadow shaft shallow share shed shell sheriff shield shift shine ship shiver shock shoe shoot shop short shoulder shove shrimp shrug shuffle shy sibling siege sight sign silent silk silly silver similar simple since sing siren sister situate six size sketch skill skin skirt skull slab slam sleep slender slice slide slight slim slogan slot slow slush small smart smile smoke smooth snack snake snap sniff snow soap soccer social sock solar soldier solid solution solve someone song soon sorry soul sound soup source south space spare spatial spawn speak special speed sphere spice spider spike spin spirit split spoil sponsor spoon spray spread spring spy square squeeze squirrel stable stadium staff stage stairs stamp stand start state stay steak steel stem step stereo stick still sting stock stomach stone stop store story stove strategy street strike strong struggle student stuff stumble style subject submit suburb success such sudden suffer sugar suggest suit summer sun sunny sunset super supply supreme sure surface surge surprise sustain swallow swamp swap swear sweet swift swim swing switch sword symbol symptom syrup table tackle tag tail talent tamper tank tape target task tattoo taxi teach team tell ten tenant tennis tent term test text thank that theme then theory there they thing this thought three thrive throw thumb thunder ticket tilt timber time tiny tip tired title toast tobacco today together toilet token tomato tomorrow tone tongue tonight tool tooth top topic topple torch tornado tortoise toss total tourist toward tower town toy track trade traffic tragic train transfer trap trash travel tray treat tree trend trial tribe trick trigger trim trip trophy trouble truck truly trumpet trust truth tube tuition tumble tuna tunnel turkey turn turtle twelve twenty twice twin twist two type typical ugly umbrella unable unaware uncle uncover under undo unfair unfold unhappy uniform unique universe unknown unlock until unusual unwrap update upgrade uphold upon upper upset urban usage use used useful useless usual utility vacant vacuum vague valid valley valve van vanish vapor various vast vault vehicle velvet vendor venture verb verify version very veteran viable vibrant vicious victory video view village vintage violin virtual virus visa visit visual vital vivid vocal voice void volcano volume vote voyage wage wagon wait walk wall walnut want warfare warm warrior wash wasp waste water wave way wealth weapon wear weasel web wedding weekend weird welcome well west wet whale wheat wheel when where whip whisper wide width wife wild will win window wine wing wink winner winter wire wisdom wise wish witness wolf woman wonder wood wool word world worry worth wrap wreck wrestle wrist write wrong yard year yellow you young youth zebra zero zone zoo".split(" ");

function generateMnemonic() {
  // 128 bits entropy → 12 words (BIP-39)
  const entropy     = crypto.randomBytes(16);
  const hash        = crypto.createHash("sha256").update(entropy).digest();
  const entropyBits = Array.from(entropy).map(b => b.toString(2).padStart(8, "0")).join("");
  const checksum    = hash[0].toString(2).padStart(8, "0").slice(0, 4);
  const bits        = entropyBits + checksum;
  const words       = [];
  for (let i = 0; i < 12; i++) {
    words.push(BIP39_WORDLIST[parseInt(bits.slice(i * 11, (i + 1) * 11), 2)]);
  }
  return words.join(" ");
}

// ─── BIP-32/44 private key derivation (Node built-ins only) ──────────────────

const _N  = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const _P  = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F");
const _Gx = BigInt("0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798");
const _Gy = BigInt("0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8");

function _modp(a)   { return ((a % _P) + _P) % _P; }
function _modn(a)   { return ((a % _N) + _N) % _N; }
function _inv(a, m) {
  let [r, nr, s, ns] = [m, ((a % m) + m) % m, 0n, 1n];
  while (ns !== 0n) { const q = r / ns; [r, nr, s, ns] = [ns, r - q * ns, ns, s - q * ns]; }
  return ((s % m) + m) % m;
}
function _ptAdd(x1, y1, x2, y2) {
  if (x1 === null) return [x2, y2];
  if (x2 === null) return [x1, y1];
  if (x1 === x2 && y1 === y2) {
    const lam = _modp(3n * x1 * x1 * _inv(2n * y1, _P));
    const x3  = _modp(lam * lam - 2n * x1);
    return [x3, _modp(lam * (x1 - x3) - y1)];
  }
  const lam = _modp((y2 - y1) * _inv(x2 - x1, _P));
  const x3  = _modp(lam * lam - x1 - x2);
  return [x3, _modp(lam * (x1 - x3) - y1)];
}
function _ptMul(k, x, y) {
  let [rx, ry, cx, cy] = [null, null, x, y];
  while (k > 0n) { if (k & 1n) [rx, ry] = _ptAdd(rx, ry, cx, cy); [cx, cy] = _ptAdd(cx, cy, cx, cy); k >>= 1n; }
  return [rx, ry];
}
function _compPub(privBuf) {
  const [x, y] = _ptMul(BigInt("0x" + privBuf.toString("hex")), _Gx, _Gy);
  return Buffer.concat([Buffer.from([(y & 1n) === 0n ? 0x02 : 0x03]),
    Buffer.from(x.toString(16).padStart(64, "0"), "hex")]);
}
function _addPriv(a, b) {
  return Buffer.from(_modn(BigInt("0x" + a.toString("hex")) + BigInt("0x" + b.toString("hex"))).toString(16).padStart(64, "0"), "hex");
}
function _bip32Master(seed) {
  const I = crypto.createHmac("sha512", Buffer.from("Bitcoin seed")).update(seed).digest();
  return { key: I.slice(0, 32), chain: I.slice(32) };
}
function _bip32Hard({ key, chain }, idx) {
  const ib = Buffer.allocUnsafe(4); ib.writeUInt32BE(0x80000000 + idx);
  const I  = crypto.createHmac("sha512", chain).update(Buffer.concat([Buffer.alloc(1), key, ib])).digest();
  return { key: _addPriv(I.slice(0, 32), key), chain: I.slice(32) };
}
function _bip32Soft({ key, chain }, idx) {
  const ib = Buffer.allocUnsafe(4); ib.writeUInt32BE(idx);
  const I  = crypto.createHmac("sha512", chain).update(Buffer.concat([_compPub(key), ib])).digest();
  return { key: _addPriv(I.slice(0, 32), key), chain: I.slice(32) };
}
function derivePrivateKey(mnemonic) {
  const seed = crypto.pbkdf2Sync(mnemonic.normalize("NFKD"), Buffer.from("mnemonic"), 2048, 64, "sha512");
  let n = _bip32Master(seed);
  n = _bip32Hard(n, 44); n = _bip32Hard(n, 60); n = _bip32Hard(n, 0);
  n = _bip32Soft(n, 0);  n = _bip32Soft(n, 0);
  return "0x" + n.key.toString("hex");
}

// ─── Step 1: Developer account (email + password) ────────────────────────────

async function stepAccount() {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let email = "";
  while (true) {
    email = (await prompt(`  ${C.cyan}?${C.reset} Email address: `)).trim();
    if (emailRe.test(email)) break;
    warn("Enter a valid email address");
  }
  let password = "";
  while (true) {
    password = await promptPassword(`  ${C.cyan}?${C.reset} Password (min 6 chars): `);
    if (password.length >= 6) break;
    warn("Password must be at least 6 characters");
  }
  log("");

  log(`  ${C.dim}Signing in to Fluid…${C.reset}`);
  let isNew = false;
  try {
    const res = await apiPost("https://fluidnative.com/api/auth/register-developer", { email, password });
    if (res.success || res.uid) { ok("Developer account created"); isNew = true; }
    else if (res.error && /exist|duplicate/i.test(res.error)) {
      const login = await apiPost("https://fluidnative.com/api/auth/login-developer", { email, password });
      if (login.success || login.uid) ok("Signed in to existing account");
      else { warn("Could not verify password — continuing offline"); }
    } else { ok(`Account ready  ${C.dim}(${email})${C.reset}`); isNew = true; }
  } catch { ok(`Account ready  ${C.dim}(offline mode)${C.reset}`); isNew = true; }

  return { email, isNew };
}

// ─── Step 2: Auto-generate fw_sor_ API key ────────────────────────────────────

async function stepApiKey(email) {
  const raw     = crypto.randomBytes(24).toString("hex");
  const apiKey  = `fw_sor_${raw}`;
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const keyHint = apiKey.slice(0, 12);

  try {
    await apiPost("https://fluidnative.com/api/developer/register-key", { email, keyHash, keyHint });
    ok("API key registered with Fluid");
  } catch { warn("Could not reach Fluid — key saved locally, activates on first use"); }

  log("");
  log(hr());
  log("");
  warn(`${C.bold}${C.yellow}SHOWN ONCE — save your API key NOW. It will not be shown again.${C.reset}`);
  log("");
  label("FLUID_API_KEY", `${C.cyan}${apiKey}${C.reset}`);
  log("");
  log(hr());
  log("");
  await pressEnter("I have saved my API key");

  return apiKey;
}

// ─── Step 3: Auto-generate EC P-256 key pair (FLDP) ──────────────────────────

async function stepECKeyPair(email) {
  const { keyName, publicKeyPem, privateKeyJson } = generateECKeyPair(email);

  try {
    await apiPost("https://fluidnative.com/api/developer/fldp-keys/register", {
      email, keyName, publicKeyPem, label: "CLI Generated",
    });
    ok("FLDP EC key pair registered");
  } catch { warn("Could not register EC key online — saved locally"); }

  log("");
  log(hr());
  log("");
  warn(`${C.bold}${C.yellow}SHOWN ONCE — save your FLDP key NOW. It will not be shown again.${C.reset}`);
  log("");
  label("FLDP_KEY_NAME",    `${C.cyan}${keyName}${C.reset}`);
  label("FLDP_PRIVATE_KEY", `${C.yellow}(shown below)${C.reset}`);
  log("");
  for (const line of JSON.stringify(privateKeyJson, null, 2).split("\n"))
    log(`  ${C.gray}${line}${C.reset}`);
  log("");
  log(hr());
  log("");
  await pressEnter("I have saved my FLDP key");

  return { keyName, privateKeyJson };
}

// ─── Step 4: Auto-generate BIP-39 seed phrase ────────────────────────────────

async function stepSeedPhrase() {
  const mnemonic = generateMnemonic();

  log("");
  log(hr());
  log("");
  warn(`${C.bold}${C.yellow}SHOWN ONCE — write down your seed phrase NOW. Never share it.${C.reset}`);
  log("");
  log(`  ${C.bold}${C.white}${mnemonic}${C.reset}`);
  log("");
  log(`  ${C.dim}12 words · BIP-39 · derives your wallet signing key (m/44'/60'/0'/0/0)${C.reset}`);
  log(`  ${C.dim}Only the private key is saved to .env.local — seed phrase is discarded.${C.reset}`);
  log("");
  log(hr());
  log("");
  await pressEnter("I have written down my seed phrase");

  return mnemonic;
}

// ─── Mode a: Scaffold project for developers ──────────────────────────────────

async function runModeScaffoldDev() {
  const projectName = await askProjectName();
  const projectPath = path.resolve(process.cwd(), projectName);
  const templateDir = path.resolve(__dirname, "../templates/react-swap");
  const TOTAL_STEPS = 7;

  if (fs.existsSync(projectPath)) {
    fail(`Directory ${C.cyan}${projectName}${C.reset} already exists.`);
    process.exit(1);
  }
  if (!fs.existsSync(templateDir)) {
    fail("Template files missing. Please reinstall fluid-sor.");
    process.exit(1);
  }

  step(1, TOTAL_STEPS, "Developer account");
  const { email } = await stepAccount();

  step(2, TOTAL_STEPS, "Fluid API key  (fw_sor_...)  · auto-generated");
  const apiKey = await stepApiKey(email);

  step(3, TOTAL_STEPS, "FLDP EC key pair  (P-256)  · auto-generated");
  const { keyName, privateKeyJson } = await stepECKeyPair(email);

  step(4, TOTAL_STEPS, "Wallet seed phrase  (BIP-39, 12 words)  · auto-generated");
  const mnemonic = await stepSeedPhrase();

  step(5, TOTAL_STEPS, `Scaffolding ${C.cyan}${projectName}${C.reset}…`);
  copyDir(templateDir, projectPath);
  patchPackageJson(projectPath, projectName);
  ok(`Template copied → ${C.gray}./${projectName}${C.reset}`);

  step(6, TOTAL_STEPS, "Installing dependencies…");
  const pm = detectPm();
  try {
    execSync(`${pm} install`, { cwd: projectPath, stdio: "pipe" });
    ok(`Dependencies installed  ${C.dim}(${pm})${C.reset}`);
  } catch { warn(`Auto-install failed — run:  cd ${projectName} && npm install`); }

  step(7, TOTAL_STEPS, "Deriving signing key and writing .env.local…");
  const privateKey = derivePrivateKey(mnemonic);

  fs.writeFileSync(path.join(projectPath, ".env.local"), [
    "# ─── Fluid SOR — generated by fluid-sor CLI ─────────────────────────────────",
    "# ⚠  Never commit this file — it is git-ignored",
    "",
    `VITE_FLUID_API_KEY=${apiKey}`,
    `VITE_FLUID_PRIVATE_KEY=${privateKey}`,
    "VITE_FLUID_SOR_ADDRESS=0xF24daF8Fe15383fb438d48811E8c4b43749DafAE",
    `VITE_FLDP_KEY_NAME=${keyName}`,
  ].join("\n"));
  fs.writeFileSync(path.join(projectPath, ".gitignore"),
    ["node_modules", ".env.local", "dist", ".DS_Store"].join("\n") + "\n");

  ok(`API key written         ${C.dim}${apiKey.slice(0, 13)}***${C.reset}`);
  ok(`Signing key derived     ${C.dim}${privateKey.slice(0, 10)}…  (seed phrase discarded)${C.reset}`);
  ok(`.env.local written      ${C.dim}(git-ignored)${C.reset}`);

  log("");
  log(hr("═"));
  log(`${C.bold}${C.green}  ✓  ${projectName} is ready!${C.reset}`);
  log(hr("═"));
  log("");
  log(`  ${C.cyan}${C.bold}${projectName}${C.reset}`);
  log(`    ${C.cyan}npm run dev${C.reset}`);
  log(`    ${C.dim}# → http://localhost:5173${C.reset}`);
  log("");

  // ── Auto-open browser after short delay, then start dev server ───────────
  const { spawn } = require("child_process");
  const openCmd   = process.platform === "darwin" ? "open"
                  : process.platform === "win32"  ? "start"
                  : "xdg-open";

  setTimeout(() => {
    spawn(openCmd, ["http://localhost:5173"], { detached: true, stdio: "ignore" }).unref();
  }, 2000);

  log(`  ${C.dim}Starting dev server and opening browser…${C.reset}\n`);

  // cd into project and run dev server (takes over the terminal)
  const dev = spawn(detectPm() === "npm" ? "npm" : detectPm(), ["run", "dev"], {
    cwd:   projectPath,
    stdio: "inherit",
    shell: true,
  });

  dev.on("error", () => {
    warn(`Could not start dev server automatically.`);
    log(`  Run manually:  ${C.cyan}cd ${projectName} && npm run dev${C.reset}\n`);
  });
}

// ─── Mode b: Install SOR in existing project for developers ───────────────────

async function runModeInstallDev() {
  log(`\n  ${C.dim}Adds SOR routing and price feeds to your current project.${C.reset}\n`);
  const TOTAL_STEPS = 4;
  const installed   = [];

  step(1, TOTAL_STEPS, "Install fluid-fadp  (SOR routing middleware)");
  log(`  ${C.dim}Smart order routing across DEX venues + price feeds.${C.reset}\n`);
  const pm = detectPm();
  try {
    execSync("npm install fluid-fadp", { stdio: "pipe", cwd: process.cwd() });
    ok(`${C.cyan}fluid-fadp${C.reset} installed`);
    installed.push("fluid-fadp");
  } catch { warn("npm install failed — run: npm install fluid-fadp"); }
  log("");

  step(2, TOTAL_STEPS, "Install fluid-ticker  (live crypto price feeds)");
  log(`  ${C.dim}11-source price oracle — ETH, BTC, SOL and 1000+ tokens.${C.reset}\n`);
  try {
    execSync("npm install fluid-ticker", { stdio: "pipe", cwd: process.cwd() });
    ok(`${C.cyan}fluid-ticker${C.reset} installed`);
    installed.push("fluid-ticker");
  } catch { warn("npm install failed — run: npm install fluid-ticker"); }
  log("");

  step(3, TOTAL_STEPS, "Developer account + API key  (required for execute swap)");
  log(`  ${C.dim}SOR routing works without a wallet. Account needed to execute swaps on-chain.${C.reset}\n`);

  let apiKey = null; let keyName = null; let mnemonic = null;
  const doWallet = await (async () => {
    const ans = (await prompt(`  ${C.cyan}?${C.reset} Set up account + wallet for execute swap? ${C.gray}[Y/n]${C.reset} `)).trim().toLowerCase();
    return ans === "" || ans === "y" || ans === "yes";
  })();

  if (doWallet) {
    const { email } = await stepAccount();
    apiKey          = await stepApiKey(email);
    ({ keyName }    = await stepECKeyPair(email));
    mnemonic        = await stepSeedPhrase();
    installed.push("wallet");
  } else {
    log(`  ${C.gray}Skipped — run \`npx fluid-sor\` again any time to add wallet.${C.reset}\n`);
  }

  step(4, TOTAL_STEPS, "Writing .env.local…");
  if (doWallet && mnemonic) {
    const privateKey = derivePrivateKey(mnemonic);
    const envPath    = path.join(process.cwd(), ".env.local");
    const existing   = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const marker     = "# Fluid SOR — generated by fluid-sor CLI";
    if (!existing.includes(marker)) {
      fs.appendFileSync(envPath, [
        "", marker,
        `FLUID_API_KEY=${apiKey}`,
        `FLUID_PRIVATE_KEY=${privateKey}`,
        "FLUID_SOR_ADDRESS=0xF24daF8Fe15383fb438d48811E8c4b43749DafAE",
        `FLDP_KEY_NAME=${keyName}`, "",
      ].join("\n"));
    }
    const gi = path.join(process.cwd(), ".gitignore");
    const gt = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
    if (!gt.includes(".env.local")) fs.appendFileSync(gi, "\n.env.local\n");
    ok(`Keys written to ${C.cyan}.env.local${C.reset}  ${C.dim}(git-ignored)${C.reset}`);
  } else {
    ok("Packages ready — no keys written");
  }

  log("");
  log(hr("═"));
  log(`${C.bold}${C.green}  ✓  SOR installed in your project!${C.reset}`);
  log(hr("═"));
  log("");
  log(`  ${C.green}✓${C.reset}  SOR routing       ${C.dim}import { SOR } from 'fluid-fadp'${C.reset}`);
  log(`  ${C.green}✓${C.reset}  Price feeds        ${C.dim}import { ticker } from 'fluid-ticker'${C.reset}`);
  log(`  ${doWallet ? `${C.green}✓` : `${C.gray}○`}${C.reset}  Execute swap       ${doWallet ? C.dim + "keys in .env.local" + C.reset : C.gray + "(not set up)" + C.reset}`);
  log("");
  log(`  ${C.dim}Installed: ${installed.join(", ")}${C.reset}`);
  log(`  ${C.dim}Docs: fluidnative.com/fadp${C.reset}`);
  log("");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner();
  const mode = await selectMode();
  if (mode === "a") await runModeScaffoldDev();
  else              await runModeInstallDev();
}

main().catch(e => {
  fail("Unexpected error: " + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
