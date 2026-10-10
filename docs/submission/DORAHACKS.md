# DoraHacks Submission Package — Pariter

**Program:** Circle Arc Microgrants 2026  
**Category:** Arc Mainnet Developer Infrastructure & Payments  
**Submission Date:** October 2026  
**Internal Codename:** `arc-payout-workspace`  
**Provisional Public Name:** Pariter  

---

## 1. Core Submission Details

| Field | Submission Value |
| :--- | :--- |
| **Project Title** | Pariter: Atomic USDC Settlement Engine on Arc Mainnet |
| **Short Pitch** | A non-custodial, atomic USDC batch payout and independent settlement verification engine engineered specifically for Arc Mainnet's native-USDC architecture. |
| **Target Network** | Arc Mainnet (Chain ID `5042`) |
| **Project Track** | Functional Prototype / Developer Utility |
| **Public Repository** | `<PUBLIC_GITHUB_REPO_URL>` |
| **Live Web App** | `<LIVE_VERCEL_OR_CLOUDFLARE_URL>` |
| **Mainnet Contract** | `<DEPLOYED_BATCH_PAYOUT_ADDRESS>` |
| **Verified Payout Tx** | `<VERIFIED_SETTLEMENT_TRANSACTION_HASH>` |

---

## 2. Project Narrative & Operational Problem

### The Operational Bottleneck
Hackathon organizers, open-source maintainers, and distributed developer teams routinely need to disburse grants and compensation in USDC to multiple contributors. On conventional EVM networks, operators either:
1. Execute individual transfers sequentially, paying separate base fees and manually tracking multiple transaction receipts.
2. Rely on centralized custodial payroll platforms requiring KYC, bank links, and recurring SaaS fees.
3. Use multi-senders that wrap tokens or charge non-standard protocol fees.

### The Solution: Pariter on Arc Mainnet
Pariter provides a compact, non-custodial settlement workflow tailored directly to Arc's unique architecture:
1. **Atomic Batch Settlement:** Settle up to 250 contributor payments in a single transaction via `BatchPayout.sol`. All transfers succeed or the transaction reverts atomically.
2. **Arc-Native Dual Accounting:** Leverages Arc's native USDC gas asset (18 decimals) while interfacing with the canonical 6-decimal USDC precompile (`0x3600...0000`) without synthetic token wrapping.
3. **Payer-Scoped Replay Protection:** Unique `batchId` keys ensure disbursements cannot be executed twice, while failed transactions do not lock state.
4. **Independent Public Verifier:** Reviewers and recipients can verify any transaction hash directly against Arc's JSON-RPC, cross-referencing `BatchSettled` events with underlying ERC-20 token transfers and exporting signed JSON receipts.

---

## 3. What Reviewers Can Independently Verify

1. **Smart Contract Invariants:**
   - 19 Foundry tests pass (`forge test`).
   - Invariant property fuzzing verifies `usdc.balanceOf(BatchPayout) == 0` across 128,000 randomized state transitions without any residual fund retention.
2. **Frontend Precision Arithmetic:**
   - 18 Vitest unit tests verify exact integer `bigint` arithmetic, zero floating-point math, strict 6-decimal parsing, and checksum enforcement.
3. **Onchain Settlement:**
   - Review the verified mainnet deployment on `https://explorer.arc.io/address/<CONTRACT>`.
   - Input the verified payout transaction hash into the Public Settlement Verifier to inspect event logs, gas fees, and recipient payouts.

---

## 4. Technical Stack

- **Smart Contracts:** Solidity `^0.8.24`, Foundry, OpenZeppelin SafeERC20 & ReentrancyGuard.
- **Frontend:** TypeScript, React, Vite, viem, wagmi, Tailwind CSS.
- **Network Integration:** Arc Mainnet RPC (`https://rpc.mainnet.arc.io`), Arc Explorer (`https://explorer.arc.io`).
- **Zero Heavy Infrastructure:** 100% client-side + onchain. Zero backend databases, zero private key custody, zero external telemetry.

---

## 5. Scope Boundaries & Current Limitations

- **No Invoicing or Legal Claims:** Pariter verifies onchain token movement. It makes no offchain claims regarding legal tax compliance or contractor performance.
- **Batch Size Ceiling:** Maximum 250 recipients per batch to stay comfortably within block gas limits.
- **Public Visibility:** Arc is a public blockchain; amounts and destination addresses are publicly queryable.
