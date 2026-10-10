import { describe, it, expect } from 'vitest';
import {
  parseUsdc,
  formatUsdc,
  formatNativeGas,
  sumAmounts,
  validateRecipientAddress,
  NATIVE_BASE_FACTOR,
} from './usdc';

describe('USDC Financial Mathematics & Decimal Precision', () => {
  it('correctly parses 1 USDC into 1,000,000 base units (6 decimals)', () => {
    const res = parseUsdc('1');
    expect(res.valid).toBe(true);
    expect(res.baseUnits).toBe(1_000_000n);
  });

  it('correctly parses small fractional amounts down to 1 micro-USDC (0.000001)', () => {
    const res = parseUsdc('0.000001');
    expect(res.valid).toBe(true);
    expect(res.baseUnits).toBe(1n);
  });

  it('correctly parses typical payment amounts with 2 decimals (e.g., 500.50)', () => {
    const res = parseUsdc('500.50');
    expect(res.valid).toBe(true);
    expect(res.baseUnits).toBe(500_500_000n);
  });

  it('correctly parses amounts with leading dot (.75)', () => {
    const res = parseUsdc('.75');
    expect(res.valid).toBe(true);
    expect(res.baseUnits).toBe(750_000n);
  });

  it('rejects precision exceeding 6 decimal places', () => {
    const res = parseUsdc('1.1234567');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Maximum precision is 6 decimal places');
  });

  it('rejects zero amounts', () => {
    const res1 = parseUsdc('0');
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain('greater than zero');

    const res2 = parseUsdc('0.000000');
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain('greater than zero');
  });

  it('rejects negative numbers and signs', () => {
    const res = parseUsdc('-10');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('No signs or exponential notation');
  });

  it('rejects scientific notation', () => {
    const res = parseUsdc('1e6');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('No signs or exponential notation');
  });

  it('rejects alphabetic and malformed strings', () => {
    expect(parseUsdc('abc').valid).toBe(false);
    expect(parseUsdc('1.2.3').valid).toBe(false);
    expect(parseUsdc('$500').valid).toBe(false);
    expect(parseUsdc('').valid).toBe(false);
  });

  it('formats base units into human-readable strings with thousands separators', () => {
    expect(formatUsdc(1_000_000n)).toBe('1.00');
    expect(formatUsdc(1_500_000n)).toBe('1.50');
    expect(formatUsdc(1_234_567_890n)).toBe('1,234.56789');
    expect(formatUsdc(10_000_000_000n)).toBe('10,000.00');
  });

  it('formats native gas units (18 decimals)', () => {
    // 0.002 USDC in native 18 decimals = 2_000_000_000_000_000n
    expect(formatNativeGas(2_000_000_000_000_000n)).toBe('0.002000');
    expect(formatNativeGas(NATIVE_BASE_FACTOR)).toBe('1.000000');
  });

  it('accurately sums arrays of base unit amounts without overflow', () => {
    const amounts = [100_000_000n, 250_000_000n, 50_000_000n]; // 100, 250, 50
    expect(sumAmounts(amounts)).toBe(400_000_000n);
  });

  it('validates and checksums valid Ethereum/Arc addresses', () => {
    const valid = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const res = validateRecipientAddress(valid);
    expect(res.valid).toBe(true);
    expect(res.normalized).toBe(valid);
  });

  it('rejects zero address 0x000...000', () => {
    const zero = '0x0000000000000000000000000000000000000000';
    const res = validateRecipientAddress(zero);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Zero address');
  });

  it('rejects short or invalid addresses', () => {
    expect(validateRecipientAddress('0x123').valid).toBe(false);
    expect(validateRecipientAddress('not-an-address').valid).toBe(false);
  });
});
