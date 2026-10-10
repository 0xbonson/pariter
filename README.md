# Pariter — Atomic USDC Settlement Engine on Arc Mainnet

[![Foundry Tests](https://img.shields.io/badge/Foundry-19%2F19%20Passing-brightgreen)](https://getfoundry.sh/)
[![Vitest](https://img.shields.io/badge/Vitest-18%2F18%20Passing-brightgreen)](https://vitest.dev/)
[![Network](https://img.shields.io/badge/Network-Arc%20Mainnet%20(5042)-blue)](https://docs.arc.io/)
[![License](https://img.shields.io/badge/License-MIT-slate)](LICENSE)

Pariter is an independent, non-custodial multi-recipient USDC payment settlement and verification engine engineered for **Arc Mainnet** (Chain ID `5042`).

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
- **Low, Predictable Fees:** Sub-cent transaction execution ($< \$0.005$ per batch) settled directly in USDC.
- **Fast Block Times:** Sub-second settlement finality.

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
│ - Invariant: Zero retention   │
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
3. **Zero-Custody Invariant:** The contract holds 0 USDC before and after every execution. Invariant testing verified `balanceOf(contract) == 0` across 128,000 randomized state transitions.
4. **Payer-Scoped Replay Protection:** Each batch is indexed by `bytes32 batchId` scoped directly to `msg.sender`.

---

## 5. Repository Layout

```
.
├── contracts/               # Foundry smart contracts project
│   ├── src/
│   │   └── BatchPayout.sol  # Atomic settlement contract
│   ├── test/
│   │   ├── BatchPayout.t.sol           # 18 unit and fuzz tests
│   │   ├── invariants/                 # Invariant testing harness
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

# Run all 18 unit and fuzz tests
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

See [docs/deployment/MAINNET.md](docs/deployment/MAINNET.md) for full deployment instructions and gas estimations.

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
- **Audit Disclaimer:** Pariter has been self-audited with extensive fuzz and invariant testing, but has not undergone a formal third-party audit by an external firm.
- **Provisional Brand:** The name *Pariter* is provisional and pending formal trademark clearance.
