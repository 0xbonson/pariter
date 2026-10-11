import React, { useState, useEffect, useMemo } from 'react';
import { createPublicClient, http, type Hash } from 'viem';
import { arcMainnet } from '../../lib/chain/arcChain';
import {
  ARC_USDC_ERC20_ADDRESS,
  BATCH_PAYOUT_ADDRESS,
  IS_MAINNET_DEPLOYED,
  EXPECTED_BATCH_PAYOUT_RUNTIME_CODEHASH,
} from '../../lib/contracts/addresses';
import { formatUsdc } from '../../lib/money/usdc';
import {
  verifySettlementTransaction,
  reconcileSettlementWithIntended,
  SETTLEMENT_LEGAL_DISCLAIMER,
  type VerificationResult,
} from './settlementVerification';
import { parseRecipientText } from '../payouts/batchParser';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Check,
  ShieldAlert,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  Link2,
  Info,
} from 'lucide-react';

export type VerifiedSettlementReceipt = VerificationResult;

export const ReceiptVerifier: React.FC = () => {
  const [inputHash, setInputHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [receipt, setReceipt] = useState<VerifiedSettlementReceipt | null>(null);

  // Copy & export feedback states
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Intended CSV reconciliation state
  const [showIntendedCsv, setShowIntendedCsv] = useState(false);
  const [intendedCsvInput, setIntendedCsvInput] = useState('');
  const [intendedCsvError, setIntendedCsvError] = useState<string | null>(null);
  const [intendedList, setIntendedList] = useState<
    Array<{ address: string; amount: string; memo?: string }> | null
  >(null);

  // Active view tab for verified receipt results
  const [activeTab, setActiveTab] = useState<'onchain' | 'reconciliation'>('onchain');

  // Independent public client using Arc mainnet RPC
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: arcMainnet,
        transport: http('https://rpc.mainnet.arc.io'),
      }),
    []
  );

  // Deep linking: read ?tx= from URL search params on mount
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const txParam = urlParams.get('tx');
      if (txParam) {
        setInputHash(txParam);
        handleVerify(txParam);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  const handleVerify = async (hashToVerify?: string, customIntended?: Array<{ address: string; amount: string; memo?: string }>) => {
    let rawHash = (hashToVerify || inputHash).trim();
    if (!rawHash) return;

    // Allow 64-character hash without 0x
    if (!rawHash.startsWith('0x') && rawHash.length === 64) {
      rawHash = `0x${rawHash}`;
    }

    if (!rawHash.startsWith('0x') || rawHash.length !== 66) {
      setReceipt({
        status: 'UNSUPPORTED',
        onchainStatus: 'UNSUPPORTED',
        txHash: rawHash,
        items: [],
        tokenTransfersMatched: 0,
        verificationMessage: 'Invalid transaction hash format. Must be a 66-character hex string starting with 0x.',
      });
      return;
    }

    setIsVerifying(true);
    setReceipt(null);

    const activeIntended = customIntended !== undefined ? customIntended : intendedList;

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
          onchainStatus: 'ERROR',
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
          onchainStatus: 'NOT_FOUND',
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
          onchainStatus: 'PENDING',
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
          onchainStatus: 'REVERTED',
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

      // 2. Fetch runtime bytecode of configured BatchPayout address
      let contractBytecode: string | undefined = undefined;
      let hasContractCode = false;
      if (IS_MAINNET_DEPLOYED) {
        try {
          const code = await publicClient.getBytecode({ address: BATCH_PAYOUT_ADDRESS });
          if (code && code !== '0x') {
            hasContractCode = true;
            contractBytecode = code;
          }
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

      // 4. Run rigorous settlement verification and optional reconciliation engine
      const verifiedResult = verifySettlementTransaction({
        txHash: rawHash,
        tx,
        receipt: txReceipt,
        configuredContractAddress: BATCH_PAYOUT_ADDRESS,
        canonicalUsdcAddress: ARC_USDC_ERC20_ADDRESS,
        hasContractCode,
        contractBytecode,
        expectedRuntimeCodehash: EXPECTED_BATCH_PAYOUT_RUNTIME_CODEHASH,
        blockTimestamp,
        intendedList: activeIntended || undefined,
      });

      setReceipt(verifiedResult);
      if (verifiedResult.reconciliation?.hasIntendedList) {
        setActiveTab('reconciliation');
      }
    } catch (err: any) {
      setReceipt({
        status: 'ERROR',
        onchainStatus: 'ERROR',
        txHash: rawHash,
        items: [],
        tokenTransfersMatched: 0,
        verificationMessage: `Verification query error: ${err.message || 'Unable to connect to Arc JSON-RPC'}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle parsing and applying intended CSV
  const handleApplyIntendedCsv = () => {
    setIntendedCsvError(null);
    if (!intendedCsvInput.trim()) {
      setIntendedList(null);
      if (receipt && receipt.status === 'VERIFIED_SETTLEMENT') {
        const reconciliation = reconcileSettlementWithIntended(receipt.items, undefined);
        setReceipt({
          ...receipt,
          reconciliation,
          reconciliationStatus: reconciliation.status,
        });
      }
      return;
    }

    const parseResult = parseRecipientText(intendedCsvInput);
    if (parseResult.error) {
      setIntendedCsvError(parseResult.error);
      return;
    }

    const intended = parseResult.rows.map((r) => ({
      address: r.address,
      amount: r.amount,
      memo: r.memo,
    }));

    setIntendedList(intended);
    setActiveTab('reconciliation');

    // If receipt is already loaded, update reconciliation immediately
    if (receipt && receipt.status === 'VERIFIED_SETTLEMENT') {
      const reconciliation = reconcileSettlementWithIntended(receipt.items, intended);
      setReceipt({
        ...receipt,
        reconciliation,
        reconciliationStatus: reconciliation.status,
      });
    } else if (inputHash.trim()) {
      handleVerify(inputHash, intended);
    }
  };

  const handleClearIntendedCsv = () => {
    setIntendedCsvInput('');
    setIntendedList(null);
    setIntendedCsvError(null);
    if (receipt && receipt.status === 'VERIFIED_SETTLEMENT') {
      const reconciliation = reconcileSettlementWithIntended(receipt.items, undefined);
      setReceipt({
        ...receipt,
        reconciliation,
        reconciliationStatus: reconciliation.status,
      });
      setActiveTab('onchain');
    }
  };

  // Export full JSON Proof Pack Bundle
  const downloadProofPackJson = () => {
    if (!receipt) return;
    const proofPack = {
      proofPackVersion: '1.0.0',
      generator: 'Pariter Public Settlement Verifier (Arc Mainnet)',
      generatedAt: new Date().toISOString(),
      network: {
        name: 'Arc Mainnet',
        chainId: 5042,
        rpc: 'https://rpc.mainnet.arc.io',
        contractAddress: receipt.contractAddress,
        canonicalUsdc: ARC_USDC_ERC20_ADDRESS,
      },
      onchainVerification: {
        status: receipt.onchainStatus,
        transactionHash: receipt.txHash,
        blockNumber: receipt.blockNumber?.toString(),
        payer: receipt.payer,
        batchId: receipt.batchId,
        referenceCommitment: receipt.referenceCommitment,
        bytecodeVerified: receipt.bytecodeVerified,
        actualBytecodeHash: receipt.actualBytecodeHash,
        totalTransferredBaseUnits: receipt.totalTransferred?.toString(),
        totalTransferredFormatted: receipt.totalTransferred ? formatUsdc(receipt.totalTransferred) : '0',
        recipientCount: receipt.recipientCount,
        gasUsed: receipt.gasUsed?.toString(),
        gasFeeUsdc: receipt.actualGasFeeUsdc,
        timestamp: receipt.timestamp,
        items: receipt.items.map((it) => ({
          index: it.index,
          recipient: it.recipient,
          amountBaseUnits: it.amount.toString(),
          amountFormatted: formatUsdc(it.amount),
        })),
      },
      reconciliation: receipt.reconciliation
        ? {
            status: receipt.reconciliation.status,
            hasIntendedList: receipt.reconciliation.hasIntendedList,
            intendedRecipientCount: receipt.reconciliation.intendedRecipientCount,
            onchainRecipientCount: receipt.reconciliation.onchainRecipientCount,
            matchedRecipientCount: receipt.reconciliation.matchedRecipientCount,
            discrepancyCount: receipt.reconciliation.discrepancyCount,
            totalIntendedBaseUnits: receipt.reconciliation.totalIntendedBaseUnits.toString(),
            totalIntendedFormatted: formatUsdc(receipt.reconciliation.totalIntendedBaseUnits),
            totalOnchainBaseUnits: receipt.reconciliation.totalOnchainBaseUnits.toString(),
            totalOnchainFormatted: formatUsdc(receipt.reconciliation.totalOnchainBaseUnits),
            items: receipt.reconciliation.items.map((item) => ({
              index: item.index,
              recipient: item.recipient,
              intendedAmount: item.intendedAmount,
              onchainAmount: item.onchainAmount,
              status: item.status,
              memo: item.memo,
              details: item.details,
            })),
          }
        : null,
      disclaimer: SETTLEMENT_LEGAL_DISCLAIMER,
    };

    const jsonBlob = new Blob([JSON.stringify(proofPack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pariter-proof-pack-${receipt.txHash.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Export CSV Reconciliation Report
  const downloadReconciliationCsv = () => {
    if (!receipt) return;
    const items = receipt.reconciliation?.items || receipt.items.map((it) => ({
      index: it.index,
      recipient: it.recipient,
      intendedAmount: '',
      onchainAmount: formatUsdc(it.amount),
      status: 'MATCH',
      details: 'Onchain verified payment item',
      memo: '',
    }));

    const rows = [
      ['Index', 'Recipient', 'IntendedAmountUSDC', 'OnchainAmountUSDC', 'Status', 'Details', 'Memo'],
      ...items.map((it) => [
        (it.index + 1).toString(),
        it.recipient,
        it.intendedAmount || '',
        it.onchainAmount || '',
        it.status,
        `"${(it.details || '').replace(/"/g, '""')}"`,
        `"${(it.memo || '').replace(/"/g, '""')}"`,
      ]),
    ];

    const csvContent = rows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pariter-reconciliation-${receipt.txHash.slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  // Copy shareable transaction verification link (TX hash ONLY; never leaks offchain recipient data or CSV)
  const copyShareableLink = () => {
    if (!receipt) return;
    const base = window.location.origin + window.location.pathname;
    const shareableUrl = `${base}?tx=${receipt.txHash}`;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6 pb-6 border-b border-[#E4E7EC]">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-slate-800" />
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Public Settlement Verifier</h1>
        </div>
        <p className="text-sm text-[#475467] mt-1">
          Independently verify any Arc Mainnet payout transaction receipt directly against the blockchain without connecting a wallet.
          Optionally upload an intended payout list to generate an audit-ready reconciliation Proof Pack.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="bg-white border border-[#E4E7EC] rounded p-4 shadow-sm mb-4">
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

        {/* Intended CSV Reconciliation Accordion Toggle */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowIntendedCsv(!showIntendedCsv)}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1 font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>
              {showIntendedCsv
                ? 'Hide Intended List Reconciliation'
                : intendedList
                ? `Intended List Loaded (${intendedList.length} items) — Click to view`
                : 'Optional: Compare against Intended Payout CSV (Reconciliation)'}
            </span>
          </button>
          {intendedList && (
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {intendedList.length} Intended Items
            </span>
          )}
        </div>

        {/* Collapsible Intended CSV Input Section */}
        {showIntendedCsv && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-semibold text-slate-900 block text-xs">
                  Intended Recipient List (CSV / Tab-Separated)
                </span>
                <p className="text-[11px] text-slate-500">
                  Paste or import your original contributor list (<code className="font-mono">address, amount, [memo]</code>).
                  Pariter matches line items 1-to-1 in base units to confirm offchain intention against onchain settlement.
                </p>
              </div>
            </div>
            <textarea
              rows={4}
              value={intendedCsvInput}
              onChange={(e) => setIntendedCsvInput(e.target.value)}
              placeholder="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 100.00, Core grant&#10;0x1234567890123456789012345678901234567890, 50.25, Bounty payout"
              className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded bg-white outline-none focus:border-slate-800"
            />
            {intendedCsvError && (
              <p className="text-xs text-red-600 font-medium">{intendedCsvError}</p>
            )}
            <div className="flex items-center justify-end space-x-2 pt-1">
              {intendedList && (
                <button
                  type="button"
                  onClick={handleClearIntendedCsv}
                  className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded font-semibold"
                >
                  Clear Intended List
                </button>
              )}
              <button
                type="button"
                onClick={handleApplyIntendedCsv}
                className="px-3.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800"
              >
                Apply & Reconcile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Verification Result Display */}
      {receipt && (
        <div className="bg-white border border-[#E4E7EC] rounded shadow-sm overflow-hidden text-xs">
          {/* Top Status Banner with Dual Badges */}
          <div
            className={`p-4 border-b flex flex-col md:flex-row md:items-start justify-between gap-4 ${
              receipt.onchainStatus === 'ONCHAIN_VERIFIED'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : receipt.onchainStatus === 'PENDING'
                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                : receipt.onchainStatus === 'REVERTED' ||
                  receipt.onchainStatus === 'EVIDENCE_MISMATCH' ||
                  receipt.onchainStatus === 'BYTECODE_MISMATCH'
                ? 'bg-red-50/70 border-red-200 text-red-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start space-x-3">
              {receipt.onchainStatus === 'ONCHAIN_VERIFIED' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              )}
              {receipt.onchainStatus === 'PENDING' && (
                <Clock className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              )}
              {receipt.onchainStatus === 'REVERTED' && (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              {(receipt.onchainStatus === 'EVIDENCE_MISMATCH' || receipt.onchainStatus === 'BYTECODE_MISMATCH') && (
                <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              {(receipt.onchainStatus === 'NOT_FOUND' ||
                receipt.onchainStatus === 'UNSUPPORTED' ||
                receipt.onchainStatus === 'ERROR') && (
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="space-y-1.5">
                {/* Dual Badge Presentation */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border ${
                      receipt.onchainStatus === 'ONCHAIN_VERIFIED'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-red-100 text-red-900 border-red-300'
                    }`}
                  >
                    Onchain: {receipt.onchainStatus.replace(/_/g, ' ')}
                  </span>

                  {/* Orthogonal Reconciliation Badge */}
                  {receipt.reconciliation && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border ${
                        receipt.reconciliation.status === 'INTENDED_PAYOUT_RECONCILED'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : receipt.reconciliation.status === 'RECONCILIATION_MISMATCH'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      Reconciliation: {receipt.reconciliation.status.replace(/_/g, ' ')}
                    </span>
                  )}

                  {receipt.bytecodeVerified && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-700">
                      Bytecode Verified (cancun 0.8.37)
                    </span>
                  )}
                </div>

                <p className="text-xs opacity-90">{receipt.verificationMessage}</p>

                {receipt.reconciliation?.hasIntendedList && (
                  <p className="text-xs font-medium text-slate-700">
                    {receipt.reconciliation.message}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons: Proof Pack Export & Share */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 md:pt-0">
              <button
                onClick={copyShareableLink}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                title="Copy shareable link with transaction hash"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
              </button>

              <button
                onClick={downloadProofPackJson}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                title="Download complete JSON Proof Pack bundle"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
                <span>Proof Pack (.json)</span>
              </button>

              <button
                onClick={downloadReconciliationCsv}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                title="Export reconciliation audit table to CSV"
              >
                {copiedCsv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                <span>CSV Report</span>
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
          {receipt.onchainStatus === 'ONCHAIN_VERIFIED' && (
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
                <span className="font-bold text-slate-900 block text-xs">Onchain Cryptographic Proofs</span>
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
                  {receipt.actualBytecodeHash && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 block">Runtime Bytecode Hash (Keccak256):</span>
                      <span className="font-mono text-slate-900 break-all">{receipt.actualBytecodeHash}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* View Switcher: Onchain Ledger vs Reconciliation */}
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 mb-3">
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActiveTab('onchain')}
                      className={`pb-2 text-xs font-semibold border-b-2 transition-colors ${
                        activeTab === 'onchain'
                          ? 'border-slate-900 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Onchain Settlement Ledger ({receipt.items.length})
                    </button>
                    {receipt.reconciliation?.hasIntendedList && (
                      <button
                        onClick={() => setActiveTab('reconciliation')}
                        className={`pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
                          activeTab === 'reconciliation'
                            ? 'border-slate-900 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <span>CSV Reconciliation Audit</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] ${
                            receipt.reconciliation.discrepancyCount === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {receipt.reconciliation.matchedRecipientCount} / {receipt.reconciliation.intendedRecipientCount} matched
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab 1: Pure Onchain Payout Line Items */}
                {activeTab === 'onchain' && (
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
                )}

                {/* Tab 2: Offchain Intended CSV Reconciliation Table */}
                {activeTab === 'reconciliation' && receipt.reconciliation && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded flex flex-wrap items-center justify-between text-xs gap-2">
                      <div className="flex items-center space-x-4">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Intended Total</span>
                          <span className="font-mono font-semibold text-slate-900">
                            {formatUsdc(receipt.reconciliation.totalIntendedBaseUnits)} USDC
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block">Settled Total</span>
                          <span className="font-mono font-semibold text-slate-900">
                            {formatUsdc(receipt.reconciliation.totalOnchainBaseUnits)} USDC
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block">Discrepancies</span>
                          <span
                            className={`font-semibold ${
                              receipt.reconciliation.discrepancyCount === 0
                                ? 'text-emerald-700'
                                : 'text-red-600'
                            }`}
                          >
                            {receipt.reconciliation.discrepancyCount}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Exact 1-to-1 integer base unit comparison (6 decimals)
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                            <th className="py-2 px-3 w-10 text-center">#</th>
                            <th className="py-2 px-3">Recipient</th>
                            <th className="py-2 px-3 text-right">Intended</th>
                            <th className="py-2 px-3 text-right">Settled</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Details / Memo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {receipt.reconciliation.items.map((row) => (
                            <tr key={row.index} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 text-center text-slate-400 font-mono">
                                {row.index + 1}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-900 break-all">
                                {row.recipient}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                                {row.intendedAmount ? `${row.intendedAmount} USDC` : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                {row.onchainAmount ? `${row.onchainAmount} USDC` : '—'}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    row.status === 'MATCH'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : row.status === 'MISMATCH'
                                      ? 'bg-red-100 text-red-800'
                                      : row.status === 'INTENDED_ONLY'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {row.status === 'MATCH' && '✓ MATCH'}
                                  {row.status === 'MISMATCH' && '⚠ AMOUNT MISMATCH'}
                                  {row.status === 'INTENDED_ONLY' && 'MISSING ONCHAIN'}
                                  {row.status === 'ONCHAIN_ONLY' && 'EXTRA ONCHAIN'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-[11px] text-slate-600">
                                {row.memo && (
                                  <span className="font-semibold text-slate-800 block">
                                    {row.memo}
                                  </span>
                                )}
                                <span>{row.details}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Legal & Factual Disclaimer */}
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-start space-x-2">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p>{SETTLEMENT_LEGAL_DISCLAIMER}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
