import { decodeEventLog, type TransactionReceipt, type Transaction } from 'viem';
import { batchPayoutAbi } from '../../lib/contracts/batchPayoutAbi';
import { erc20Abi } from '../../lib/contracts/erc20Abi';
import { formatUsdc } from '../../lib/money/usdc';

export interface PayoutItem {
  payer: string;
  batchId: string;
  recipient: string;
  amount: bigint;
  index: number;
}

export type VerificationStatus =
  | 'VERIFIED_SETTLEMENT'
  | 'REVERTED'
  | 'PENDING'
  | 'NOT_FOUND'
  | 'UNSUPPORTED'
  | 'EVIDENCE_MISMATCH'
  | 'ERROR';

export interface VerificationResult {
  status: VerificationStatus;
  txHash: string;
  blockNumber?: bigint;
  contractAddress?: string;
  payer?: string;
  batchId?: string;
  referenceCommitment?: string;
  recipientCount?: number;
  totalTransferred?: bigint;
  actualGasFeeUsdc?: string;
  effectiveGasPrice?: bigint;
  gasUsed?: bigint;
  items: PayoutItem[];
  tokenTransfersMatched: number;
  timestamp?: string;
  verificationMessage: string;
}

export interface VerificationParams {
  txHash: string;
  tx: Transaction | null;
  receipt: TransactionReceipt | null;
  configuredContractAddress: string;
  canonicalUsdcAddress: string;
  hasContractCode: boolean;
  blockTimestamp?: bigint;
}

/**
 * Pure, cryptographically rigorous verification engine for Pariter settlement transactions.
 * Enforces strict emitter address checks, event consistency, index integrity, and canonical
 * ERC-20 USDC transfer matching.
 */
