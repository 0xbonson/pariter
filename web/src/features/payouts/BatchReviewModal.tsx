import React, { useState, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useChainId,
  useSwitchChain,
  useBalance,
} from 'wagmi';
import { encodePacked, keccak256, type Address } from 'viem';
import { X, CheckCircle2, AlertCircle, Loader2, ArrowRight, ExternalLink } from 'lucide-react';
import {
  ARC_USDC_ERC20_ADDRESS,
  BATCH_PAYOUT_ADDRESS,
  IS_MAINNET_DEPLOYED,
} from '../../lib/contracts/addresses';
import { erc20Abi } from '../../lib/contracts/erc20Abi';
import { batchPayoutAbi } from '../../lib/contracts/batchPayoutAbi';
import { formatUsdc, parseUsdc } from '../../lib/money/usdc';
import type { RecipientRow } from './PayoutComposer';

interface BatchReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: RecipientRow[];
  totalBaseUnits: bigint;
  onSuccess: () => void;
}

export type TxStep =
  | 'REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'AWAITING_PAYOUT'
  | 'PAYOUT_PENDING'
  | 'CONFIRMED'
  | 'FAILED';

export const BatchReviewModal: React.FC<BatchReviewModalProps> = ({
  isOpen,
  onClose,
  rows,
  totalBaseUnits,
  onSuccess,
}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongNetwork = chainId !== 5042;

  const [step, setStep] = useState<TxStep>('REVIEW');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [estimatedGasUsdc, setEstimatedGasUsdc] = useState<string>('0.003');
  const [payoutTxHash, setPayoutTxHash] = useState<`0x${string}` | null>(null);

  // Check current native USDC gas balance (18 decimals)
  const { data: nativeBalanceData } = useBalance({
    address,
    query: { enabled: !!address },
  });

  // Check current ERC-20 USDC token balance (6 decimals)
  const { data: erc20BalanceRaw } = useReadContract({
    address: ARC_USDC_ERC20_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const payerErc20Balance = erc20BalanceRaw ?? 0n;
  const payerNativeBalance = nativeBalanceData?.value ?? 0n;
  const insufficientErc20 = payerErc20Balance < totalBaseUnits;
  const insufficientNativeGas = payerNativeBalance < 5_000_000_000_000_000n; // < 0.005 native USDC

  // Check current allowance for BatchPayout contract
  const { data: currentAllowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: ARC_USDC_ERC20_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && BATCH_PAYOUT_ADDRESS ? [address, BATCH_PAYOUT_ADDRESS] : undefined,
    query: {
      enabled: !!address && !!BATCH_PAYOUT_ADDRESS && IS_MAINNET_DEPLOYED,
    },
  });

  const currentAllowance = currentAllowanceRaw ?? 0n;
  const requiresApproval = currentAllowance < totalBaseUnits;

  // Contract write hooks
  const {
    data: approvalHash,
    writeContract: writeApprove,
    isPending: isApprovalWritePending,
    error: approvalWriteError,
  } = useWriteContract();

  const {
    data: payoutHash,
    writeContract: writePayout,
    isPending: isPayoutWritePending,
    error: payoutWriteError,
  } = useWriteContract();

  // Watch Approval transaction receipt
  const { isLoading: isApprovalMining, isSuccess: isApprovalSuccess } =
    useWaitForTransactionReceipt({
      hash: approvalHash,
    });

  // Watch Payout transaction receipt
  const {
    data: payoutReceipt,
    isLoading: isPayoutMining,
    isSuccess: isPayoutSuccess,
    error: payoutReceiptError,
  } = useWaitForTransactionReceipt({
    hash: payoutHash,
  });

  // Dynamic simulation & gas estimation
  useEffect(() => {
    if (!publicClient || !address || rows.length === 0) return;

    async function estimate() {
      try {
        const gasPrice = await publicClient!.getGasPrice();
        let estimatedUnits = 0n;

        if (IS_MAINNET_DEPLOYED && currentAllowance >= totalBaseUnits) {
          try {
            const recipients = rows.map((r) => r.address.trim() as Address);
            const amounts = rows.map((r) => parseUsdc(r.amount.trim()).baseUnits);
            const dummyBatchId = keccak256(encodePacked(['address', 'uint256'], [address as Address, 0n]));
            const dummyCommitment = keccak256(encodePacked(['string'], ['']));

            estimatedUnits = await publicClient!.estimateContractGas({
              address: BATCH_PAYOUT_ADDRESS,
              abi: batchPayoutAbi,
              functionName: 'executeBatch',
              args: [recipients, amounts, dummyBatchId, dummyCommitment],
              account: address,
            });
          } catch {
            estimatedUnits = BigInt(65000 + rows.length * 28000);
          }
        } else {
          estimatedUnits = BigInt(45000 + 65000 + rows.length * 28000);
        }

        const gasWei = estimatedUnits * gasPrice;
        const usdcGas = Number(gasWei) / 1e18;
        setEstimatedGasUsdc(usdcGas > 0.000001 ? usdcGas.toFixed(6) : '< 0.000001');
      } catch {
        setEstimatedGasUsdc('~0.0030');
      }
    }
    estimate();
  }, [publicClient, address, rows.length, currentAllowance, totalBaseUnits]);

  // Synchronize approval state
  useEffect(() => {
    if (isApprovalWritePending) {
      setStep('AWAITING_APPROVAL');
    } else if (isApprovalMining) {
      setStep('APPROVAL_PENDING');
    } else if (isApprovalSuccess) {
      refetchAllowance();
      setStep('APPROVED');
    }
  }, [isApprovalWritePending, isApprovalMining, isApprovalSuccess, refetchAllowance]);

  // Synchronize payout state with strict onchain receipt verification
  useEffect(() => {
    if (isPayoutWritePending) {
      setStep('AWAITING_PAYOUT');
    } else if (isPayoutMining) {
      setStep('PAYOUT_PENDING');
      if (payoutHash) setPayoutTxHash(payoutHash);
    } else if (isPayoutSuccess && payoutReceipt) {
      if (payoutReceipt.status === 'success') {
        setStep('CONFIRMED');
        if (payoutHash) setPayoutTxHash(payoutHash);
        onSuccess();
      } else {
        setErrorMessage('Payout transaction was mined on Arc Mainnet but execution reverted onchain.');
        setStep('FAILED');
      }
    }
  }, [isPayoutWritePending, isPayoutMining, isPayoutSuccess, payoutReceipt, payoutHash, onSuccess]);

  const formatErrorMessage = (err: Error): string => {
    const msg = err.message || '';
    if (msg.includes('User rejected') || msg.includes('user rejected') || msg.includes('User denied')) {
      return 'Transaction request was cancelled by the user in the wallet.';
    }
    if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
      return 'Insufficient USDC funds for transfer amount or native gas fees.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('failed to fetch')) {
      return 'Network connection to Arc RPC timed out or was interrupted. Please check network connectivity.';
    }
    return msg.length > 200 ? `${msg.slice(0, 200)}...` : msg;
  };

  // Handle errors
  useEffect(() => {
    if (approvalWriteError) {
      setErrorMessage(formatErrorMessage(approvalWriteError));
      setStep('REVIEW');
    }
    if (payoutWriteError) {
      setErrorMessage(formatErrorMessage(payoutWriteError));
      setStep('REVIEW');
    }
    if (payoutReceiptError) {
      setErrorMessage(formatErrorMessage(payoutReceiptError));
      setStep('FAILED');
    }
  }, [approvalWriteError, payoutWriteError, payoutReceiptError]);

  const handleApprove = () => {
    setErrorMessage(null);
    writeApprove({
      address: ARC_USDC_ERC20_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [BATCH_PAYOUT_ADDRESS, totalBaseUnits],
    });
  };

  const handleExecutePayout = () => {
    setErrorMessage(null);

    const recipients = rows.map((r) => r.address.trim() as Address);
    const amounts = rows.map((r) => parseUsdc(r.amount.trim()).baseUnits);

    // Deterministic batch ID and memo commitment
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const randomNonce = BigInt(Math.floor(Math.random() * 1000000));
    const batchId = keccak256(
      encodePacked(['address', 'uint256', 'uint256'], [address as Address, timestamp, randomNonce])
    );

    const memoConcatenation = rows.map((r) => r.memo || '').join('|');
    const referenceCommitment = keccak256(encodePacked(['string'], [memoConcatenation]));

    writePayout({
      address: BATCH_PAYOUT_ADDRESS,
      abi: batchPayoutAbi,
      functionName: 'executeBatch',
      args: [recipients, amounts, batchId, referenceCommitment],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Authorize Batch Disbursement</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review transaction parameters before signing with your wallet.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'APPROVAL_PENDING' || step === 'PAYOUT_PENDING'}
            className="p-1 text-slate-400 hover:text-slate-600 rounded disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Status Alert if in progress or confirmed */}
          {step === 'CONFIRMED' && (
            <div className="p-4 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="font-bold text-sm">Batch Settlement Confirmed!</span>
              </div>
              <p className="text-xs text-emerald-800">
                All {rows.length} recipient payments have been atomically settled on Arc Mainnet.
              </p>
              {payoutTxHash && (
                <div className="pt-2 flex flex-wrap gap-2">
                  <a
                    href={`https://explorer.arc.io/tx/${payoutTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-mono text-[11px]"
                  >
                    <span>View on Arc Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-red-900 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="overflow-hidden">
                <span className="font-semibold block">Execution Alert:</span>
                <p className="text-[11px] break-words mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {isWrongNetwork && (
            <div className="p-3.5 rounded bg-amber-50 border border-amber-200 text-amber-900 flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold block">Connected to Wrong Network</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Your wallet is connected to Chain ID {chainId}. Pariter requires Arc Mainnet (Chain ID 5042).
                  </p>
                </div>
              </div>
              {switchChain && (
                <button
                  type="button"
                  onClick={() => switchChain({ chainId: 5042 })}
                  className="ml-3 px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors flex-shrink-0"
                >
                  Switch to Arc
                </button>
              )}
            </div>
          )}

          {insufficientErc20 && (
            <div className="p-3.5 rounded bg-red-50 border border-red-200 text-red-900 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold block">Insufficient USDC Token Balance</span>
                <p className="text-[11px] text-red-800 mt-0.5">
                  Wallet has {formatUsdc(payerErc20Balance)} USDC ERC-20. Total batch required is {formatUsdc(totalBaseUnits)} USDC.
                </p>
              </div>
            </div>
          )}

          {!insufficientErc20 && insufficientNativeGas && (
            <div className="p-3.5 rounded bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold block">Low Native Gas Balance</span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Arc gas fees are paid in native USDC (18 decimals). Your wallet has &lt; 0.005 native USDC, which may be insufficient to cover gas fees.
                </p>
              </div>
            </div>
          )}

          {/* Verification Spec Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded border border-slate-200">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Network
              </span>
              <span className="font-semibold text-slate-900">Arc Mainnet (5042)</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Recipients
              </span>
              <span className="font-semibold text-slate-900">{rows.length} wallets</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Total Payout
              </span>
              <span className="font-bold font-mono text-slate-900 tabular-nums">
                {formatUsdc(totalBaseUnits)} USDC
              </span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Est. Gas Fee
              </span>
              <span className="font-mono text-slate-700">~{estimatedGasUsdc} USDC</span>
            </div>
          </div>

          {/* Contract Address Check */}
          <div className="border border-slate-200 rounded p-3 bg-white space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
              BatchPayout Contract
            </span>
            <div className="flex items-center justify-between">
              <code className="font-mono text-[11px] text-slate-800 break-all">
                {BATCH_PAYOUT_ADDRESS}
              </code>
              <a
                href={`https://explorer.arc.io/address/${BATCH_PAYOUT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-slate-700 ml-2"
                title="Verify contract on Arc Explorer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Recipient Itemized Breakdown */}
          <div>
            <span className="text-xs font-bold text-slate-900 block mb-2">Itemized Payments ({rows.length})</span>
            <div className="border border-slate-200 rounded max-h-48 overflow-y-auto divide-y divide-slate-100">
              {rows.map((r, i) => (
                <div key={r.id} className="p-2.5 flex items-center justify-between text-[11px] hover:bg-slate-50">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-slate-400 w-5">{i + 1}.</span>
                    <span className="font-mono text-slate-800">{r.address}</span>
                    {r.memo && (
                      <span className="text-slate-400 italic">({r.memo})</span>
                    )}
                  </div>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {r.amount} USDC
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sequential Authorization Flow */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3">
            <span className="font-bold text-slate-900 block">Required Authorization Sequence</span>
            <div className="space-y-2">
              {/* Step 1: Allowance Approval */}
              <div
                className={`p-3 rounded border flex items-center justify-between ${
                  !requiresApproval || step === 'APPROVED' || step === 'CONFIRMED'
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      !requiresApproval || step === 'APPROVED' || step === 'CONFIRMED'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {!requiresApproval || step === 'APPROVED' || step === 'CONFIRMED' ? '✓' : '1'}
                  </span>
                  <div>
                    <span className="font-semibold block">
                      USDC Allowance Approval (Exact: {formatUsdc(totalBaseUnits)} USDC)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Authorizes BatchPayout to draw the exact payout total.
                    </span>
                  </div>
                </div>

                {!IS_MAINNET_DEPLOYED ? (
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded">
                    Deployment Pending
                  </span>
                ) : requiresApproval && step !== 'APPROVED' && step !== 'CONFIRMED' ? (
                  <button
                    onClick={handleApprove}
                    disabled={
                      step === 'AWAITING_APPROVAL' ||
                      step === 'APPROVAL_PENDING' ||
                      isWrongNetwork ||
                      insufficientErc20
                    }
                    className="flex items-center space-x-1.5 min-h-[38px] px-3.5 py-2 rounded font-semibold text-xs bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {step === 'APPROVAL_PENDING' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Confirming...</span>
                      </>
                    ) : (
                      <span>Sign Approval</span>
                    )}
                  </button>
                ) : null}
              </div>

              {/* Step 2: Atomic Batch Settlement */}
              <div
                className={`p-3 rounded border flex items-center justify-between ${
                  step === 'CONFIRMED'
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      step === 'CONFIRMED'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {step === 'CONFIRMED' ? '✓' : '2'}
                  </span>
                  <div>
                    <span className="font-semibold block">Execute Atomic Settlement</span>
                    <span className="text-[11px] text-slate-500">
                      Transfers exact amounts to {rows.length} recipients atomically on Arc Mainnet.
                    </span>
                  </div>
                </div>

                {!IS_MAINNET_DEPLOYED ? (
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded">
                    Deployment Pending
                  </span>
                ) : (!requiresApproval || step === 'APPROVED') && step !== 'CONFIRMED' ? (
                  <button
                    onClick={handleExecutePayout}
                    disabled={
                      step === 'AWAITING_PAYOUT' ||
                      step === 'PAYOUT_PENDING' ||
                      isWrongNetwork ||
                      insufficientErc20
                    }
                    className="flex items-center space-x-1.5 min-h-[38px] px-4 py-2 rounded font-semibold text-xs bg-blue-700 text-white hover:bg-blue-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {step === 'PAYOUT_PENDING' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Settling...</span>
                      </>
                    ) : (
                      <>
                        <span>Execute Batch</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            Atomicity guaranteed: All transfers succeed or the transaction reverts.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-200 rounded transition-colors"
          >
            {step === 'CONFIRMED' ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
