# Pariter — Atomic USDC Settlement Engine on Arc Mainnet

[![Foundry Tests](https://img.shields.io/badge/Foundry-19%2F19%20Passing-brightgreen)](https://getfoundry.sh/)
[![Vitest](https://img.shields.io/badge/Vitest-53%2F53%20Passing-brightgreen)](https://vitest.dev/)
[![Network](https://img.shields.io/badge/Network-Arc%20Mainnet%20(5042)-blue)](https://docs.arc.io/)
[![License](https://img.shields.io/badge/License-MIT-slate)](LICENSE)

Pariter is an open-source, non-custodial USDC batch payout and independent settlement verification tool designed for small teams, grant programs, and contributor communities on **Arc Mainnet** (Chain ID `5042`).

Built for the **Circle Arc Microgrants 2026** program on DoraHacks.

---

## 1. The Problem

Distributed developer collectives, open-source communities, and hackathon organizers frequently need to distribute grants and contributor bounties in USDC. Today, operators either:
- Execute separate single-recipient transfers, repeatedly paying base fees and generating disjointed records.
- Use centralized custodial payroll platforms requiring corporate onboarding, fiat bank connections, and recurring fees.
- Use legacy multi-senders that wrap tokens or levy protocol fee deductions.

---

## 2. Why Arc Mainnet

Arc is a Layer-1 blockchain built by Circle where **USDC is the native gas asset**:
- **Zero Token Wrapping:** Native USDC powers network gas while standard smart contracts interact with the canonical ERC-20 precompile at `0x3600000000000000000000000000000000000000`.
- **Direct USDC Settlement:** Transaction fees are denominated and paid directly in native USDC without needing a secondary volatile gas token. Actual costs vary with batch size and network base fees.
- **Fast Execution:** Fast transaction inclusion on Arc Mainnet without cross-chain bridge overhead.

---

## 3. Core Architecture

```
┌────────────────────────────────────────────────────────┐
│                      PARITER WEB UI                    │
│   (Vite + React + TypeScript + viem + wagmi + Tailwind) │
└───────────┬────────────────────────────────┬───────────┘
            │ 1. Approve & Execute Batch     │ 2. Read-only Verification
            ▼                                ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│       BatchPayout.sol         │ │   Arc JSON-RPC       │
│ - Exact-pull safeTransferFrom │ │   (Chain ID 5042)    │
│ - Atomic distribution loop    │ └──────────────────────┘
│ - Invariant: Balance conserved│
│ - Payer-scoped replay lock    │
└───────────┬───────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│             Canonical Arc USDC Precompile              │
│       0x3600000000000000000000000000000000000000       │
└────────────────────────────────────────────────────────┘
```

---

## 4. Architectural Safeguards

1. **Strict Dual-Unit Precision Separation:**
   - Native gas units: 18 decimals ($10^{-18}$ USDC).
   - ERC-20 transfer units: 6 decimals ($10^{-6}$ USDC).
   - Zero floating-point arithmetic in client or contract code; all calculations use integer `bigint`.
2. **Atomicity Guarantee:** All transfers in a batch must succeed, or the entire transaction reverts.
3. **Net Balance Conservation & Non-Custody:** The contract retains zero net USDC from any batch execution. It verifies `balanceAfter == balanceBefore`, guaranteeing that all pulled payer tokens are fully distributed to recipients without griefing vulnerability to direct transfers. Stateful property-based invariant fuzzing across 128,000 handler calls confirmed that batch execution never mutates net contract balances.
4. **Payer-Scoped Replay Protection:** Each batch is indexed by `bytes32 batchId` scoped directly to `msg.sender`.

---

## 5. Repository Layout

```
.
├── contracts/               # Foundry smart contracts project
│   ├── src/
│   │   └── BatchPayout.sol  # Atomic settlement contract
│   ├── test/
│   │   ├── BatchPayout.t.sol           # 19 unit and fuzz tests
│   │   ├── invariants/                 # Invariant testing harness (128,000 calls)
│   │   └── mocks/                      # Mock 6-decimal USDC contract
│   ├── script/
│   │   └── DeployBatchPayout.s.sol     # Mainnet deployment script
│   └── foundry.toml
│
├── web/                     # TypeScript + React + Vite application
│   ├── src/
│   │   ├── components/      # UI components (Header, Badges)
│   │   ├── features/        # Payout Composer, Modal, Receipt Verifier
│   │   └── lib/             # Chain config, Money math, Typed ABIs
│   └── package.json
│
├── docs/                    # Architectural and audit documentation
│   ├── competition/         # Official requirements and compliance check
│   ├── architecture/        # System topology and state machine
│   ├── brand/               # Name research, trademark screening, visual identity
│   ├── security/            # Security model and known operational risks
│   ├── deployment/          # Arc Mainnet deployment guide and evidence
│   └── submission/          # DoraHacks submission package
│
├── README.md
└── LICENSE
```

---

## 6. Development & Testing Instructions

### Prerequisites
- Node.js $\ge 18$
- Foundry (`forge` and `cast`)

### Smart Contract Tests (Foundry)
```bash
cd contracts

# Run all 19 unit and fuzz tests
forge test -vvv

# Run invariant testing (128,000 handler calls)
forge test --match-contract BatchPayoutInvariantTest
```

### Frontend Tests & Build (Web)
```bash
cd web

# Install dependencies
npm install

# Run financial math and verification unit tests
npm test

# Build production bundle
npm run build
```

---

## 7. Arc Mainnet Deployment & Verification

See [docs/deployment/MAINNET.md](docs/deployment/MAINNET.md) for full deployment instructions and gas estimations. For third-party or DevRel deployment procedures, see the [Sponsor Deployment Guide](docs/deployment/SPONSOR_DEPLOYMENT.md).

```bash
cd contracts
forge script script/DeployBatchPayout.s.sol:DeployBatchPayout \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --interactive
```

---

## 8. Limitations & Scope Boundaries

- **Onchain Settlement Only:** Pariter validates token movements on Arc Mainnet. It does not certify contractor identity, work completion, or offchain legal invoice validity.
- **Batch Ceiling:** Capped at 250 recipients per batch to stay well below the 30M EVM block gas limit.
- **Testing & Audit Status:** Pariter has undergone developer verification via 19 Foundry unit/fuzz tests and 128,000 stateful invariant fuzz iterations. This empirical property testing does not constitute a formal mathematical proof, and the codebase has not undergone a formal third-party security audit.
- **Provisional Brand:** The name *Pariter* is provisional and pending formal trademark clearance.
