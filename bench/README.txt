================================================================================
 Ganji's DeFi SOR Protocol — Large Scale Research Dataset
================================================================================

AUTHORS
  Abhijeeth Ganji (M.S. Data Science, Maryville University of St. Louis)
  Priyanka Velpula (Ex-Wipro, Blockchain Researcher)

PAPER
  Ganji's DeFi SOR Protocol: Multi-Venue Smart Order Routing
  for Human and Agent-Native Crypto Swaps on Base

PLATFORM   FluidNative MVP Research Prototype
WEBSITE    fluidnative.com
GITHUB     github.com/fluidbase9/fluid-sor
CONTRACT   0xF24daF8Fe15383fb438d48811E8c4b43749DafAE
CHAIN      Base Mainnet (Chain ID: 8453)
LICENSE    CC BY 4.0

================================================================================
 DATASET OVERVIEW
================================================================================

Total Rows:  265,000+
Files:       10 CSV files

  1.  sor_route_discovery.csv         50,000 rows
  2.  sor_venue_scanner.csv          100,000 rows
  3.  sor_agent_intents.csv           30,000 rows
  4.  sor_circuit_breaker.csv         10,000 rows
  5.  sor_bellman_ford.csv            10,000 rows
  6.  sor_venue_performance.csv       15,000 rows
  7.  sor_cross_chain_routes.csv      12,000 rows
  8.  sor_mev_protection.csv           8,000 rows
  9.  sor_split_route_analysis.csv    10,000 rows
  10. sor_price_impact_curves.csv     20,000 rows

================================================================================
 KEY METRICS (from paper)
================================================================================

  Route discovery      47.5ms mean (warm cache) / ~110ms (cold cache)
  End-to-end latency   ~280ms total
  Slippage             ~1.0 basis point
  REI score            0.9994 stablecoin / 0.9982 volatile
  VCS score            ~0.85 across 4 chains
  VER score            ~0.999
  Price improvement    +2.4 bps vs. single-venue benchmark
  Venues supported     25+ DEX venues
  Chains               Base, Ethereum, Solana, Injective (4 chains)
  Agent workload       10^2 to 10^3 intents/min (autonomous agents)
  Bellman-Ford         |V| ~200, |E| ~1500, convergence < 50ms
  Pauli Proof          ~47ms cryptographic attestation
  MEV protection       Private mempool routing, ~88% detection rate
  Split routing        Marginal cost equalization (Theorem 4.2)
  Circuit breaker      3-tier: slippage, gas spike, venue staleness

================================================================================
 FILE DESCRIPTIONS
================================================================================

1. sor_route_discovery.csv (50,000 rows)
   Captures each route discovery event. Includes warm/cold cache timing,
   REI (Routing Efficiency Index), VCS (Venue Coverage Score), sovereignty
   weights, Pauli Proof attachment status, and per-route gas estimates.

2. sor_venue_scanner.csv (100,000 rows)
   Raw venue scanner observations: price quotes, liquidity depth, latency,
   staleness, and whether each venue was selected as optimal for that slot.

3. sor_agent_intents.csv (30,000 rows)
   Agent-submitted swap intents. Includes Ganji Nonce Vector N4 for
   uniqueness guarantees, GAF route hash, sovereignty weight, VER score,
   capability scope, and per-intent performance metrics.
   50 unique agent IDs (agent_001 to agent_050).

4. sor_circuit_breaker.csv (10,000 rows)
   3-tier circuit breaker events:
     Tier 1 = slippage spike (threshold 5.0 bps)
     Tier 2 = gas spike (threshold 10.0x)
     Tier 3 = venue staleness (threshold 3000ms)
   95% reroute success rate on triggered events.

5. sor_bellman_ford.csv (10,000 rows)
   GanjiRoute-BellmanFord graph optimization runs. |V| ~200, |E| ~1500,
   computation time < 50ms. Includes negative cycle detection and
   optimality proof flags. Workload classes W1/W2/W3.

6. sor_venue_performance.csv (15,000 rows)
   Aggregated venue-level performance metrics: latency distributions,
   uptime, daily volume, route selection frequency, and composite
   venue scores.

7. sor_cross_chain_routes.csv (12,000 rows)
   Cross-chain bridge routing events across 6 chain-pair combinations
   (Base, Ethereum, Solana, Injective) via LI.FI, Across, Wormhole,
   deBridge, Socket. Includes finality type and reorg risk.

8. sor_mev_protection.csv (8,000 rows)
   MEV attack events and protection outcomes. Covers sandwich attacks,
   frontrunning, backrunning, JIT liquidity. Private mempool routing
   achieves ~95% prevention rate when detected.

9. sor_split_route_analysis.csv (10,000 rows)
   Split route optimization analysis validating Theorem 4.2 (Split-Route
   Optimality via marginal cost equalization). Compares aggregate slippage
   of split routes vs. single-venue routing.

10. sor_price_impact_curves.csv (20,000 rows)
    Price impact curve measurements across 9 input amount tiers ($100 to
    $1M) per venue. Includes marginal and cumulative impact, curve type
    (constant_product, stableswap, concentrated, weighted), and optimal
    split thresholds.

================================================================================
 CRYPTOGRAPHIC PRIMITIVES & FORMAL CONSTRUCTS
================================================================================

  Ganji Nonce Vector N4 = (n_time, n_chain, n_req, n_agent)
    Guarantees uniqueness across time, chain, request, and agent dimensions.

  GAF Route Hash = H(UAI, N4, scope, rho_route)
    32-byte hash binding user agent identity, nonce, capability scope,
    and the selected route.

  Pauli Proof
    ZK attestation (~47ms generation). Cryptographically proves route
    optimality without revealing private state.

  Ganji Sovereignty Weight (rho_sovereignty)
    Formal routing objective parameter.
    Range: 0.40-0.85 (human), 0.85-1.0 (autonomous agents).

================================================================================
 THEOREMS VALIDATED
================================================================================

  Theorem 4.1 - Path Optimality
    GanjiRoute-BellmanFord finds the globally optimal path in
    O(|V| * |E|) time for graphs with |V| ~200, |E| ~1500.

  Theorem 4.2 - Split-Route Optimality
    Optimal multi-venue allocation equalizes marginal price impact
    across all selected venues.

  Theorem 4.3 - Sovereignty Preservation
    Routing decisions preserve user-specified sovereignty weight
    throughout execution.

  Theorem 4.4 - Verifiable Execution Receipt (VER)
    Every executed route produces a cryptographically verifiable
    receipt with VER score >= 0.998.

================================================================================
 CITATION
================================================================================

Ganji, Abhijeeth; Velpula, Priyanka, 2026,
"Ganji's DeFi SOR Protocol - Large Scale Research Dataset"
265,000+ rows, 10 CSV files
Kaggle: kaggle.com/datasets/abhijeethganji9/ganji-defi-sor-protocol
GitHub: github.com/fluidbase9/fluid-sor
Paper: Ganji's DeFi SOR Protocol: Multi-Venue Smart Order Routing
       for Human and Agent-Native Crypto Swaps on Base

================================================================================
