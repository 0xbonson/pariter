import { isAddress, getAddress } from 'viem';

export const USDC_DECIMALS = 6;
export const NATIVE_GAS_DECIMALS = 18;

export const USDC_BASE_FACTOR = 1_000_000n; // 10^6
export const NATIVE_BASE_FACTOR = 1_000_000_000_000_000_000n; // 10^18

export interface ParsedAmountResult {
  valid: boolean;
  baseUnits: bigint;
  error?: string;
}

/**
 * Validates and parses a human-readable USDC decimal string into integer base units (6 decimals).
 * Strictly forbids JavaScript floating point math.
 * Rejects negative numbers, scientific notation, malformed strings, and > 6 decimal places.
 */
export function parseUsdc(input: string): ParsedAmountResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, baseUnits: 0n, error: 'Amount is required' };
  }

  const trimmed = input.trim();
  if (trimmed === '') {
    return { valid: false, baseUnits: 0n, error: 'Amount cannot be empty' };
  }

  // Reject scientific notation or negative signs
  if (trimmed.includes('e') || trimmed.includes('E') || trimmed.includes('-')) {
    return { valid: false, baseUnits: 0n, error: 'Invalid number format. No signs or exponential notation allowed.' };
  }

  // Must match integer or decimal with up to 6 places
  const match = trimmed.match(/^(\d+)?(?:\.(\d+))?$/);
  if (!match) {
    return { valid: false, baseUnits: 0n, error: 'Invalid numerical format.' };
  }

  const wholeStr = match[1] || '0';
  const fracStr = match[2] || '';

  if (fracStr.length > USDC_DECIMALS) {
    return {
      valid: false,
      baseUnits: 0n,
      error: `Maximum precision is ${USDC_DECIMALS} decimal places. Found ${fracStr.length}.`,
    };
  }

  try {
    const whole = BigInt(wholeStr);
    const paddedFrac = (fracStr + '000000').slice(0, USDC_DECIMALS);
    const frac = BigInt(paddedFrac);

    const baseUnits = whole * USDC_BASE_FACTOR + frac;
    if (baseUnits === 0n) {
      return { valid: false, baseUnits: 0n, error: 'Amount must be greater than zero.' };
    }

    return { valid: true, baseUnits };
  } catch {
    return { valid: false, baseUnits: 0n, error: 'Calculation overflow or invalid digits.' };
  }
}

/**
 * Formats 6-decimal USDC base units into standard human-readable format.
 * Includes thousands separators and precise decimals.
 */
export function formatUsdc(baseUnits: bigint, options?: { minDecimals?: number }): string {
  const isNegative = baseUnits < 0n;
  const abs = isNegative ? -baseUnits : baseUnits;

  const whole = abs / USDC_BASE_FACTOR;
  const frac = abs % USDC_BASE_FACTOR;

  let fracStr = frac.toString().padStart(USDC_DECIMALS, '0');
  const minDec = options?.minDecimals ?? 2;

  // Trim trailing zeros beyond minDecimals
  while (fracStr.length > minDec && fracStr.endsWith('0')) {
    fracStr = fracStr.slice(0, -1);
  }

  const wholeFormatted = whole.toLocaleString('en-US');
  const result = `${wholeFormatted}.${fracStr}`;
  return isNegative ? `-${result}` : result;
}

/**
 * Formats native gas units (18 decimals) into human-readable string.
 */
export function formatNativeGas(baseUnits: bigint): string {
  const whole = baseUnits / NATIVE_BASE_FACTOR;
  const frac = baseUnits % NATIVE_BASE_FACTOR;
  const fracStr = frac.toString().padStart(NATIVE_GAS_DECIMALS, '0').slice(0, 6); // show first 6 places
  return `${whole.toLocaleString('en-US')}.${fracStr}`;
}

/**
 * Calculates sum of an array of base units safely.
 */
export function sumAmounts(amounts: bigint[]): bigint {
  return amounts.reduce((acc, curr) => acc + curr, 0n);
}

/**
 * Strict checksum address validation.
 */
export function validateRecipientAddress(address: string): { valid: boolean; normalized?: `0x${string}`; error?: string } {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }

  const trimmed = address.trim();
  if (!trimmed.startsWith('0x') || trimmed.length !== 42) {
    return { valid: false, error: 'Must be a 42-character hex address starting with 0x' };
  }

  if (!isAddress(trimmed)) {
    return { valid: false, error: 'Invalid EVM address checksum or format' };
  }

  try {
    const checksummed = getAddress(trimmed);
    if (checksummed === '0x0000000000000000000000000000000000000000') {
      return { valid: false, error: 'Zero address (0x0) cannot receive payouts' };
    }
    return { valid: true, normalized: checksummed };
  } catch {
    return { valid: false, error: 'Invalid checksum address' };
  }
}
