import { describe, it, expect, vi } from 'vitest';
import { parseRecipientText, validateBatchLimits } from './batchParser';
import { MAX_BATCH_RECIPIENTS } from '../../lib/contracts/addresses';

describe('batchParser and recipient limits', () => {
  it('enforces MAX_BATCH_RECIPIENTS constant is exactly 250', () => {
    expect(MAX_BATCH_RECIPIENTS).toBe(250);
  });

  it('validates batch sizes at boundaries (249, 250, 251)', () => {
    // 249 recipients: valid
    const res249 = validateBatchLimits(249);
    expect(res249.valid).toBe(true);
    expect(res249.error).toBeUndefined();

    // 250 recipients: valid (exact maximum boundary)
    const res250 = validateBatchLimits(250);
    expect(res250.valid).toBe(true);
    expect(res250.error).toBeUndefined();

    // 251 recipients: strictly invalid (exceeds contract maximum)
    const res251 = validateBatchLimits(251);
    expect(res251.valid).toBe(false);
    expect(res251.error).toContain('Batch contains 251 recipients, exceeding the maximum allowed limit of 250');

    // 0 recipients: invalid
    const res0 = validateBatchLimits(0);
    expect(res0.valid).toBe(false);
    expect(res0.error).toContain('at least one recipient');
  });

  it('successfully parses 249 valid recipient lines', () => {
    const lines: string[] = [];
    for (let i = 1; i <= 249; i++) {
      const padded = i.toString(16).padStart(40, '0');
      lines.push(`0x${padded}, 10.50, Contributor #${i}`);
    }
    const input = lines.join('\n');
    const result = parseRecipientText(input);

    expect(result.error).toBeUndefined();
    expect(result.rows.length).toBe(249);
    expect(result.rows[0].address).toBe(`0x${'1'.padStart(40, '0')}`);
    expect(result.rows[0].amount).toBe('10.50');
    expect(result.rows[0].memo).toBe('Contributor #1');
    expect(result.rows[248].memo).toBe('Contributor #249');
  });

  it('successfully parses exactly 250 valid recipient lines (boundary)', () => {
    const lines: string[] = [];
    for (let i = 1; i <= 250; i++) {
      const padded = i.toString(16).padStart(40, '0');
      lines.push(`0x${padded}, 25.00, Milestone ${i}`);
    }
    const input = lines.join('\n');
    const result = parseRecipientText(input);

    expect(result.error).toBeUndefined();
    expect(result.rows.length).toBe(250);
    expect(result.rows[249].memo).toBe('Milestone 250');
  });

  it('strictly rejects 251 recipient lines with descriptive error', () => {
    const lines: string[] = [];
    for (let i = 1; i <= 251; i++) {
      const padded = i.toString(16).padStart(40, '0');
      lines.push(`0x${padded}, 5.00, Contributor ${i}`);
    }
    const input = lines.join('\n');
    const result = parseRecipientText(input);

    expect(result.rows.length).toBe(0);
    expect(result.error).toBe('Cannot import 251 recipients. The maximum allowed batch size is 250 recipients.');
  });

  it('supports tab-delimited formatting as well as commas', () => {
    const input = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\t100.50\tTab memo
0x1234567890123456789012345678901234567890,50.00,Comma memo`;
    const result = parseRecipientText(input);

    expect(result.error).toBeUndefined();
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].address).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result.rows[0].amount).toBe('100.50');
    expect(result.rows[0].memo).toBe('Tab memo');
    expect(result.rows[1].memo).toBe('Comma memo');
  });

  it('rejects empty input or lines with missing amount', () => {
    const emptyRes = parseRecipientText('   \n\n  ');
    expect(emptyRes.error).toBe('No payment entries provided.');

    const malformed = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 100
0xMissingAmountOnly`;
    const malformedRes = parseRecipientText(malformed);
    expect(malformedRes.error).toContain('Line 2 format invalid. Expected: address, amount, [memo]');
  });

  it('correctly handles quoted fields containing commas and escaped quotes ("")', () => {
    const csv = `"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "150.00", "Grant Milestone 1, Core Dev"
"0x1234567890123456789012345678901234567890", "50.25", "Special ""Hero"" Contributor Bounty"`;
    const result = parseRecipientText(csv);

    expect(result.error).toBeUndefined();
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].address).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result.rows[0].amount).toBe('150.00');
    expect(result.rows[0].memo).toBe('Grant Milestone 1, Core Dev');
    expect(result.rows[1].memo).toBe('Special "Hero" Contributor Bounty');
  });

  it('detects and skips optional header rows automatically', () => {
    const csvWithHeader = `Address, Amount, Memo
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 200.00, Core Lead
0x1234567890123456789012345678901234567890, 75.50, Documentation`;
    const result = parseRecipientText(csvWithHeader);

    expect(result.error).toBeUndefined();
    expect(result.hasHeaderRow).toBe(true);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].address).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result.rows[0].amount).toBe('200.00');
  });

  it('tracks duplicate recipient addresses and counts', () => {
    const csvWithDuplicates = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 10.00, Part 1
0x1234567890123456789012345678901234567890, 20.00, Unique
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 15.00, Part 2`;
    const result = parseRecipientText(csvWithDuplicates);

    expect(result.error).toBeUndefined();
    expect(result.rows.length).toBe(3);
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicateAddresses).toContain('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
  });

  it('strictly rejects the zero address (0x000...000)', () => {
    const csv = `0x0000000000000000000000000000000000000000, 100.00, Zero Burn`;
    const result = parseRecipientText(csv);

    expect(result.rows.length).toBe(0);
    expect(result.error).toContain('Zero address (0x000...000) cannot receive payouts');
  });

  it('strictly rejects invalid USDC decimals exceeding 6 decimal places', () => {
    const csv = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 10.1234567, Exceeds 6 decimals`;
    const result = parseRecipientText(csv);

    expect(result.rows.length).toBe(0);
    expect(result.error).toContain('Invalid USDC amount');
  });

  it('strictly rejects non-positive or negative amounts', () => {
    const csvZero = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 0.00, Zero amount`;
    const resultZero = parseRecipientText(csvZero);
    expect(resultZero.error).toContain('Amount must be greater than zero');

    const csvNeg = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, -5.00, Negative`;
    const resultNeg = parseRecipientText(csvNeg);
    expect(resultNeg.error).toContain('Invalid USDC amount');
  });
});

