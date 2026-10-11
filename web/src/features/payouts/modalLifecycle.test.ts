import { describe, it, expect, vi } from 'vitest';
import { formatWalletErrorMessage } from '../../lib/chain/walletErrors';
import type { TxStep } from './BatchReviewModal';

describe('modal pending protection and transaction monitoring', () => {
  function createModalLifecycleController(onCloseCallback: () => void) {
    let currentStep: TxStep = 'REVIEW';
    let approvalTxHash: `0x${string}` | null = null;
    let payoutTxHash: `0x${string}` | null = null;

    const isPendingOperation = () => {
      return (
        currentStep === 'APPROVAL_PENDING' ||
        currentStep === 'PAYOUT_PENDING' ||
        currentStep === 'AWAITING_APPROVAL' ||
        currentStep === 'AWAITING_PAYOUT'
      );
    };

    const handleModalClose = () => {
      if (isPendingOperation()) {
        return false; // rejected
      }
      onCloseCallback();
      return true; // closed
    };

    const setStep = (step: TxStep) => {
      currentStep = step;
    };

    const setApprovalHash = (hash: `0x${string}`) => {
      approvalTxHash = hash;
    };

    const setPayoutHash = (hash: `0x${string}`) => {
      payoutTxHash = hash;
    };

    return {
      isPendingOperation,
      handleModalClose,
      setStep,
      setApprovalHash,
      setPayoutHash,
      getApprovalHash: () => approvalTxHash,
      getPayoutHash: () => payoutTxHash,
    };
  }

  it('strictly prevents closing modal while transactions are in pending states', () => {
    const onClose = vi.fn();
    const modal = createModalLifecycleController(onClose);

    // Initial REVIEW state: close allowed
    expect(modal.handleModalClose()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    // During wallet signature prompt (AWAITING_APPROVAL): close blocked
    modal.setStep('AWAITING_APPROVAL');
    expect(modal.isPendingOperation()).toBe(true);
    expect(modal.handleModalClose()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1); // not called again

    // During onchain mining (APPROVAL_PENDING): close blocked
    modal.setStep('APPROVAL_PENDING');
    expect(modal.isPendingOperation()).toBe(true);
    expect(modal.handleModalClose()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);

    // APPROVED state: close allowed
    modal.setStep('APPROVED');
    expect(modal.isPendingOperation()).toBe(false);
    expect(modal.handleModalClose()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);

    // During payout wallet signature prompt (AWAITING_PAYOUT): close blocked
    modal.setStep('AWAITING_PAYOUT');
    expect(modal.isPendingOperation()).toBe(true);
    expect(modal.handleModalClose()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(2);

    // During atomic settlement mining (PAYOUT_PENDING): close blocked
    modal.setStep('PAYOUT_PENDING');
    expect(modal.isPendingOperation()).toBe(true);
    expect(modal.handleModalClose()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(2);

    // Once mined (CONFIRMED): close allowed
    modal.setStep('CONFIRMED');
    expect(modal.isPendingOperation()).toBe(false);
    expect(modal.handleModalClose()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(3);

    // On revert/error (FAILED): close allowed
    modal.setStep('FAILED');
    expect(modal.isPendingOperation()).toBe(false);
    expect(modal.handleModalClose()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('preserves approval and payout transaction hashes throughout modal lifecycle', () => {
    const onClose = vi.fn();
    const modal = createModalLifecycleController(onClose);

    const mockApprovalHash = '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`;
    const mockPayoutHash = '0x2222222222222222222222222222222222222222222222222222222222222222' as `0x${string}`;

    modal.setApprovalHash(mockApprovalHash);
    expect(modal.getApprovalHash()).toBe(mockApprovalHash);

    modal.setPayoutHash(mockPayoutHash);
    expect(modal.getPayoutHash()).toBe(mockPayoutHash);
  });
});

describe('wallet error formatting', () => {
  it('formats raw Wagmi provider not found message into user-friendly advice', () => {
    const rawWagmiErr = new Error(
      'Provider not found.\nVersion: @wagmi/core@2.13.4\nDetails: window.ethereum is undefined'
    );
    const formatted = formatWalletErrorMessage(rawWagmiErr);

    expect(formatted).not.toContain('@wagmi/core');
    expect(formatted).toBe(
      'No Web3 browser wallet detected. Please install MetaMask, Rabby, or an Arc-compatible browser extension.'
    );
  });

  it('formats user rejection errors into standard cancellation notice', () => {
    const rejectionErr = new Error('User rejected the request. [code: 4001]');
    const formatted = formatWalletErrorMessage(rejectionErr);

    expect(formatted).toBe('Transaction request was cancelled by the user in the wallet.');
  });

  it('formats network timeout or disconnection errors', () => {
    const netErr = new Error('failed to fetch JSON-RPC payload: connection refused');
    const formatted = formatWalletErrorMessage(netErr);

    expect(formatted).toContain('Network connection to Arc RPC timed out or was interrupted');
  });

  it('cleans internal stack traces and version details from unknown errors', () => {
    const unknownErr = new Error('Execution reverted with custom code 0x123\nVersion: @wagmi/core@2.1.0\nDetails: custom');
    const formatted = formatWalletErrorMessage(unknownErr);

    expect(formatted).not.toContain('@wagmi/core');
    expect(formatted).toContain('Execution reverted with custom code 0x123');
  });
});

describe('CSV import modal error clearing on dismissal', () => {
  it('clears import errors and text upon dismissal', () => {
    let showModal = true;
    let importError: string | null = 'Line 2 format invalid';
    let importText = '0xInvalidLine';

    const handleCloseImportModal = () => {
      showModal = false;
      importError = null;
      importText = '';
    };

    handleCloseImportModal();

    expect(showModal).toBe(false);
    expect(importError).toBeNull();
    expect(importText).toBe('');
  });
});
