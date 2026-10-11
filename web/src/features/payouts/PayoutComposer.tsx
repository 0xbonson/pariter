import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useAccount, useReadContract, useBalance, useConnect } from 'wagmi';
import { Plus, Trash2, AlertCircle, AlertTriangle, ArrowRight, Upload, Info, Wallet } from 'lucide-react';
import {
  parseUsdc,
  formatUsdc,
  sumAmounts,
  validateRecipientAddress,
} from '../../lib/money/usdc';
import { ARC_USDC_ERC20_ADDRESS, ARC_CHAIN_ID, IS_MAINNET_DEPLOYED, MAX_BATCH_RECIPIENTS } from '../../lib/contracts/addresses';
import { erc20Abi } from '../../lib/contracts/erc20Abi';
import { BatchReviewModal } from './BatchReviewModal';
import { parseRecipientText } from './batchParser';
import { formatWalletErrorMessage } from '../../lib/chain/walletErrors';

export interface RecipientRow {
  id: string;
  address: string;
  amount: string;
  memo: string;
}

export const SAMPLE_CONTRIBUTOR_CSV = `# Recipient Address, Amount (USDC), Contributor Role / Grant
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 125.000000, "Core protocol engineering"
0x000000000000000000000000000000000000dEaD, 50.500000, "Documentation translation bounty"
0x1111111111111111111111111111111111111111, 25.750000, "Community security review"
0x2222222222222222222222222222222222222222, 10.000000, "Developer support triage"`;

