import { describe, it, expect } from 'vitest';
import {
  encodeEventTopics,
  encodeAbiParameters,
  parseAbiParameters,
  type TransactionReceipt,
  type Transaction,
} from 'viem';
import { batchPayoutAbi } from '../../lib/contracts/batchPayoutAbi';
import { erc20Abi } from '../../lib/contracts/erc20Abi';
import { verifySettlementTransaction } from './settlementVerification';

const VERIFIED_CONTRACT = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const ATTACKER_CONTRACT = '0x9999999999999999999999999999999999999999' as `0x${string}`;
const CANONICAL_USDC = '0x3600000000000000000000000000000000000000' as `0x${string}`;
const PAYER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
const RECIP1 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`;
const RECIP2 = '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`;
const BATCH_ID = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as `0x${string}`;
const COMMITMENT = '0xfeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedface' as `0x${string}`;

function buildBatchSettledLog(contract: string, payer: string, batchId: string, count: bigint, total: bigint) {
  const topics = encodeEventTopics({
    abi: batchPayoutAbi,
    eventName: 'BatchSettled',
    args: {
      payer: payer as `0x${string}`,
      batchId: batchId as `0x${string}`,
    },
  });
  const data = encodeAbiParameters(
    parseAbiParameters('bytes32 referenceCommitment, uint256 recipientCount, uint256 totalTransferred'),
    [COMMITMENT, count, total]
  );
  return { address: contract, topics, data };
}

function buildPayoutExecutedLog(contract: string, payer: string, batchId: string, recipient: string, amount: bigint, index: bigint) {
  const topics = encodeEventTopics({
    abi: batchPayoutAbi,
    eventName: 'PayoutExecuted',
    args: {
      payer: payer as `0x${string}`,
      batchId: batchId as `0x${string}`,
      recipient: recipient as `0x${string}`,
    },
  });
  const data = encodeAbiParameters(
    parseAbiParameters('uint256 amount, uint256 index'),
    [amount, index]
  );
  return { address: contract, topics, data };
}

function buildErc20TransferLog(token: string, from: string, to: string, amount: bigint) {
  const topics = encodeEventTopics({
    abi: erc20Abi,
    eventName: 'Transfer',
    args: {
      from: from as `0x${string}`,
      to: to as `0x${string}`,
    },
  });
  const data = encodeAbiParameters(parseAbiParameters('uint256 value'), [amount]);
  return { address: token, topics, data };
}

