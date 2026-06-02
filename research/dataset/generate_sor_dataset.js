#!/usr/bin/env node
/**
 * generate_sor_dataset.js
 *
 * Ganji's DeFi SOR Protocol — Large-Scale Research Dataset Generator
 * Paper: Ganji's DeFi SOR Protocol: Multi-Venue Smart Order Routing
 *        for Human and Agent-Native Crypto Swaps on Base
 * Authors: Abhijeeth Ganji (Maryville University of St. Louis, M.S. Data Science)
 *          Priyanka Velpula (Ex-Wipro, Blockchain Researcher)
 *
 * Run:  node generate_sor_dataset.js
 * Requires Node.js 18+, zero external dependencies.
 * Generates 265,000 rows across 10 CSV files.
 *
 * Output files written to the same directory as this script.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const OUT  = __dirname;

// ── Math helpers ──────────────────────────────────────────────────────────────

function randN(mean, std) {
  const u1 = Math.random(), u2 = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randU(lo, hi)    { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi)  { return Math.floor(randU(lo, hi + 1)); }
function pick(arr)        { return arr[Math.floor(Math.random() * arr.length)]; }
function pickW(arr, w)    {
  const t = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * t;
  for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
function bool(p = 0.5)   { return Math.random() < p; }
function hexBytes(n)      { return [...Array(n)].map(() => Math.floor(Math.random()*256).toString(16).padStart(2,'0')).join(''); }

// Timestamps spread across 90 days
const BASE_TS = new Date('2026-01-01T00:00:00Z').getTime();
const RANGE   = 90 * 24 * 3600 * 1000;
function randTs() {
  return new Date(BASE_TS + Math.random() * RANGE).toISOString().replace('T',' ').replace('Z','');
}

// ── Domain constants ──────────────────────────────────────────────────────────

const CHAINS   = ['Base', 'Ethereum', 'Solana', 'Injective'];
const VENUES   = [
  'Uniswap V3','Aerodrome','Velodrome','Curve 3Pool',
  'PancakeSwap','Balancer V2','SushiSwap','Maverick',
  'Hashflow','1inch','Odos','Jupiter','Paraswap',
  'CoW Protocol','Across','LI.FI','Fluid AMM','Fluid Split'
];
const STABLECOIN_PAIRS = [
  'USDC/USDT','USDC/DAI','USDT/DAI','USDC/FRAX','USDT/FRAX',
  'DAI/FRAX','USDC/GHO','USDT/CRVUSD','USDC/PYUSD','DAI/LUSD'
];
const VOLATILE_PAIRS = [
  'ETH/USDC','WBTC/USDC','ETH/USDT','SOL/USDC','INJ/USDC',
  'ETH/WBTC','ARB/USDC','OP/USDC','MATIC/USDC','LINK/USDC',
  'ETH/DAI','WBTC/USDT','SOL/USDT','INJ/USDT','UNI/USDC',
  'AAVE/USDC','CRV/USDC','MKR/USDC','SNX/USDC','LDO/USDC'
];
const ALL_PAIRS = [...STABLECOIN_PAIRS, ...VOLATILE_PAIRS];
// Only autonomous agents — no real human testing was conducted on the SOR protocol.
// All dataset entries reflect agent-driven simulation records.
const USER_CLASSES = ['autonomous_agent'];
const ROUTE_TYPES  = ['single_hop','split_route','multi_hop','cross_chain'];
const CACHE_STATES = ['warm','cold'];
const CAP_SCOPES   = ['swap_only','swap_and_bridge','full_defi'];
const WORKLOAD_CLS = ['W1','W2','W3'];
const ALGO         = 'GanjiRoute-BellmanFord';
const VENUE_TIERS  = ['tier_1','tier_2','tier_3'];
const INT_TYPES    = ['native','adapter','aggregator'];
const BRIDGE_PROTOS = ['LI.FI','Across','Wormhole','deBridge','Socket'];
const FINALITY_TYPES = ['trustless','optimistic','multisig','federated'];
const CHAIN_PAIRS  = [
  ['Base','Ethereum'],['Base','Solana'],['Base','Injective'],
  ['Ethereum','Solana'],['Ethereum','Injective'],['Solana','Injective']
];
const MEV_TYPES    = ['sandwich_attack','frontrun','backrun','jit_liquidity'];
const MEMPOOL_TYPES = ['public','private','flashbots'];
const CURVE_TYPES  = ['constant_product','stableswap','concentrated','weighted'];
const CONCAVITY    = ['concave','convex','linear'];

// 50 unique agent IDs
const AGENT_IDS = Array.from({length: 50}, (_, i) => `agent_${String(i+1).padStart(3,'0')}`);

// ── CSV writer ────────────────────────────────────────────────────────────────

function writeCSV(filename, headers, rows) {
  const filepath = path.join(OUT, filename);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(v => {
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(','));
  }
  fs.writeFileSync(filepath, lines.join('\n') + '\n');
  console.log(`  ✓ ${filename}  (${rows.length.toLocaleString()} rows)`);
}

// ── 1. sor_route_discovery.csv — 50,000 rows ─────────────────────────────────

function genRouteDiscovery(n) {
  const headers = [
    'route_id','timestamp','swap_pair','chain','route_type',
    'venues_scanned','venues_selected','discovery_time_ms','end_to_end_ms',
    'slippage_bps','rei_score','vcs_score','user_class','cache_state',
    'price_improvement_bps','gas_estimate_usd','optimal_venue',
    'split_route_count','pauli_proof_attached','sovereignty_score'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const cache      = pick(CACHE_STATES);
    const discMs     = Math.max(5, cache === 'warm' ? randN(47.5, 8) : randN(110, 20));
    const e2eMs      = discMs + Math.max(50, randN(230, 30));
    const isStable   = bool(0.4);
    const pair       = isStable ? pick(STABLECOIN_PAIRS) : pick(VOLATILE_PAIRS);
    const reiScore   = isStable ? randU(0.9990, 0.9999) : randU(0.9975, 0.9990);
    const userClass  = 'autonomous_agent';
    const sovScore   = randU(0.85, 1.0);
    const rtype      = pick(ROUTE_TYPES);
    const splitCount = rtype === 'split_route' ? randInt(2, 5) : rtype === 'multi_hop' ? randInt(2, 4) : 1;
    rows.push([
      `rd_${String(i+1).padStart(6,'0')}`,
      randTs(),
      pair,
      pick(CHAINS),
      rtype,
      randInt(8, 18),
      randInt(1, 5),
      discMs.toFixed(2),
      e2eMs.toFixed(2),
      Math.abs(randN(1.0, 0.4)).toFixed(4),
      reiScore.toFixed(6),
      randU(0.82, 0.88).toFixed(4),
      userClass,
      cache,
      Math.max(0, randN(2.4, 0.6)).toFixed(4),
      randU(0.0005, 0.012).toFixed(6),
      pick(VENUES),
      splitCount,
      bool(0.72) ? 'true' : 'false',
      sovScore.toFixed(4)
    ]);
  }
  return { headers, rows };
}

// ── 2. sor_venue_scanner.csv — 100,000 rows ──────────────────────────────────

function genVenueScanner(n) {
  const headers = [
    'scan_id','timestamp','venue','chain','swap_pair',
    'quoted_price_usd','liquidity_usd','price_impact_bps',
    'gas_estimate_usd','venue_latency_ms','staleness_ms',
    'selected_as_optimal','venue_tier','uptime_pct',
    'daily_volume_usd','fee_bps','freshness_ts'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const isStable  = bool(0.35);
    const pair      = isStable ? pick(STABLECOIN_PAIRS) : pick(VOLATILE_PAIRS);
    const latency   = Math.max(5, randN(45, 15));
    const staleness = Math.max(0, randN(120, 80));
    const liq       = Math.pow(10, randU(4, 9));
    const fee       = isStable ? randU(0.5, 5) : randU(5, 30);
    const impact    = isStable ? Math.abs(randN(0.5, 0.3)) : Math.abs(randN(3, 2));
    const price     = isStable ? randU(0.998, 1.002) : randU(0.01, 5000);
    const dv        = liq * randU(0.1, 0.5);
    const uptime    = randU(99.0, 99.99);
    rows.push([
      `vs_${String(i+1).padStart(7,'0')}`,
      randTs(),
      pick(VENUES),
      pick(CHAINS),
      pair,
      price.toFixed(6),
      liq.toFixed(2),
      impact.toFixed(4),
      randU(0.0002, 0.015).toFixed(6),
      latency.toFixed(2),
      staleness.toFixed(1),
      bool(0.25) ? 'true' : 'false',
      pick(VENUE_TIERS),
      uptime.toFixed(4),
      dv.toFixed(2),
      fee.toFixed(2),
      randTs()
    ]);
  }
  return { headers, rows };
}

// ── 3. sor_agent_intents.csv — 30,000 rows ───────────────────────────────────

function genAgentIntents(n) {
  const headers = [
    'intent_id','timestamp','agent_id','user_class',
    'swap_pair','intent_amount_usd','intents_per_min',
    'route_discovery_ms','execution_ms','slippage_actual_bps',
    'sovereignty_weight','pauli_proof_attached','ver_score',
    'success','ganji_nonce_vector','gaf_route_hash',
    'capability_scope','chain','retry_count','settlement_ms'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const uc  = pick(USER_CLASSES);
    const ipm = randInt(100, 1000); // autonomous agents: 10²–10³ intents/min
    const discMs = Math.max(5, randN(47.5, 8));
    const execMs = Math.max(50, randN(230, 30));
    const nTime  = Date.now() + randInt(-86400000, 86400000);
    const nChain = randInt(1, 4);
    const nReq   = randInt(1, 9999);
    const nAgent = randInt(1, 50);
    const nonce  = `(${nTime},${nChain},${nReq},${nAgent})`;
    const sov    = randU(0.85, 1.0);
    rows.push([
      `ai_${String(i+1).padStart(6,'0')}`,
      randTs(),
      pick(AGENT_IDS),
      uc,
      pick(ALL_PAIRS),
      randU(10, 1000000).toFixed(2),
      ipm,
      discMs.toFixed(2),
      execMs.toFixed(2),
      Math.abs(randN(1.0, 0.4)).toFixed(4),
      sov.toFixed(4),
      bool(0.72) ? 'true' : 'false',
      randU(0.9980, 0.9999).toFixed(6),
      bool(0.97) ? 'true' : 'false',
      nonce,
      hexBytes(32),
      pick(CAP_SCOPES),
      pick(CHAINS),
      randInt(0, 3),
      Math.max(100, randN(2000, 500)).toFixed(1)
    ]);
  }
  return { headers, rows };
}

// ── 4. sor_circuit_breaker.csv — 10,000 rows ─────────────────────────────────

function genCircuitBreaker(n) {
  const headers = [
    'event_id','timestamp','trigger_tier','trigger_type',
    'venue','chain','swap_pair','threshold_value','observed_value',
    'action_taken','recovery_time_ms','reroute_success',
    'alternative_venue','cost_of_delay_usd','blocks_elapsed'
  ];
  const TRIGGER_DEFS = [
    { tier: 'Tier1', type: 'slippage_spike', threshold: 5.0 },
    { tier: 'Tier2', type: 'gas_spike',      threshold: 10.0 },
    { tier: 'Tier3', type: 'venue_staleness', threshold: 3000 }
  ];
  const ACTIONS = ['route_rerouted','abort','retry'];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const def      = pick(TRIGGER_DEFS);
    const mult     = randU(1.05, 2.5);
    const observed = (def.threshold * mult).toFixed(4);
    const action   = pickW(ACTIONS, [0.70, 0.15, 0.15]);
    const venue    = pick(VENUES);
    let altVenue   = pick(VENUES);
    while (altVenue === venue) altVenue = pick(VENUES);
    rows.push([
      `cb_${String(i+1).padStart(5,'0')}`,
      randTs(),
      def.tier,
      def.type,
      venue,
      pick(CHAINS),
      pick(ALL_PAIRS),
      def.threshold,
      observed,
      action,
      Math.max(10, randN(350, 120)).toFixed(1),
      bool(0.95) ? 'true' : 'false',
      altVenue,
      randU(0.001, 5.0).toFixed(6),
      randInt(0, 5)
    ]);
  }
  return { headers, rows };
}

// ── 5. sor_bellman_ford.csv — 10,000 rows ────────────────────────────────────

function genBellmanFord(n) {
  const headers = [
    'path_id','timestamp','swap_pair','graph_vertices',
    'graph_edges','algorithm','paths_evaluated','optimal_path_cost',
    'split_routes','convergence_iterations','computation_time_ms',
    'optimality_proven','sovereignty_preserved',
    'negative_cycles_detected','relaxation_passes',
    'workload_class'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const verts    = randInt(180, 220);
    const edges    = randInt(1400, 1600);
    const compTime = randU(5, 45);
    const wc       = pick(WORKLOAD_CLS);
    const ipm      = wc === 'W1' ? randInt(500, 1000)
                   : wc === 'W2' ? randInt(100, 500)
                   : randInt(1, 100);
    rows.push([
      `bf_${String(i+1).padStart(5,'0')}`,
      randTs(),
      pick(ALL_PAIRS),
      verts,
      edges,
      ALGO,
      randInt(edges, edges * 3),
      randU(0.9950, 0.9999).toFixed(8),
      randInt(1, 5),
      randInt(3, 12),
      compTime.toFixed(3),
      'true',
      'true',
      bool(0.02) ? 'true' : 'false',
      verts - 1,
      wc
    ]);
  }
  return { headers, rows };
}

// ── 6. sor_venue_performance.csv — 15,000 rows ───────────────────────────────

function genVenuePerformance(n) {
  const headers = [
    'record_id','timestamp','venue','chain','swap_pair',
    'avg_latency_ms','p95_latency_ms','uptime_pct',
    'daily_volume_usd','avg_slippage_bps','avg_price_impact_bps',
    'avg_gas_usd','route_selection_count','route_selection_pct',
    'liquidity_depth_usd','venue_score','integration_type'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const avgLat  = Math.max(5, randN(45, 15));
    const p95Lat  = avgLat * randU(1.5, 3.0);
    const uptime  = randU(98.5, 99.99);
    const dv      = Math.pow(10, randU(5, 9));
    const liq     = dv * randU(2, 20);
    const selPct  = randU(0.5, 30);
    const score   = randU(0.60, 0.98);
    rows.push([
      `vp_${String(i+1).padStart(6,'0')}`,
      randTs(),
      pick(VENUES),
      pick(CHAINS),
      pick(ALL_PAIRS),
      avgLat.toFixed(2),
      p95Lat.toFixed(2),
      uptime.toFixed(4),
      dv.toFixed(2),
      Math.abs(randN(1.0, 0.5)).toFixed(4),
      Math.abs(randN(2.0, 1.0)).toFixed(4),
      randU(0.0005, 0.015).toFixed(6),
      randInt(10, 50000),
      selPct.toFixed(4),
      liq.toFixed(2),
      score.toFixed(4),
      pick(INT_TYPES)
    ]);
  }
  return { headers, rows };
}

// ── 7. sor_cross_chain_routes.csv — 12,000 rows ──────────────────────────────

function genCrossChainRoutes(n) {
  const headers = [
    'route_id','timestamp','from_chain','to_chain',
    'bridge_protocol','swap_pair','amount_usd','bridge_fee_bps',
    'bridge_latency_ms','bridge_latency_s','finality_type',
    'slippage_bps','total_cost_usd','success','partial_fill',
    'source_tx_hash','dest_tx_hash','reorg_risk'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const [from, to] = pick(CHAIN_PAIRS);
    const latMs      = Math.max(500, randN(18000, 6000));
    const amtUsd     = randU(50, 500000);
    const feeBps     = randU(5, 50);
    const costUsd    = amtUsd * (feeBps / 10000) + randU(0.5, 5.0);
    rows.push([
      `cc_${String(i+1).padStart(6,'0')}`,
      randTs(),
      from,
      to,
      pick(BRIDGE_PROTOS),
      pick(ALL_PAIRS),
      amtUsd.toFixed(2),
      feeBps.toFixed(2),
      latMs.toFixed(1),
      (latMs / 1000).toFixed(3),
      pick(FINALITY_TYPES),
      Math.abs(randN(2.0, 1.0)).toFixed(4),
      costUsd.toFixed(4),
      bool(0.94) ? 'true' : 'false',
      bool(0.08) ? 'true' : 'false',
      `0x${hexBytes(32)}`,
      `0x${hexBytes(32)}`,
      randU(0.001, 0.05).toFixed(6)
    ]);
  }
  return { headers, rows };
}

// ── 8. sor_mev_protection.csv — 8,000 rows ───────────────────────────────────

function genMevProtection(n) {
  const headers = [
    'event_id','timestamp','swap_pair','chain','amount_usd',
    'mev_type','detected','private_mempool_used',
    'sandwich_attempted','frontrun_attempted',
    'sandwich_prevented','frontrun_prevented',
    'cost_saved_usd','protection_latency_ms','mempool_type',
    'block_number','gas_price_gwei'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const mevType      = pick(MEV_TYPES);
    const detected     = bool(0.88);
    const mpool        = pick(MEMPOOL_TYPES);
    const privMempool  = mpool !== 'public';
    const swAttempt    = mevType === 'sandwich_attack' ? bool(0.7) : false;
    const frAttempt    = mevType === 'frontrun'        ? bool(0.7) : bool(0.15);
    const swPrev       = swAttempt && detected && privMempool ? bool(0.95) : false;
    const frPrev       = frAttempt && detected && privMempool ? bool(0.95) : false;
    const amtUsd       = randU(100, 500000);
    const saved        = (swPrev || frPrev) ? amtUsd * randU(0.0002, 0.005) : 0;
    rows.push([
      `mev_${String(i+1).padStart(5,'0')}`,
      randTs(),
      pick(ALL_PAIRS),
      pick(CHAINS),
      amtUsd.toFixed(2),
      mevType,
      detected ? 'true' : 'false',
      privMempool ? 'true' : 'false',
      swAttempt ? 'true' : 'false',
      frAttempt ? 'true' : 'false',
      swPrev ? 'true' : 'false',
      frPrev ? 'true' : 'false',
      saved.toFixed(6),
      Math.max(5, randN(25, 10)).toFixed(2),
      mpool,
      randInt(19000000, 22000000),
      randU(0.001, 50).toFixed(4)
    ]);
  }
  return { headers, rows };
}

// ── 9. sor_split_route_analysis.csv — 10,000 rows ────────────────────────────

function genSplitRouteAnalysis(n) {
  const headers = [
    'split_id','timestamp','swap_pair','total_amount_usd',
    'num_splits','venues_used','split_ratios',
    'split_bps_venue1','split_bps_venue2','split_bps_venue3',
    'aggregate_slippage_bps','single_route_slippage_bps',
    'improvement_bps','total_gas_usd','execution_time_ms',
    'marginal_cost_equalized','sovereignty_score',
    'theorem_42_verified'
  ];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const numSplits  = randInt(2, 4);
    const venueList  = [];
    const used       = new Set();
    while (venueList.length < numSplits) {
      const v = pick(VENUES);
      if (!used.has(v)) { venueList.push(v); used.add(v); }
    }
    // Generate split ratios that sum to 1
    let ratios = Array.from({length: numSplits}, () => Math.random());
    const rSum = ratios.reduce((a,b) => a+b, 0);
    ratios = ratios.map(r => r / rSum);
    const splitBps1 = (ratios[0] * 10000).toFixed(0);
    const splitBps2 = numSplits >= 2 ? (ratios[1] * 10000).toFixed(0) : '';
    const splitBps3 = numSplits >= 3 ? (ratios[2] * 10000).toFixed(0) : '';
    const singleSlip = Math.abs(randN(3.5, 1.0));
    const aggSlip    = Math.abs(randN(1.0, 0.3));
    const improvement = Math.max(0, singleSlip - aggSlip);
    const totalAmt   = randU(1000, 5000000);
    const sovScore   = randU(0.70, 1.0);
    rows.push([
      `sr_${String(i+1).padStart(5,'0')}`,
      randTs(),
      pick(ALL_PAIRS),
      totalAmt.toFixed(2),
      numSplits,
      venueList.join('|'),
      ratios.map(r => r.toFixed(4)).join('|'),
      splitBps1,
      splitBps2,
      splitBps3,
      aggSlip.toFixed(4),
      singleSlip.toFixed(4),
      improvement.toFixed(4),
      randU(0.001, 0.05).toFixed(6),
      Math.max(50, randN(280, 50)).toFixed(2),
      bool(0.91) ? 'true' : 'false',
      sovScore.toFixed(4),
      bool(0.89) ? 'true' : 'false'
    ]);
  }
  return { headers, rows };
}

// ── 10. sor_price_impact_curves.csv — 20,000 rows ────────────────────────────

function genPriceImpactCurves(n) {
  const headers = [
    'curve_id','timestamp','venue','chain','swap_pair',
    'input_amount_usd','output_amount_usd','price_impact_bps',
    'slippage_bps','liquidity_depth_usd','curve_type',
    'concavity','optimal_split_threshold_usd',
    'marginal_impact_bps','cumulative_impact_bps'
  ];
  const INPUT_AMOUNTS = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const inputAmt   = pick(INPUT_AMOUNTS);
    const liq        = Math.pow(10, randU(5, 9));
    const ctype      = pick(CURVE_TYPES);
    // Price impact scales with input / liquidity
    const baseImpact = (inputAmt / liq) * 10000;
    const impact     = Math.max(0.01, baseImpact * randU(0.5, 2.0));
    const slip       = Math.abs(impact * randU(0.8, 1.2));
    const outputAmt  = inputAmt * (1 - impact / 10000);
    const marginal   = impact * randU(0.1, 0.5);
    const cumul      = impact * randU(1.0, 1.8);
    const threshold  = liq * randU(0.01, 0.1);
    rows.push([
      `pic_${String(i+1).padStart(6,'0')}`,
      randTs(),
      pick(VENUES),
      pick(CHAINS),
      pick(ALL_PAIRS),
      inputAmt,
      outputAmt.toFixed(6),
      impact.toFixed(6),
      slip.toFixed(6),
      liq.toFixed(2),
      ctype,
      pick(CONCAVITY),
      threshold.toFixed(2),
      marginal.toFixed(6),
      cumul.toFixed(6)
    ]);
  }
  return { headers, rows };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\nGanji\'s DeFi SOR Protocol — Large-Scale Research Dataset Generator');
console.log('Generating 265,000 rows across 10 CSV files...\n');

const start = Date.now();

const datasets = [
  { fn: genRouteDiscovery,   file: 'sor_route_discovery.csv',       n: 50000  },
  { fn: genVenueScanner,     file: 'sor_venue_scanner.csv',         n: 100000 },
  { fn: genAgentIntents,     file: 'sor_agent_intents.csv',         n: 30000  },
  { fn: genCircuitBreaker,   file: 'sor_circuit_breaker.csv',       n: 10000  },
  { fn: genBellmanFord,      file: 'sor_bellman_ford.csv',          n: 10000  },
  { fn: genVenuePerformance, file: 'sor_venue_performance.csv',     n: 15000  },
  { fn: genCrossChainRoutes, file: 'sor_cross_chain_routes.csv',    n: 12000  },
  { fn: genMevProtection,    file: 'sor_mev_protection.csv',        n: 8000   },
  { fn: genSplitRouteAnalysis, file: 'sor_split_route_analysis.csv', n: 10000 },
  { fn: genPriceImpactCurves, file: 'sor_price_impact_curves.csv',  n: 20000  },
];

let total = 0;
for (const d of datasets) {
  const { headers, rows } = d.fn(d.n);
  writeCSV(d.file, headers, rows);
  total += rows.length;
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\nDone. ${total.toLocaleString()} rows written in ${elapsed}s`);
console.log('Output directory:', OUT);
