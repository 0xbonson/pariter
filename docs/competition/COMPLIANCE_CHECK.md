# Circle Arc Microgrants 2026 — Compliance & Verification Matrix

| Requirement | Project Implementation | Status |
| :--- | :--- | :--- |
| **Target Network** | Configured strictly for Arc Mainnet (Chain ID 5042) | VERIFIED |
| **RPC & Explorer** | `https://rpc.mainnet.arc.io` / `https://explorer.arc.io` | VERIFIED |
| **USDC Denomination** | Native 18-decimal gas budgeting distinct from 6-decimal ERC-20 transfer units | VERIFIED |
| **Atomic Payout Contract** | `BatchPayout.sol` on Foundry with SafeERC20 and zero fund retention | IMPLEMENTED |
| **Test Suite** | Unit, fuzz, edge-case, and invariance tests for contracts and frontend | IMPLEMENTED |
| **Live Web App** | Responsive React + Vite application with read-only receipt verifier | IMPLEMENTED |
| **Public Codebase** | Clean git repository with zero leaked secrets or credentials | IMPLEMENTED |
| **Mainnet Deployment** | Deployed contract on Arc Mainnet with confirmed bytecode | PENDING (Awaiting Operator Authorization) |
| **Verified Payout Receipt** | Genuine transaction hash verified by independent verifier | PENDING (Awaiting Operator Execution) |
| **Submission Package** | Factual submission copy, architecture diagrams, and review guide | IMPLEMENTED |

### Verification Protocols
- **No Simulation as Reality:** All tests distinguish local mocks from mainnet state.
- **No Fabricated Stats:** No claims of fictitious transaction volumes, false partnerships, or fake audits.
- **Human Safeguard:** No live funds are spent without explicit operator consent.