describe('Settlement Verification Engine — Cryptographic Integrity & Adversarial Defense', () => {
  it('verifies a legitimate settlement with matching contract events and canonical USDC transfers', () => {
    const totalAmount = 2_000_000n; // 2.00 USDC
    const amt1 = 1_000_000n;
    const amt2 = 1_000_000n;

    const logs = [
      buildErc20TransferLog(CANONICAL_USDC, PAYER, VERIFIED_CONTRACT, totalAmount),
      buildErc20TransferLog(CANONICAL_USDC, VERIFIED_CONTRACT, RECIP1, amt1),
      buildPayoutExecutedLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, RECIP1, amt1, 0n),
      buildErc20TransferLog(CANONICAL_USDC, VERIFIED_CONTRACT, RECIP2, amt2),
      buildPayoutExecutedLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, RECIP2, amt2, 1n),
      buildBatchSettledLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, 2n, totalAmount),
    ];

    const result = verifySettlementTransaction({
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'success',
        blockNumber: 1000n,
        gasUsed: 150000n,
        effectiveGasPrice: 20000000000n,
        logs,
      } as unknown as TransactionReceipt,
      configuredContractAddress: VERIFIED_CONTRACT,
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: true,
      blockTimestamp: 1728630000n,
    });

    expect(result.status).toBe('VERIFIED_SETTLEMENT');
    expect(result.recipientCount).toBe(2);
    expect(result.totalTransferred).toBe(totalAmount);
    expect(result.tokenTransfersMatched).toBe(3); // 1 inbound + 2 outbound
    expect(result.items.length).toBe(2);
  });

  it('ADVERSARIAL: Rejects spoofed events emitted by a malicious unrelated contract', () => {
    // Malicious attacker contract emits matching BatchSettled and PayoutExecuted signatures!
    const logs = [
      buildBatchSettledLog(ATTACKER_CONTRACT, PAYER, BATCH_ID, 1n, 500_000n),
      buildPayoutExecutedLog(ATTACKER_CONTRACT, PAYER, BATCH_ID, RECIP1, 500_000n, 0n),
    ];

    const result = verifySettlementTransaction({
      txHash: '0xattacker000000000000000000000000000000000000000000000000000000000',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'success',
        blockNumber: 1001n,
        gasUsed: 60000n,
        logs,
      } as unknown as TransactionReceipt,
      configuredContractAddress: VERIFIED_CONTRACT,
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: true,
    });

    // Must be rejected because log.address is ATTACKER_CONTRACT, not VERIFIED_CONTRACT!
    expect(result.status).toBe('UNSUPPORTED');
    expect(result.verificationMessage).toContain('did not emit a valid BatchSettled event from the verified Pariter contract');
  });

  it('ADVERSARIAL: Rejects settlement if canonical USDC transfers are missing (fake events without tokens)', () => {
    // Verified contract address emits BatchSettled and PayoutExecuted, but NO canonical USDC was transferred!
    const logs = [
      buildBatchSettledLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, 1n, 1_000_000n),
      buildPayoutExecutedLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, RECIP1, 1_000_000n, 0n),
    ];

    const result = verifySettlementTransaction({
      txHash: '0xno_usdc_transfer_tx_hash000000000000000000000000000000000000000000',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'success',
        blockNumber: 1002n,
        gasUsed: 80000n,
        logs,
      } as unknown as TransactionReceipt,
      configuredContractAddress: VERIFIED_CONTRACT,
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: true,
    });

    expect(result.status).toBe('EVIDENCE_MISMATCH');
    expect(result.verificationMessage).toContain('Missing canonical USDC transfer');
  });

  it('ADVERSARIAL: Rejects settlement if outbound transfers do not match recipient or amount', () => {
    const totalAmount = 1_000_000n;
    const logs = [
      buildErc20TransferLog(CANONICAL_USDC, PAYER, VERIFIED_CONTRACT, totalAmount),
      // Inbound transfer exists, but outbound went to wrong recipient or wrong amount!
      buildErc20TransferLog(CANONICAL_USDC, VERIFIED_CONTRACT, ATTACKER_CONTRACT, totalAmount),
      buildBatchSettledLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, 1n, totalAmount),
      buildPayoutExecutedLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, RECIP1, totalAmount, 0n),
    ];

    const result = verifySettlementTransaction({
      txHash: '0xmismatch_outbound_tx_hash0000000000000000000000000000000000000000',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'success',
        blockNumber: 1003n,
        gasUsed: 90000n,
        logs,
      } as unknown as TransactionReceipt,
      configuredContractAddress: VERIFIED_CONTRACT,
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: true,
    });

    expect(result.status).toBe('EVIDENCE_MISMATCH');
    expect(result.verificationMessage).toContain('Missing transfer evidence');
  });

  it('Rejects settlement if declared recipientCount mismatches PayoutExecuted events', () => {
    const logs = [
      buildBatchSettledLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, 2n, 1_000_000n), // declares 2
      buildPayoutExecutedLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, RECIP1, 1_000_000n, 0n), // only 1 emitted
    ];

    const result = verifySettlementTransaction({
      txHash: '0xcount_mismatch_tx000000000000000000000000000000000000000000000000',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'success',
        blockNumber: 1004n,
        gasUsed: 75000n,
        logs,
      } as unknown as TransactionReceipt,
      configuredContractAddress: VERIFIED_CONTRACT,
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: true,
    });

    expect(result.status).toBe('EVIDENCE_MISMATCH');
    expect(result.verificationMessage).toContain('Recipient count mismatch');
  });

  it('Rejects settlement if payout indices are non-sequential or duplicate', () => {
    const logs = [
      buildBatchSettledLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, 2n, 2_000_000n),
      buildPayoutExecutedLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, RECIP1, 1_000_000n, 0n),
      buildPayoutExecutedLog(VERIFIED_CONTRACT, PAYER, BATCH_ID, RECIP2, 1_000_000n, 0n), // duplicate index 0
    ];

    const result = verifySettlementTransaction({
      txHash: '0xduplicate_index_tx00000000000000000000000000000000000000000000000',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'success',
        blockNumber: 1005n,
        gasUsed: 80000n,
        logs,
      } as unknown as TransactionReceipt,
      configuredContractAddress: VERIFIED_CONTRACT,
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: true,
    });

    expect(result.status).toBe('EVIDENCE_MISMATCH');
    expect(result.verificationMessage).toContain('Index sequencing error');
  });

  it('Rejects reverted transactions immediately', () => {
    const result = verifySettlementTransaction({
      txHash: '0xreverted_tx000000000000000000000000000000000000000000000000000000',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'reverted',
        blockNumber: 1006n,
        gasUsed: 40000n,
        logs: [],
      } as unknown as TransactionReceipt,
      configuredContractAddress: VERIFIED_CONTRACT,
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: true,
    });

    expect(result.status).toBe('REVERTED');
    expect(result.verificationMessage).toContain('reverted onchain');
  });

  it('Rejects verification when contract address is zero or undeployed', () => {
    const result = verifySettlementTransaction({
      txHash: '0xsome_tx0000000000000000000000000000000000000000000000000000000000',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'success',
        blockNumber: 1007n,
        gasUsed: 50000n,
        logs: [],
      } as unknown as TransactionReceipt,
      configuredContractAddress: '0x0000000000000000000000000000000000000000',
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: false,
    });

    expect(result.status).toBe('UNSUPPORTED');
    expect(result.verificationMessage).toContain('not configured');
  });

  it('Rejects verification when configured contract has no runtime bytecode onchain', () => {
    const result = verifySettlementTransaction({
      txHash: '0xsome_tx0000000000000000000000000000000000000000000000000000000000',
      tx: { chainId: 5042 } as Transaction,
      receipt: {
        status: 'success',
        blockNumber: 1008n,
        gasUsed: 50000n,
        logs: [],
      } as unknown as TransactionReceipt,
      configuredContractAddress: VERIFIED_CONTRACT,
      canonicalUsdcAddress: CANONICAL_USDC,
      hasContractCode: false, // No bytecode!
    });

    expect(result.status).toBe('UNSUPPORTED');
    expect(result.verificationMessage).toContain('has no runtime bytecode on Arc Mainnet');
  });
});