export const PayoutComposer: React.FC = () => {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();

  const [rows, setRows] = useState<RecipientRow[]>([
    { id: '1', address: '', amount: '', memo: '' },
    { id: '2', address: '', amount: '', memo: '' },
  ]);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [walletConnectError, setWalletConnectError] = useState<string | null>(null);

  // Track whether payout confirmed so we reset rows only upon dismissing the modal
  const payoutCompletedRef = useRef(false);

  // Fetch payer ERC-20 USDC balance
  const { data: erc20BalanceRaw, refetch: refetchErc20 } = useReadContract({
    address: ARC_USDC_ERC20_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && chainId === ARC_CHAIN_ID,
    },
  });

  // Fetch payer Native USDC balance (for gas)
  const { data: nativeBalanceData } = useBalance({
    address,
    query: {
      enabled: !!address && chainId === ARC_CHAIN_ID,
    },
  });

  const payerErc20Balance = erc20BalanceRaw ?? 0n;
  const payerNativeUnits = nativeBalanceData ? nativeBalanceData.value / 10n ** 12n : 0n;
  // Unified USDC balance: on Arc, native gas (18-dec) and ERC-20 (6-dec) reflect the same account balance
  const payerUsdcBalance = payerErc20Balance > 0n ? payerErc20Balance : payerNativeUnits;

  // Row validation results
  const rowValidations = useMemo(() => {
    const addressCounts = new Map<string, number>();

    rows.forEach((r) => {
      const trimmed = r.address.trim().toLowerCase();
      if (trimmed) {
        addressCounts.set(trimmed, (addressCounts.get(trimmed) || 0) + 1);
      }
    });

    return rows.map((r) => {
      const trimmedAddr = r.address.trim();
      const addrRes = trimmedAddr ? validateRecipientAddress(trimmedAddr) : null;
      const amtRes = r.amount.trim() ? parseUsdc(r.amount.trim()) : null;

      const isDuplicate = trimmedAddr ? (addressCounts.get(trimmedAddr.toLowerCase()) || 0) > 1 : false;

      return {
        id: r.id,
        addressValid: addrRes ? addrRes.valid : false,
        addressError: addrRes && !addrRes.valid ? addrRes.error : null,
        normalizedAddress: addrRes?.normalized,
        amountValid: amtRes ? amtRes.valid : false,
        amountError: amtRes && !amtRes.valid ? amtRes.error : null,
        baseUnits: amtRes?.valid ? amtRes.baseUnits : 0n,
        isDuplicate,
        isEmpty: !trimmedAddr && !r.amount.trim(),
      };
    });
  }, [rows]);

  const totalBaseUnits = useMemo(() => {
    return sumAmounts(rowValidations.map((v) => v.baseUnits));
  }, [rowValidations]);

  const [confirmDuplicates, setConfirmDuplicates] = useState(false);

  const activeRowCount = useMemo(() => {
    return rows.filter((r) => r.address.trim() || r.amount.trim()).length;
  }, [rows]);

  const hasDuplicateWarnings = useMemo(() => {
    return rowValidations.some((v) => v.isDuplicate);
  }, [rowValidations]);

  const isFormValid = useMemo(() => {
    if (activeRowCount === 0 || activeRowCount > MAX_BATCH_RECIPIENTS) return false;
    if (hasDuplicateWarnings && !confirmDuplicates) return false;
    const activeValidations = rowValidations.filter((_, i) => !rowValidations[i].isEmpty);
    if (activeValidations.length === 0 || activeValidations.length > MAX_BATCH_RECIPIENTS) return false;
    return activeValidations.every((v) => v.addressValid && v.amountValid && v.baseUnits > 0n);
  }, [activeRowCount, rowValidations, hasDuplicateWarnings, confirmDuplicates]);

  // Fee reserve: reserve at least 0.005 USDC (5,000 base units) for Arc transaction gas fees
  const estimatedGasReserveBaseUnits = 5_000n;
  const totalRequiredWithGas = totalBaseUnits + estimatedGasReserveBaseUnits;

  const hasSufficientForPayout = !isConnected || totalBaseUnits === 0n || payerUsdcBalance >= totalBaseUnits;
  const hasSufficientGasReserve = !isConnected || totalBaseUnits === 0n || payerUsdcBalance >= totalRequiredWithGas;
  const hasSufficientBalance = hasSufficientForPayout && hasSufficientGasReserve;

  // Actions
  const addRow = () => {
    if (rows.length >= MAX_BATCH_RECIPIENTS) return;
    setRows((prev) => [
      ...prev,
      { id: Date.now().toString(), address: '', amount: '', memo: '' },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([{ id: '1', address: '', amount: '', memo: '' }]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof RecipientRow, val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const handleImport = () => {
    setImportError(null);
    const result = parseRecipientText(importText, MAX_BATCH_RECIPIENTS);
    if (result.error) {
      setImportError(result.error);
      return;
    }

    setRows(result.rows);
    setShowImportModal(false);
    setImportError(null);
    setImportText('');
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportError(null);
    setImportText('');
  };

  const handlePayoutSuccess = useCallback(() => {
    payoutCompletedRef.current = true;
    refetchErc20();
  }, [refetchErc20]);

  const handleCloseReviewModal = useCallback(() => {
    setShowReviewModal(false);
    // If the batch was confirmed onchain, reset to clean state now that user has closed review
    if (payoutCompletedRef.current) {
      payoutCompletedRef.current = false;
      setRows([
        { id: '1', address: '', amount: '', memo: '' },
        { id: '2', address: '', amount: '', memo: '' },
      ]);
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Editorial Header */}
      <div className="mb-6 pb-6 border-b border-[#E4E7EC] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Prepare USDC Payout Batch</h1>
          <p className="text-sm text-[#475467] mt-1">
            Settle multiple contributor payouts in a single atomic transaction on Arc Mainnet.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowImportModal(true)}
            aria-label="Import recipients from CSV or text"
            className="flex items-center space-x-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold rounded bg-white border border-[#D0D5DD] text-slate-700 hover:bg-slate-50 transition-colors focus-visible:ring-1 focus-visible:ring-slate-900"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV / Text</span>
          </button>
        </div>
      </div>

      {/* Deployment Mode Advisory */}
      {!IS_MAINNET_DEPLOYED && (
        <div className="mb-6 p-4 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start space-x-3">
          <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900 block">Pre-Deployment Review Mode</span>
            <p>
              Arc Mainnet contract deployment is pending operator authorization. The composer and precision validation math are fully active for review and testing.
            </p>
          </div>
        </div>
      )}

      {/* Unified USDC Balance & Gas Fee Advisory */}
      {isConnected && (
        <div className="mb-6 p-4 rounded bg-white border border-[#E4E7EC] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[11px] font-semibold block">
                Available USDC Balance
              </span>
              <span className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                {formatUsdc(payerUsdcBalance)} USDC
              </span>
            </div>
            <div className="border-l border-slate-200 pl-6">
              <span className="text-slate-500 uppercase tracking-wider text-[11px] font-semibold block">
                Est. Gas Reserve
              </span>
              <span className="text-sm font-semibold font-mono text-slate-700 tabular-nums">
                ~0.0050 USDC
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Baseline Buffer
              </span>
            </div>
            {totalBaseUnits > 0n && (
              <div className="border-l border-slate-200 pl-6">
                <span className="text-slate-500 uppercase tracking-wider text-[11px] font-semibold block">
                  Remaining After Batch
                </span>
                <span
                  className={`text-sm font-mono font-semibold tabular-nums ${
                    hasSufficientGasReserve ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {payerUsdcBalance >= totalBaseUnits
                    ? `${formatUsdc(payerUsdcBalance - totalBaseUnits)} USDC`
                    : 'Insufficient'}
                </span>
              </div>
            )}
          </div>
          <div className="text-slate-500 text-[11px] flex items-center space-x-1 max-w-sm">
            <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>
              Arc uses a single unified USDC balance for both batch transfers (6 decimals) and gas fees (18 decimals).
            </span>
          </div>
        </div>
      )}

      {/* Batch size warning banner */}
      {activeRowCount > MAX_BATCH_RECIPIENTS && (
        <div className="mb-4 p-3.5 rounded bg-red-50 border border-red-200 flex items-start space-x-2 text-xs text-red-900">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Maximum Batch Size Exceeded</strong>
            <p className="text-[11px] text-red-800 mt-0.5">
              Current batch has {activeRowCount} recipients. The BatchPayout contract limit is {MAX_BATCH_RECIPIENTS}. Please remove {activeRowCount - MAX_BATCH_RECIPIENTS} recipient{activeRowCount - MAX_BATCH_RECIPIENTS > 1 ? 's' : ''} to proceed.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate warning banner with intentional acknowledgment */}
      {hasDuplicateWarnings && (
        <div className="mb-4 p-3.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Duplicate recipient addresses detected in batch.</strong>
              <p className="text-[11px] text-amber-800 mt-0.5">
                The smart contract allows multiple transfers to the same address, but requires intentional confirmation before proceeding to payout review.
              </p>
            </div>
          </div>
          <label className="flex items-center space-x-2 cursor-pointer pt-1 pl-6 text-slate-900 font-semibold select-none">
            <input
              type="checkbox"
              checked={confirmDuplicates}
              onChange={(e) => setConfirmDuplicates(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
            />
            <span>I confirm this batch intentionally includes multiple payouts to the same address.</span>
          </label>
        </div>
      )}

      {/* Recipient Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-t overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs" aria-label="Recipient payments list">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E4E7EC] text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[340px]">Recipient Address (0x...)</th>
                <th className="py-2.5 px-3 w-40">Amount (USDC)</th>
                <th className="py-2.5 px-3 min-w-[180px]">Memo (Local Ref)</th>
                <th className="py-2.5 px-3 w-14 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const val = rowValidations[idx];
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.address}
                        aria-label={`Recipient address row ${idx + 1}`}
                        onChange={(e) => updateRow(row.id, 'address', e.target.value)}
                        placeholder="0x..."
                        className={`w-full px-2.5 py-1.5 rounded font-mono text-xs border ${
                          row.address && !val.addressValid
                            ? 'border-red-400 bg-red-50/20 text-red-900 focus:ring-red-400'
                            : 'border-slate-300 focus:border-slate-800'
                        } outline-none`}
                      />
                      {row.address && val.addressError && (
                        <p className="text-[11px] text-red-600 mt-0.5">{val.addressError}</p>
                      )}
                      {val.isDuplicate && (
                        <p className="text-[11px] text-amber-600 mt-0.5">Duplicate recipient address in batch</p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={row.amount}
                          aria-label={`USDC amount row ${idx + 1}`}
                          onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          className={`w-full px-2.5 py-1.5 rounded font-mono text-xs text-right pr-12 border tabular-nums ${
                            row.amount && !val.amountValid
                              ? 'border-red-400 bg-red-50/20 text-red-900 focus:ring-red-400'
                              : 'border-slate-300 focus:border-slate-800'
                          } outline-none`}
                        />
                        <span className="absolute right-2.5 top-2 text-[11px] font-semibold text-slate-400 pointer-events-none">
                          USDC
                        </span>
                      </div>
                      {row.amount && val.amountError && (
                        <p className="text-[11px] text-red-600 mt-0.5 text-right">{val.amountError}</p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.memo}
                        aria-label={`Local memo row ${idx + 1}`}
                        onChange={(e) => updateRow(row.id, 'memo', e.target.value)}
                        placeholder="e.g. October Milestone"
                        className="w-full px-2.5 py-1.5 rounded text-xs border border-slate-300 focus:border-slate-800 outline-none"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        aria-label={`Remove recipient row ${idx + 1}`}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors focus-visible:ring-1 focus-visible:ring-red-500"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Row Button */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <button
            onClick={addRow}
            disabled={rows.length >= MAX_BATCH_RECIPIENTS}
            aria-label="Add new recipient"
            className="flex items-center space-x-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm focus-visible:ring-1 focus-visible:ring-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Recipient</span>
          </button>
          <span
            className={`text-xs ${
              activeRowCount > MAX_BATCH_RECIPIENTS ? 'text-red-600 font-semibold' : 'text-slate-500'
            }`}
          >
            {activeRowCount} of {MAX_BATCH_RECIPIENTS} max recipients
          </span>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-4 p-5 bg-white border border-[#E4E7EC] rounded-b flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
            Batch Total Calculation
          </span>
          <div className="flex items-baseline space-x-2 mt-0.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {formatUsdc(totalBaseUnits)}
            </span>
            <span className="text-sm font-semibold text-slate-500">USDC</span>
          </div>
          {isConnected && !hasSufficientBalance && totalBaseUnits > 0n && (
            <div className="flex items-center space-x-1.5 mt-1 text-xs text-red-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {!hasSufficientForPayout
                  ? `Insufficient USDC balance (${formatUsdc(payerUsdcBalance)} available, need ${formatUsdc(totalBaseUnits)} for payouts).`
                  : `Insufficient USDC for gas: Batch leaves less than 0.0050 USDC to cover required Arc transaction fees.`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {!isConnected ? (
            <div className="flex flex-col items-end">
              <button
                onClick={() => {
                  setWalletConnectError(null);
                  if (!connectors || connectors.length === 0 || !connectors[0]) {
                    setWalletConnectError('No Web3 wallet detected. Please install MetaMask, Rabby, or an Arc-compatible browser wallet extension.');
                    return;
                  }
                  connect(
                    { connector: connectors[0] },
                    {
                      onError: (err) => {
                        setWalletConnectError(formatWalletErrorMessage(err));
                      },
                    }
                  );
                }}
                className="flex items-center space-x-2 px-5 py-2.5 rounded font-semibold text-xs bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet to Review</span>
              </button>
              {walletConnectError && (
                <p className="text-[11px] text-red-600 mt-1.5 max-w-xs text-right font-medium">
                  {walletConnectError}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowReviewModal(true)}
              disabled={!isFormValid || !hasSufficientBalance}
              className="flex items-center space-x-2 px-6 py-2.5 rounded font-semibold text-xs bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <span>Review Batch Payout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Batch Review Modal */}
      {showReviewModal && (
        <BatchReviewModal
          isOpen={showReviewModal}
          onClose={handleCloseReviewModal}
          rows={rows.filter((_, i) => !rowValidations[i].isEmpty)}
          totalBaseUnits={totalBaseUnits}
          onSuccess={handlePayoutSuccess}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-lg w-full p-6 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Import CSV or Tab-Separated Lines</h3>
              <button
                type="button"
                onClick={() => {
                  setImportText(SAMPLE_CONTRIBUTOR_CSV);
                  setImportError(null);
                }}
                className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold underline"
              >
                Load Sample Contributor List
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enter one recipient per line in the format: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">0xAddress, amount, [optional memo]</code>
            </p>
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 150.00, Grant Milestone 1&#10;0x1234567890123456789012345678901234567890, 50.25, Documentation bounty"
              className="w-full mt-3 p-3 font-mono text-xs border border-slate-300 rounded outline-none focus:border-slate-800"
            />
            {importError && (
              <p className="text-xs text-red-600 mt-2 font-medium">{importError}</p>
            )}
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={handleCloseImportModal}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800"
              >
                Import Lines
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
