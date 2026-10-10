# Pariter — Arc Mainnet Deployment & Verification Protocol

**Network:** Arc Mainnet  
**Chain ID:** `5042`  
**Public RPC:** `https://rpc.mainnet.arc.io`  
**Block Explorer:** `https://explorer.arc.io`  
**Gas Currency:** Native USDC (18 decimals)  
**Canonical USDC Precompile:** `0x3600000000000000000000000000000000000000` (6 decimals)  
**Date:** 2026-10-11  

---

## 1. Pre-Deployment Verification Checklist

Before broadcasting transactions on Arc Mainnet, verify:
- [x] All 19 Foundry smart contract tests pass (18 unit/fuzz + 1 invariant with 128,000 calls).
- [x] All 18 frontend unit and validation tests pass (`npm test`).
- [x] Frontend builds without TypeScript or bundling errors (`npm run build`).
- [x] Contract contains zero custody, zero protocol fees, and zero admin keys.
- [x] Target chain ID matches Arc Mainnet (`5042`).
- [x] USDC constructor argument matches `0x3600000000000000000000000000000000000000`.

---

## 2. Gas Estimation for Deployment

| Action | Estimated Gas Units | Gas Price (Current Arc Mempool) | Estimated Cost in Native USDC |
| :--- | :--- | :--- | :--- |
| **Deploy `BatchPayout`** | ~480,000 gas | ~20 gwei ($20 \times 10^{-9}$ USDC) | **~0.0096 USDC** |
| **USDC Approval (Payer)** | ~45,000 gas | ~20 gwei ($20 \times 10^{-9}$ USDC) | **~0.0009 USDC** |
| **Execute Batch (3 Recip.)**| ~150,000 gas | ~20 gwei ($20 \times 10^{-9}$ USDC) | **~0.0030 USDC** |

*Note: Arc's native gas asset is USDC. A deployer wallet requires less than $0.05 USDC in native balance to complete deployment and test settlement.*

---

## 3. Human Authorization & Execution Procedure

> [!IMPORTANT]
> Live funds must never be spent without human authorization. The operator signs directly from their secure wallet. Never input private keys into shared terminal histories or chat prompts.

### Method A: Interactive Deployment via Cast / Forge (Recommended)
Using an interactive prompt so secrets are never saved to disk:

```bash
cd contracts

# Run Forge Script interactively on Arc Mainnet
forge script script/DeployBatchPayout.s.sol:DeployBatchPayout \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --interactive \
  --slow
```

### Method B: Using Foundry Keystore
```bash
# Import your encrypted keystore once
cast wallet import arc-deployer --interactive

# Broadcast deployment
forge script script/DeployBatchPayout.s.sol:DeployBatchPayout \
  --rpc-url https://rpc.mainnet.arc.io \
  --account arc-deployer \
  --broadcast \
  --slow
```

### Method C: Using Ledger / Trezor Hardware Wallet
```bash
forge script script/DeployBatchPayout.s.sol:DeployBatchPayout \
  --rpc-url https://rpc.mainnet.arc.io \
  --ledger \
  --broadcast \
  --slow
```

---

## 4. Post-Deployment Bytecode Verification

Verify deployed bytecode matches local compilation:

```bash
# Retrieve deployed runtime bytecode
cast code <DEPLOYED_CONTRACT_ADDRESS> --rpc-url https://rpc.mainnet.arc.io

# Verify configured USDC address on contract
cast call <DEPLOYED_CONTRACT_ADDRESS> "usdc()(address)" --rpc-url https://rpc.mainnet.arc.io
# Must return: 0x3600000000000000000000000000000000000000
```

---

## 5. Mainnet Evidence Record Template

| Field | Mainnet Evidence |
| :--- | :--- |
| **Contract Name** | `BatchPayout` |
| **Deployed Address** | `PENDING_OPERATOR_DEPLOYMENT` |
| **Deployment Tx Hash** | `PENDING_OPERATOR_DEPLOYMENT` |
| **Deployer Address** | `PENDING_OPERATOR_DEPLOYMENT` |
| **Arc Mainnet Block** | `PENDING_OPERATOR_DEPLOYMENT` |
| **Gas Used** | `PENDING_OPERATOR_DEPLOYMENT` |
| **Fee Paid (USDC)** | `PENDING_OPERATOR_DEPLOYMENT` |
| **Compiler Version** | Solc `0.8.37` (EVM cancun, 200 optimizer runs) |
| **Verified Test Payout Tx** | `PENDING_OPERATOR_EXECUTION` |