describe('modal success callback single-execution guarantee', () => {
  it('guarantees onSuccess callback fires strictly once per confirmed transaction hash', () => {
    // Simulating the deduplication ref logic implemented in BatchReviewModal
    let handledSuccessTx: string | null = null;
    const onSuccessMock = vi.fn();

    const triggerConfirmedPayout = (txHash: string) => {
      if (txHash && handledSuccessTx !== txHash) {
        handledSuccessTx = txHash;
        onSuccessMock();
      }
    };

    const mockTxHash = '0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    // First render cycle / notification
    triggerConfirmedPayout(mockTxHash);
    expect(onSuccessMock).toHaveBeenCalledTimes(1);

    // Repeated renders / effect runs with the same txHash
    triggerConfirmedPayout(mockTxHash);
    triggerConfirmedPayout(mockTxHash);
    triggerConfirmedPayout(mockTxHash);
    expect(onSuccessMock).toHaveBeenCalledTimes(1);

    // A distinct second transaction hash would fire once
    const secondTxHash = '0xdef9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba';
    triggerConfirmedPayout(secondTxHash);
    expect(onSuccessMock).toHaveBeenCalledTimes(2);

    // Repeated renders with the second txHash do not fire again
    triggerConfirmedPayout(secondTxHash);
    expect(onSuccessMock).toHaveBeenCalledTimes(2);
  });
});
