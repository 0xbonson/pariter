# Pariter — Known Risks & Operational Limitations

**Audit Notice:** Pariter has undergone rigorous internal invariant and fuzz testing, but has NOT been audited by an independent external security auditing firm. Reviewers and operators must evaluate code and risk profiles accordingly.  
**Date:** 2026-10-11  

---

## 1. Smart Contract Limitations

1. **Duplicate Recipients Within a Single Batch:**
   - The contract permits multiple payment line items to the same recipient address. This accommodates valid workflows (e.g. paying separate project milestones in one batch).
   - *Risk:* An operator might accidentally duplicate an address when pasting.
   - *Mitigation:* The frontend surfaces an amber duplicate-address advisory warning before signature.
2. **Batch Size Limit:**
   - Capped at 250 recipients per batch (`MAX_BATCH_SIZE = 250`).
   - Teams requiring larger disbursements must partition their payouts across multiple batches.
3. **No Unilateral Cancel Once Broadcast:**
   - Once a transaction is submitted to the Arc mempool and signed, it executes according to network priority. Operators must review the pre-flight summary carefully.

---

## 2. Arc Network Dependencies

1. **RPC Availability:**
   - Verification and transaction simulation depend on Arc JSON-RPC nodes (`https://rpc.mainnet.arc.io`).
   - If public RPC endpoints experience rate limiting or downtime, transaction status checks may temporarily fail to fetch live receipts until connectivity resumes.
2. **USDC Dual-Accounting:**
   - Native gas fees consume native USDC (18 decimals) while payout amounts consume ERC-20 USDC (6 decimals).
   - If an account spends its entire balance on payouts without leaving a native gas reserve, subsequent transactions will revert due to insufficient gas funds.
   - The frontend enforces a minimum gas reserve calculation before allowing batch submission.

---

## 3. Offchain Identity & Non-Legal Assertions

1. **No Legal Contract Verification:**
   - Pariter settles onchain transfers of USDC. It does NOT guarantee that offchain deliverables were received, that invoices satisfy national legal standards, or that tax withholdings have been satisfied.
2. **Public Transaction Visibility:**
   - Arc is a public ledger. Recipient addresses, transaction timestamps, and USDC amounts are publicly visible. Pariter does not provide private/shielded transfers.