export function verifySettlementTransaction(params: VerificationParams): VerificationResult {
  const {
    txHash,
    tx,
    receipt,
    configuredContractAddress,
    canonicalUsdcAddress,
    hasContractCode,
    blockTimestamp,
  } = params;

  const targetContract = configuredContractAddress.toLowerCase();
  const canonicalUsdc = canonicalUsdcAddress.toLowerCase();

  // 1. Transaction presence & execution status
  if (!receipt) {
    if (tx) {
      return {
        status: 'PENDING',
        txHash,
        items: [],
        tokenTransfersMatched: 0,
        verificationMessage: 'Transaction is detected in the mempool but has not yet been included in a mined block.',
      };
    }
    return {
      status: 'NOT_FOUND',
      txHash,
      items: [],
      tokenTransfersMatched: 0,
      verificationMessage: 'Transaction was not found on Arc Mainnet (Chain ID 5042). It may still be unindexed, dropped, or invalid.',
    };
  }

  if (receipt.status === 'reverted') {
    return {
      status: 'REVERTED',
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      items: [],
      tokenTransfersMatched: 0,
      verificationMessage: 'Transaction execution reverted onchain. All state changes were rolled back and no funds were transferred.',
    };
  }

  // 2. Verified deployed contract check
  if (!configuredContractAddress || targetContract === '0x0000000000000000000000000000000000000000') {
    return {
      status: 'UNSUPPORTED',
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      items: [],
      tokenTransfersMatched: 0,
      verificationMessage: 'BatchPayout settlement contract address is not configured. Verification requires a genuine deployed contract coordinate.',
    };
  }

  if (!hasContractCode) {
    return {
      status: 'UNSUPPORTED',
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      items: [],
      tokenTransfersMatched: 0,
      verificationMessage: `Configured contract address (${configuredContractAddress}) has no runtime bytecode on Arc Mainnet.`,
    };
  }

  // 3. Extract and filter logs strictly by emitter contract address
  let batchSettledEvent: {
    payer: string;
    batchId: string;
    referenceCommitment: string;
    recipientCount: bigint;
    totalTransferred: bigint;
  } | null = null;

  const payoutEvents: PayoutItem[] = [];
  const erc20Transfers: Array<{ from: string; to: string; value: bigint }> = [];

  for (const log of receipt.logs) {
    const emitter = log.address.toLowerCase();

    // Check Pariter contract events (MUST match verified contract address)
    if (emitter === targetContract) {
      try {
        const decoded = decodeEventLog({
          abi: batchPayoutAbi,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === 'BatchSettled') {
          if (batchSettledEvent) {
            return {
              status: 'EVIDENCE_MISMATCH',
              txHash,
              blockNumber: receipt.blockNumber,
              items: [],
              tokenTransfersMatched: 0,
              verificationMessage: 'Anomalous transaction: Multiple BatchSettled events emitted in a single transaction.',
            };
          }
          batchSettledEvent = {
            payer: (decoded.args as any).payer,
            batchId: (decoded.args as any).batchId,
            referenceCommitment: (decoded.args as any).referenceCommitment,
            recipientCount: (decoded.args as any).recipientCount,
            totalTransferred: (decoded.args as any).totalTransferred,
          };
        } else if (decoded.eventName === 'PayoutExecuted') {
          payoutEvents.push({
            payer: (decoded.args as any).payer,
            batchId: (decoded.args as any).batchId,
            recipient: (decoded.args as any).recipient,
            amount: (decoded.args as any).amount,
            index: Number((decoded.args as any).index),
          });
        }
      } catch {
        // Unknown event from target contract
      }
    }

    // Check canonical USDC ERC-20 transfers (MUST match canonical USDC precompile)
    if (emitter === canonicalUsdc) {
      try {
        const decodedErc20 = decodeEventLog({
          abi: erc20Abi,
          data: log.data,
          topics: log.topics,
        });

        if (decodedErc20.eventName === 'Transfer') {
          erc20Transfers.push({
            from: (decodedErc20.args as any).from.toLowerCase(),
            to: (decodedErc20.args as any).to.toLowerCase(),
            value: (decodedErc20.args as any).value,
          });
        }
      } catch {
        // Not a standard Transfer event
      }
    }
  }

  // 4. Require valid BatchSettled event from verified contract
  if (!batchSettledEvent) {
    return {
      status: 'UNSUPPORTED',
      txHash,
      blockNumber: receipt.blockNumber,
      contractAddress: receipt.to || undefined,
      gasUsed: receipt.gasUsed,
      items: [],
      tokenTransfersMatched: erc20Transfers.length,
      verificationMessage: `Transaction did not emit a valid BatchSettled event from the verified Pariter contract (${configuredContractAddress}).`,
    };
  }

  const expectedCount = Number(batchSettledEvent.recipientCount);

  // 5. Verify recipient count consistency
  if (payoutEvents.length !== expectedCount || expectedCount === 0) {
    return {
      status: 'EVIDENCE_MISMATCH',
      txHash,
      blockNumber: receipt.blockNumber,
      contractAddress: targetContract,
      payer: batchSettledEvent.payer,
      batchId: batchSettledEvent.batchId,
      items: payoutEvents,
      tokenTransfersMatched: erc20Transfers.length,
      verificationMessage: `Recipient count mismatch: BatchSettled declared ${expectedCount} payouts, but ${payoutEvents.length} PayoutExecuted events were emitted.`,
    };
  }

  // 6. Sort and verify sequential index integrity (0..N-1)
  payoutEvents.sort((a, b) => a.index - b.index);
  for (let i = 0; i < payoutEvents.length; i++) {
    if (payoutEvents[i].index !== i) {
      return {
        status: 'EVIDENCE_MISMATCH',
        txHash,
        blockNumber: receipt.blockNumber,
        contractAddress: targetContract,
        payer: batchSettledEvent.payer,
        batchId: batchSettledEvent.batchId,
        items: payoutEvents,
        tokenTransfersMatched: erc20Transfers.length,
        verificationMessage: `Index sequencing error: Expected payout index ${i}, but found index ${payoutEvents[i].index}.`,
      };
    }
  }

  // 7. Verify consistent payer and batchId across every PayoutExecuted event
  for (const payout of payoutEvents) {
    if (payout.payer.toLowerCase() !== batchSettledEvent.payer.toLowerCase()) {
      return {
        status: 'EVIDENCE_MISMATCH',
        txHash,
        blockNumber: receipt.blockNumber,
        contractAddress: targetContract,
        payer: batchSettledEvent.payer,
        batchId: batchSettledEvent.batchId,
        items: payoutEvents,
        tokenTransfersMatched: erc20Transfers.length,
        verificationMessage: `Payer mismatch in payout event: BatchSettled payer (${batchSettledEvent.payer}) does not match PayoutExecuted payer (${payout.payer}) at index ${payout.index}.`,
      };
    }

    if (payout.batchId.toLowerCase() !== batchSettledEvent.batchId.toLowerCase()) {
      return {
        status: 'EVIDENCE_MISMATCH',
        txHash,
        blockNumber: receipt.blockNumber,
        contractAddress: targetContract,
        payer: batchSettledEvent.payer,
        batchId: batchSettledEvent.batchId,
        items: payoutEvents,
        tokenTransfersMatched: erc20Transfers.length,
        verificationMessage: `Batch ID mismatch in payout event: BatchSettled batchId (${batchSettledEvent.batchId}) does not match PayoutExecuted batchId (${payout.batchId}) at index ${payout.index}.`,
      };
    }
  }

  // 8. Verify sum of payout amounts matches BatchSettled totalTransferred
  const sumAmounts = payoutEvents.reduce((acc, p) => acc + p.amount, 0n);
  if (sumAmounts !== batchSettledEvent.totalTransferred) {
    return {
      status: 'EVIDENCE_MISMATCH',
      txHash,
      blockNumber: receipt.blockNumber,
      contractAddress: targetContract,
      payer: batchSettledEvent.payer,
      batchId: batchSettledEvent.batchId,
      items: payoutEvents,
      tokenTransfersMatched: erc20Transfers.length,
      verificationMessage: `Total amount mismatch: Sum of payouts (${formatUsdc(sumAmounts)}) does not equal declared totalTransferred (${formatUsdc(batchSettledEvent.totalTransferred)}).`,
    };
  }

  // 9. Reconcile canonical USDC ERC-20 transfers
  // Must have inbound transfer from payer to BatchPayout contract
  const payerAddr = batchSettledEvent.payer.toLowerCase();
  const inboundTransfer = erc20Transfers.find(
    (t) => t.from === payerAddr && t.to === targetContract && t.value === batchSettledEvent!.totalTransferred
  );

  if (!inboundTransfer) {
    return {
      status: 'EVIDENCE_MISMATCH',
      txHash,
      blockNumber: receipt.blockNumber,
      contractAddress: targetContract,
      payer: batchSettledEvent.payer,
      batchId: batchSettledEvent.batchId,
      items: payoutEvents,
      tokenTransfersMatched: erc20Transfers.length,
      verificationMessage: `Missing canonical USDC transfer: Contract did not pull ${formatUsdc(batchSettledEvent.totalTransferred)} USDC from payer ${batchSettledEvent.payer}.`,
    };
  }

  // Each individual payout must match an outbound transfer from contract to recipient
  let matchedOutboundCount = 0;
  const remainingOutbound = erc20Transfers.filter(
    (t) => t !== inboundTransfer && t.from === targetContract
  );

  for (const payout of payoutEvents) {
    const targetRecipient = payout.recipient.toLowerCase();
    const matchIdx = remainingOutbound.findIndex(
      (t) => t.to === targetRecipient && t.value === payout.amount
    );

    if (matchIdx === -1) {
      return {
        status: 'EVIDENCE_MISMATCH',
        txHash,
        blockNumber: receipt.blockNumber,
        contractAddress: targetContract,
        payer: batchSettledEvent.payer,
        batchId: batchSettledEvent.batchId,
        items: payoutEvents,
        tokenTransfersMatched: erc20Transfers.length,
        verificationMessage: `Missing transfer evidence: No canonical USDC transfer found from contract to recipient ${payout.recipient} for ${formatUsdc(payout.amount)} USDC.`,
      };
    }

    remainingOutbound.splice(matchIdx, 1);
    matchedOutboundCount++;
  }

  // 10. Fee and timestamp calculations
  const effectiveGasPrice = receipt.effectiveGasPrice ?? 0n;
  const gasFeeWei = receipt.gasUsed * effectiveGasPrice;
  const feeUsdc = Number(gasFeeWei) / 1e18;
  const feeFormatted = feeUsdc > 0 ? feeUsdc.toFixed(6) : '< 0.000001';

  let timestampStr = 'Confirmed onchain';
  if (blockTimestamp) {
    timestampStr = new Date(Number(blockTimestamp) * 1000).toUTCString();
  }

  return {
    status: 'VERIFIED_SETTLEMENT',
    txHash,
    blockNumber: receipt.blockNumber,
    contractAddress: configuredContractAddress,
    payer: batchSettledEvent.payer,
    batchId: batchSettledEvent.batchId,
    referenceCommitment: batchSettledEvent.referenceCommitment,
    recipientCount: expectedCount,
    totalTransferred: batchSettledEvent.totalTransferred,
    actualGasFeeUsdc: feeFormatted,
    effectiveGasPrice,
    gasUsed: receipt.gasUsed,
    items: payoutEvents,
    tokenTransfersMatched: matchedOutboundCount + 1, // inbound + outbounds
    timestamp: timestampStr,
    verificationMessage: `Cryptographically verified on Arc Mainnet. Reconciled ${payoutEvents.length} payments totaling ${formatUsdc(batchSettledEvent.totalTransferred)} USDC with matching canonical ERC-20 transfers.`,
  };
}
