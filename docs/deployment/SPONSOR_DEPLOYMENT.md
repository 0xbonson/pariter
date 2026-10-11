# Sponsor & Third-Party Deployment Guide — Pariter

**Network:** Arc Mainnet (Chain ID `5042`)  
**Target Contract:** [`contracts/src/BatchPayout.sol`](../../contracts/src/BatchPayout.sol)  
**Compiler:** Solidity `^0.8.24` (Solc `0.8.37`, EVM `cancun`, optimizer `200` runs)  
**Canonical USDC Precompile:** `0x3600000000000000000000000000000000000000` (6 decimals)  

---

## 1. Security Architecture: Why Third-Party Deployment is Safe

`BatchPayout.sol` is designed from first principles with **zero deployer coupling**:
- **No Owner or Admin Roles:** The contract has no `onlyOwner` modifiers, no governance mechanisms, and no access control roles.
- **Immutable State:** The only state variable set at deployment is the immutable canonical USDC token precompile (`usdc = IERC20(_usdc)`).
- **Transient Balance:** The contract never holds custody of funds across transactions. It enforces an atomic net balance conservation check (`balanceAfter == balanceBefore`).
- **Independent Payer Authentication:** Payout authorizations are strictly scoped to the transaction caller (`msg.sender`). Only the payer who approves the ERC-20 contract can initiate batch payouts.

**Conclusion:** Any party—an official Arc DevRel engineer, an ecosystem sponsor, or an automated wallet—can deploy this contract. The deployer receives **zero** privileged control over the contract or its future transactions.

---

## 2. Option A: Sponsor Deploys Directly (Recommended)

If a sponsor or DevRel engineer has a funded Arc Mainnet wallet and wishes to deploy the contract on behalf of the project without transferring funds:

### Step 1: Clone and Build
```bash
git clone https://github.com/0xbonson/pariter.git
cd pariter/contracts
forge build
```

### Step 2: Simulate Deployment (Dry-Run)
```bash
forge script script/DeployBatchPayout.s.sol:DeployBatchPayout \
  --rpc-url https://rpc.mainnet.arc.io
```
*Expected gas requirement: ~759,413 gas (approx. ~0.0304 USDC in native gas at 40 gwei).*

### Step 3: Broadcast Deployment
The sponsor broadcasts using their preferred secure wallet (keystore, hardware wallet, or interactive prompt):

```bash
# Using encrypted keystore:
forge script script/DeployBatchPayout.s.sol:DeployBatchPayout \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --account <sponsor-account-name>

# OR using Ledger hardware wallet:
forge script script/DeployBatchPayout.s.sol:DeployBatchPayout \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --ledger
```

### Step 4: Share Deployed Address
Foundry outputs:
`BatchPayout successfully deployed at: 0x...`

Provide the deployed address. The project maintainer updates `VITE_BATCH_PAYOUT_ADDRESS` in GitHub Pages environment settings to activate live payouts.

---

## 3. Option B: Micro-Gas Drop (~0.10 USDC)

If a sponsor prefers to provide a gas grant to the builder's wallet:

1. **Amount Required:** **~0.10 USDC** (native Arc asset). Covers deployment (~0.0304 USDC), payer approval (~0.0018 USDC), verification settlement (~0.0052 USDC), and fee buffer.
2. **Recipient Address:** Builder's public Arc wallet address.
3. **Execution:** The builder broadcasts using a local encrypted keystore via `cast wallet import`. Private keys remain completely local and never leave the builder's machine.

---

## 4. Independent Onchain Verification

Once deployed, any party can verify the runtime bytecode against the repository:

```bash
# 1. Inspect deployed bytecode:
cast code <DEPLOYED_ADDRESS> --rpc-url https://rpc.mainnet.arc.io

# 2. Confirm immutable USDC address:
cast call <DEPLOYED_ADDRESS> "usdc()(address)" --rpc-url https://rpc.mainnet.arc.io
# Expected return value: 0x3600000000000000000000000000000000000000

# 3. Confirm maximum batch size:
cast call <DEPLOYED_ADDRESS> "MAX_BATCH_SIZE()(uint256)" --rpc-url https://rpc.mainnet.arc.io
# Expected return value: 250
```
