# DoraHacks Submission Package — Pariter

**Program:** Circle Arc Microgrants 2026  
**Host / Platform:** Circle on DoraHacks  
**Category:** Arc Mainnet Developer Infrastructure & Payments  
**Submission Deadline:** October 14, 2026 at 23:59 ET (October 15, 2026 at 10:59 WIB)  
**Project Name:** Pariter  
**License:** MIT (100% Open Source)  

---

## 1. Official Submission Fields & Direct Links

| Submission Field | Submission Value |
| :--- | :--- |
| **Project Name** | **Pariter** |
| **Tagline / Short Pitch** | Open-source, non-custodial USDC batch payout and independent settlement verification tool engineered for Arc Mainnet. |
| **Project Track** | Functional Prototype / Developer Utility |
| **Target Network** | **Arc Mainnet** (Chain ID: `5042`) |
| **Public GitHub Repository** | https://github.com/0xbonson/pariter |
| **Live Web Application** | https://0xbonson.github.io/pariter/ |
| **BatchPayout Contract Address** | `[PENDING_OPERATOR_MAINNET_DEPLOYMENT]` *(Coordinates: Solc 0.8.37, cancun, 200 runs, USDC: `0x3600000000000000000000000000000000000000`)* |
| **Verified Settlement Tx Hash** | `[PENDING_OPERATOR_TEST_PAYOUT]` |

---

## 2. Problem Statement

Small grant programs, hackathon organizers, bounty managers, and open-source collectives on Arc Mainnet frequently disburse compensation to dozens of contributors in USDC. Currently, operators face a painful trade-off:
1. **Manual Single Transfers:** Executing dozens of individual transactions in standard wallets, manually approving each prompt, incurring repeated base gas overhead, and generating disjointed transaction records.
2. **Proprietary & Custodial Payroll Platforms:** Requiring institutional KYC, fiat banking connections, custodial deposits, and recurring monthly SaaS subscription fees.
3. **General Token Multi-Senders:** Often closed-source, charging mandatory percentage or fixed protocol service fees per batch, and lacking cryptographic settlement verification for contributors.

---

## 3. Solution & Arc-Specific Architecture

Pariter delivers a dedicated, lightweight, 100% client-side settlement engine designed specifically around **Arc Mainnet's unique native-USDC architecture**:

1. **Atomic Batch Settlement (`BatchPayout.sol`):**
   * Settle up to 250 contributor payouts in a single atomic transaction.
   * All payouts succeed or the entire transaction reverts—eliminating partial failures and manual state reconciliation.
   * Pulls exact funds via `SafeERC20.safeTransferFrom`, never retains custodial balances, and enforces an atomic post-execution Net Balance Conservation invariant (`balanceAfter == balanceBefore`).

2. **Arc-Native Dual-Unit Accounting:**
   * Arc uses native USDC (18 decimals) for network execution fees, while applications interface with the canonical 6-decimal precompile at `0x3600000000000000000000000000000000000000`.
   * Pariter enforces strict separation between 18-decimal gas budgets and 6-decimal transfer units, using pure integer `bigint` arithmetic with zero floating-point conversions.

3. **Independent Proof Pack & Offchain CSV Reconciliation:**
   * Public, walletless **Settlement Verifier** queries Arc Mainnet JSON-RPC directly to verify transaction status, emitter address authenticity, and canonical ERC-20 transfer logs.
   * Verifies runtime bytecode authenticity against the approved release hash (`0x2f07db6a943509dc0879fea7f223d2cdd33b855a6699dc5872984b4987dbc66e`).
   * Optional **CSV Reconciliation Engine** matches intended offchain payment lists 1-to-1 against verified onchain events, outputting inspectable JSON Proof Packs (`pariter-proof-pack.json`) and CSV audit reports.

4. **Zero Protocol Fees & Pure Client-Side Privacy:**
   * $0 protocol fees: 100% of payer funds go to recipients and network gas.
   * No backend servers, databases, or cookies: all CSV processing and reconciliation happens locally in the user's browser.

---

## 4. Competitive Differentiation

| Capability | Pariter | payrail | Arctools | Request Finance |
| :--- | :--- | :--- | :--- | :--- |
| **Open Source** | **100% Open Source (MIT)** | Proprietary | Proprietary | Proprietary |
| **Protocol Fees** | **$0 (Zero cut)** | Free / Custom | Fixed service fee | Subscription SaaS |
| **Custody / Backend** | **Non-custodial, No backend** | SaaS infrastructure | Non-custodial | SaaS cloud |
| **Independent Proof Pack** | **Client-side JSON/CSV bundle** | CSV export | Basic explorer link | Accounting report |
| **Bytecode Verification** | **Cryptographic runtime hash** | Unverified in UI | Unverified in UI | Offchain |

*Note: Pariter does not claim to have invented batch transfers or receipt verification. It provides an unbundled, open-source, fee-free utility focused exclusively on Arc USDC.*

---

## 5. Technical Implementation & Test Coverage

* **Smart Contracts:** Solidity `0.8.37`, Foundry, OpenZeppelin `SafeERC20` & `ReentrancyGuard`.
  * **19 Foundry Tests:** Unit, fuzz, boundary (249, 250, 251 recipients), and adversarial reentrancy/spoofing tests.
  * **Stateful Invariant Fuzzing:** 128,000 randomized state transitions confirming contract net balance conservation.
* **Frontend Web Application:** TypeScript, React, Vite, Tailwind CSS, viem, wagmi.
  * **53 Vitest Tests:** RFC 4180 CSV parser (quoted strings, headers, commas/tabs), integer arithmetic, receipt decoding, adversarial emitter isolation, and 1-to-1 reconciliation matching.
  * **Automated CI/CD:** Continuous build, test, and GitHub Pages deployment via GitHub Actions.

---

## 6. Real Gas Economics (Arc Mainnet)

* **1-Time ERC-20 Token Approval:** ~45,000 gas (~0.0009 USDC at 20 gwei).
* **Single Transfer:** ~29,000 gas (~0.00058 USDC per recipient).
* **Atomic Batch Settlement:** ~36,000 base + ~28,000 gas per recipient.
* **Operational Efficiency:** For 1 recipient, a direct transfer has lower base overhead. For 5 or more recipients, atomic batching eliminates dozens of separate wallet signatures, prevents partial-failure griefing, and generates a unified settlement receipt.

---

## 7. Limitations & Honest Scope Boundaries

* **Settlement Verification Only:** Confirms cryptographic token movements on Arc Mainnet; does not certify contractor identity, legal obligations, or offchain work completion.
* **Batch Limit:** Strictly capped at 250 recipients per transaction to ensure execution remains well below the 30M EVM block gas limit.
* **Provisional Trademark:** The brand *Pariter* is provisional and pending formal clearance.
