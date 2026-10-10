# Pariter — Technical Architecture & System Overview

**Internal Codename:** `arc-payout-workspace`  
**Provisional Brand:** Pariter (`docs/brand/NAME_RESEARCH.md`)  
**Network:** Arc Mainnet (Chain ID `5042`)  
**Specification Date:** 2026-10-11  

---

## 1. System Mission & Boundary Definition

Pariter provides non-custodial, atomic USDC batch disbursements with independent onchain verification for decentralized teams, hackathons, and open-source grant programs.

### What Pariter Does
- Aggregates multi-recipient USDC disbursements into a single atomic transaction.
- Accurately reconciles native gas costs (18-decimal) and ERC-20 payout amounts (6-decimal).
- Protects against double-spend replay attacks using payer-scoped batch identifiers.
- Emits structured, machine-verifiable settlement events (`BatchSettled` and `PayoutExecuted`).
- Provides an open, read-only settlement verifier allowing any independent third party to audit payout authenticity directly against the Arc RPC.

### What Pariter Does Not Do
- Does not retain user funds (contract maintains 0 balance at all times).
- Does not manage custodial balances, bank integrations, or payroll taxes.
- Does not assert offchain legal validity of invoices or employment contracts.
- Does not employ administrative keys, upgradeable proxies, or protocol fee deductions.

---

## 2. Component Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PARITER WEB APPLICATION                         │
│                                                                        │
│   ┌─────────────────────┐    ┌──────────────────┐    ┌─────────────┐   │
│   │   Payout Composer   │    │  Batch Review &  │    │  Settlement │   │
│   │  (Input & Precision)│───▶│  Gas Estimator   │───▶│   Verifier  │   │
│   └─────────────────────┘    └──────────────────┘    └─────────────┘   │
│              │                        │                      ▲         │
│              ▼                        ▼                      │         │
│   ┌─────────────────────────────────────────────┐            │         │
│   │         viem / wagmi Connector              │            │         │
│   └─────────────────────────────────────────────┘            │         │
└───────────────────────┬──────────────────────────────────────┼─────────┘
                        │ (Wallet Signatures)                  │ (Read-only RPC)
                        ▼                                      │
┌──────────────────────────────────────────────────────────────┼─────────┐
│                          ARC MAINNET                         │         │
│                                                              │         │
│    ┌───────────────────────────┐                             │         │
│    │     BatchPayout.sol       │                             │         │
│    │  (Atomic Payout Contract) │                             │         │
│    └─────────────┬─────────────┘                             │         │
│                  │ transferFrom & transfer                   │         │
│                  ▼                                           │         │
│    ┌───────────────────────────┐                             │         │
│    │  USDC Precompile (ERC-20) │                             │         │
│    │  0x3600...0000 (6 dec)    │                             │         │
│    └───────────────────────────┘                             │         │
│                  │                                           │         │
│                  ▼                                           ▼         │
│         [Arc JSON-RPC (https://rpc.mainnet.arc.io / Chain 5042)]        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dual-Unit Currency Accounting (Arc Specific)

Arc utilizes **USDC as its native gas currency** while offering a precompiled **ERC-20 interface** at `0x3600000000000000000000000000000000000000`.

| Layer | Precision | Base Unit | Purpose |
| :--- | :--- | :--- | :--- |
| **Native Gas** | 18 decimals | Wei equivalent ($10^{-18}$ USDC) | Block execution fees, gas price |
| **ERC-20 Precompile** | 6 decimals | Micro-USDC ($10^{-6}$ USDC) | Batch transfers, token allowances |

### Accounting Safeguards
1. **Never Mixed in Code:** Native gas amounts (`bigint` with 18 decimals) and transfer amounts (`bigint` with 6 decimals) are strictly typed and never mixed in common variables.
2. **Strict Floating-Point Prohibition:** JavaScript `Number` is strictly prohibited in monetary paths; all arithmetic uses integer `bigint` with checked string formatting.
3. **Gas Buffering:** Payout execution ensures the wallet retains sufficient native balance to settle estimated gas fees plus buffer, preventing transaction abandonment mid-settlement.

---

## 4. Smart Contract Design (`BatchPayout.sol`)

- **Atomicity:** SafeERC20 `safeTransferFrom` pulls `totalTransferred` into the contract, followed by an immediate loop of `safeTransfer` to each recipient. If any transfer fails, the entire transaction reverts.
- **Zero Custody:** Post-condition `require(usdc.balanceOf(address(this)) == 0)` ensures no token is ever left behind.
- **Replay Protection:** `isBatchExecuted[msg.sender][batchId]` locks the batch ID once executed. Failed transactions do not lock the batch ID.
- **No Governance Surface:** Zero owner privileges, zero fees, zero emergency drains, zero proxies.
