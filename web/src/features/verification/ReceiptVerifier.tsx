import React, { useState } from 'react';
import { createPublicClient, http, type Hash } from 'viem';
import { arcMainnet } from '../../lib/chain/arcChain';
import { ARC_USDC_ERC20_ADDRESS, BATCH_PAYOUT_ADDRESS, IS_MAINNET_DEPLOYED } from '../../lib/contracts/addresses';
import { formatUsdc } from '../../lib/money/usdc';
import { verifySettlementTransaction, type VerificationResult } from './settlementVerification';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Copy,
  ExternalLink,
  Check,
  ShieldAlert,
} from 'lucide-react';

export type VerifiedSettlementReceipt = VerificationResult;

export const ReceiptVerifier: React.FC = () => {
  const [inputHash, setInputHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [receipt, setReceipt] = useState<VerifiedSettlementReceipt | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Independent public client using Arc mainnet RPC
  const publicClient = createPublicClient({
    chain: arcMainnet,
    transport: http('https://rpc.mainnet.arc.io'),
  });

  const handleVerify = async (hashToVerify?: string) => {
    let rawHash = (hashToVerify || inputHash).trim();
    if (!rawHash) return;

    // Allow 64-character hash without 0x
    if (!rawHash.startsWith('0x') && rawHash.length === 64) {
      rawHash = `0x${rawHash}`;
    }

    if (!rawHash.startsWith('0x') || rawHash.length !== 66) {
      setReceipt({
        status: 'UNSUPPORTED',
        txHash: rawHash,
        items: [],
        tokenTransfersMatched: 0,
        verificationMessage: 'Invalid transaction hash format. Must be a 66-character hex string starting with 0x.',
      });
      return;
    }

    setIsVerifying(true);
    setReceipt(null);

    try {
      // 1. Fetch transaction and receipt from Arc RPC
      let networkErrorMsg: string | null = null;

      const [tx, txReceipt] = await Promise.all([
        publicClient.getTransaction({ hash: rawHash as Hash }).catch((err) => {
          const msg = err?.message || '';
          if (!msg.includes('could not be found') && !msg.includes('not found')) {
            networkErrorMsg = msg || 'Transaction query failed';
          }
          return null;
        }),
        publicClient.getTransactionReceipt({ hash: rawHash as Hash }).catch((err) => {
          const msg = err?.message || '';
          if (!msg.includes('could not be found') && !msg.includes('not found')) {
            networkErrorMsg = msg || 'Receipt query failed';
          }
          return null;
        }),
      ]);

      if (networkErrorMsg && !tx && !txReceipt) {
        setReceipt({
          status: 'ERROR',
          txHash: rawHash,
          items: [],
          tokenTransfersMatched: 0,
          verificationMessage: `Arc JSON-RPC network error: ${networkErrorMsg}. Verification service is temporarily unable to reach Arc Mainnet.`,
        });
        setIsVerifying(false);
        return;
      }

      if (!tx && !txReceipt) {
        setReceipt({
          status: 'NOT_FOUND',
          txHash: rawHash,
          items: [],
          tokenTransfersMatched: 0,
          verificationMessage: 'Transaction was not found on Arc Mainnet (Chain ID 5042). It may still be unindexed, discarded from the mempool, or invalid.',
        });
        setIsVerifying(false);
        return;
      }

      if (!txReceipt) {
        setReceipt({
          status: 'PENDING',
          txHash: rawHash,
          items: [],
          tokenTransfersMatched: 0,
          verificationMessage: 'Transaction is detected in the mempool but has not yet been included in a block receipt.',
        });
        setIsVerifying(false);
        return;
      }

      // Check transaction execution status
      if (txReceipt.status === 'reverted') {
        setReceipt({
          status: 'REVERTED',
          txHash: rawHash,
          blockNumber: txReceipt.blockNumber,
          gasUsed: txReceipt.gasUsed,
          items: [],
          tokenTransfersMatched: 0,
          verificationMessage: 'Transaction execution reverted onchain. No funds were transferred.',
        });
        setIsVerifying(false);
        return;
      }

      // 2. Check bytecode of configured BatchPayout address
      let hasContractCode = false;
      if (IS_MAINNET_DEPLOYED) {
        try {
          const code = await publicClient.getBytecode({ address: BATCH_PAYOUT_ADDRESS });
          hasContractCode = !!code && code !== '0x';
        } catch {
          hasContractCode = false;
        }
      }

      // 3. Fetch block timestamp
      let blockTimestamp: bigint | undefined;
      if (txReceipt.blockNumber) {
        try {
          const block = await publicClient.getBlock({ blockNumber: txReceipt.blockNumber });
          blockTimestamp = block.timestamp;
        } catch {
          // Fallback to undefined
        }
      }

      // 4. Run rigorous settlement verification engine
      const verifiedResult = verifySettlementTransaction({
        txHash: rawHash,
        tx,
        receipt: txReceipt,
        configuredContractAddress: BATCH_PAYOUT_ADDRESS,
        canonicalUsdcAddress: ARC_USDC_ERC20_ADDRESS,
        hasContractCode,
        blockTimestamp,
      });

      setReceipt(verifiedResult);
    } catch (err: any) {
      setReceipt({
        status: 'ERROR',
        txHash: rawHash,
        items: [],
        tokenTransfersMatched: 0,
        verificationMessage: `Verification query error: ${err.message || 'Unable to connect to Arc JSON-RPC'}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const copyReceiptJson = () => {
    if (!receipt) return;
    const exportData = {
      network: 'Arc Mainnet',
      chainId: 5042,
      rpc: 'https://rpc.mainnet.arc.io',
      verificationStatus: receipt.status,
      transactionHash: receipt.txHash,
      blockNumber: receipt.blockNumber?.toString(),
      settlementContract: receipt.contractAddress,
      payer: receipt.payer,
      batchId: receipt.batchId,
      referenceCommitment: receipt.referenceCommitment,
      totalTransferredBaseUnits: receipt.totalTransferred?.toString(),
      totalTransferredFormatted: receipt.totalTransferred ? formatUsdc(receipt.totalTransferred) : '0',
      recipientCount: receipt.recipientCount,
      payments: receipt.items.map((it) => ({
        index: it.index,
        recipient: it.recipient,
        amountBaseUnits: it.amount.toString(),
        amountFormatted: formatUsdc(it.amount),
      })),
      gasUsed: receipt.gasUsed?.toString(),
      gasFeeUsdc: receipt.actualGasFeeUsdc,
      timestamp: receipt.timestamp,
    };

    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6 pb-6 border-b border-[#E4E7EC]">
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Public Settlement Verifier</h1>
        <p className="text-sm text-[#475467] mt-1">
          Independently verify any Arc Mainnet payout transaction receipt directly against the blockchain without connecting a wallet.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="bg-white border border-[#E4E7EC] rounded p-4 shadow-sm mb-6">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Arc Mainnet Transaction Hash
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputHash}
              onChange={(e) => setInputHash(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded focus:border-slate-800 outline-none"
            />
          </div>
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying || !inputHash.trim()}
            className="flex items-center justify-center space-x-1.5 px-5 py-2 rounded text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isVerifying ? 'Auditing RPC...' : 'Verify Receipt'}</span>
          </button>
        </div>
      </div>

      {/* Verification Result Display */}
      {receipt && (
        <div className="bg-white border border-[#E4E7EC] rounded shadow-sm overflow-hidden text-xs">
          {/* Top Banner Status */}
          <div
            className={`p-4 border-b flex items-start justify-between gap-4 ${
              receipt.status === 'VERIFIED_SETTLEMENT'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : receipt.status === 'PENDING'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-950'
                : receipt.status === 'REVERTED' || receipt.status === 'EVIDENCE_MISMATCH'
                ? 'bg-red-50 border-red-200 text-red-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start space-x-3">
              {receipt.status === 'VERIFIED_SETTLEMENT' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              )}
              {receipt.status === 'PENDING' && (
                <Clock className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              )}
              {receipt.status === 'REVERTED' && (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              {receipt.status === 'EVIDENCE_MISMATCH' && (
                <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              {(receipt.status === 'NOT_FOUND' || receipt.status === 'UNSUPPORTED' || receipt.status === 'ERROR') && (
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <span className="font-bold text-sm block tracking-tight">
                  {receipt.status.replace(/_/g, ' ')}
                </span>
                <p className="text-xs opacity-90 mt-0.5">{receipt.verificationMessage}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={copyReceiptJson}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                title="Copy machine-readable JSON receipt"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? 'Copied' : 'Export JSON'}</span>
              </button>
              <a
                href={`https://explorer.arc.io/tx/${receipt.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700"
                title="View on Arc Explorer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Key Facts Matrix */}
          {receipt.status === 'VERIFIED_SETTLEMENT' && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded border border-slate-200">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                    Total Settled
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {formatUsdc(receipt.totalTransferred || 0n)} USDC
                  </span>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                    Recipients Paid
                  </span>
                  <span className="text-lg font-bold text-slate-900">{receipt.recipientCount}</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                    Block Number
                  </span>
                  <span className="text-sm font-mono font-semibold text-slate-900">
                    #{receipt.blockNumber?.toString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                    Network Fee
                  </span>
                  <span className="text-sm font-mono text-slate-700">{receipt.actualGasFeeUsdc} USDC</span>
                </div>
              </div>

              {/* Cryptographic Proof Identifiers */}
              <div className="space-y-2 border border-slate-200 rounded p-4 bg-white">
                <span className="font-bold text-slate-900 block text-xs">Onchain Settlement Proofs</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Payer Address:</span>
                    <span className="font-mono text-slate-900 break-all">{receipt.payer}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Settlement Contract:</span>
                    <span className="font-mono text-slate-900 break-all">{receipt.contractAddress}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Scoped Batch Identifier:</span>
                    <span className="font-mono text-slate-900 break-all">{receipt.batchId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Reference Commitment:</span>
                    <span className="font-mono text-slate-900 break-all">{receipt.referenceCommitment}</span>
                  </div>
                </div>
              </div>

              {/* Verified Payout Line Items */}
              <div>
                <span className="font-bold text-slate-900 block text-xs mb-2">
                  Verified Payment Dispersals ({receipt.items.length})
                </span>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                        <th className="py-2 px-3 w-10 text-center">#</th>
                        <th className="py-2 px-3">Recipient</th>
                        <th className="py-2 px-3 text-right">Settled Amount</th>
                        <th className="py-2 px-3 w-28 text-center">Event Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {receipt.items.map((it) => (
                        <tr key={it.index} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-center text-slate-400">{it.index + 1}</td>
                          <td className="py-2 px-3 text-slate-900">{it.recipient}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900 tabular-nums">
                            {formatUsdc(it.amount)} USDC
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-emerald-100 text-emerald-800">
                              ✓ Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
