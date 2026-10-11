import { isAddress, getAddress } from 'viem';
import { MAX_BATCH_RECIPIENTS, BATCH_PAYOUT_ADDRESS } from '../../lib/contracts/addresses';
import { parseUsdc } from '../../lib/money/usdc';
import { RecipientRow } from './PayoutComposer';

export interface ParseImportResult {
  rows: RecipientRow[];
  error?: string;
  duplicateCount?: number;
  duplicateAddresses?: string[];
  hasHeaderRow?: boolean;
}

/**
 * Parses a single CSV or TSV line respecting quoted fields and escaped quotes ("").
 */
export function splitCsvFields(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  // Detect tab vs comma if tabs exist and commas do not
  const delimiter = !line.includes(',') && line.includes('\t') ? '\t' : ',';

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter || (delimiter === ',' && char === '\t')) {
        fields.push(current.trim());
        current = '';
        i++;
        continue;
      } else {
        current += char;
        i++;
        continue;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Checks whether the first parsed row represents a header column row.
 */
function isHeaderRow(fields: string[]): boolean {
  if (fields.length === 0) return false;
  const first = fields[0].toLowerCase().replace(/[^a-z]/g, '');
  const second = fields.length > 1 ? fields[1].toLowerCase().replace(/[^a-z]/g, '') : '';

  const headerKeywords = ['address', 'recipient', 'wallet', 'to', 'payee', 'contributor', 'destination'];
  const amountKeywords = ['amount', 'usdc', 'value', 'payment', 'payout', 'tokens'];

  const firstIsHeader = headerKeywords.some((k) => first.includes(k));
  const secondIsAmount = amountKeywords.some((k) => second.includes(k));

  // If first field looks like a 0x address, it's definitely data, not a header
  if (fields[0].startsWith('0x') && fields[0].length === 42) {
    return false;
  }

  return firstIsHeader || secondIsAmount;
}

/**
 * Parses multi-line text input (CSV or tab-delimited) into structured recipient rows.
 * Features:
 * - Recognizes and skips optional header rows.
 * - Handles quoted CSV values and escaped quotes ("").
 * - Validates EVM address checksum & rejects zero address (0x0) and contract self address.
 * - Enforces 6-decimal fixed point precision (> 0).
 * - Flags duplicate recipients.
 * - Strictly rejects batches that exceed maxRecipients (default 250).
 */
export function parseRecipientText(
  input: string,
  maxRecipients: number = MAX_BATCH_RECIPIENTS
): ParseImportResult {
  if (!input || !input.trim()) {
    return {
      rows: [],
      error: 'No payment entries provided.',
    };
  }

  // Remove potential UTF-8 BOM
  const sanitized = input.startsWith('\uFEFF') ? input.slice(1) : input;
  const rawLines = sanitized.split(/\r?\n/);

  const parsedRows: RecipientRow[] = [];
  const addressCounts = new Map<string, number>();
  let hasHeaderRow = false;
  let lineCounter = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (!rawLine) continue;

    lineCounter++;
    const fields = splitCsvFields(rawLine);

    // Header row check on first active line
    if (lineCounter === 1 && isHeaderRow(fields)) {
      hasHeaderRow = true;
      continue;
    }

    if (fields.length < 2) {
      return {
        rows: [],
        error: `Line ${i + 1} format invalid. Expected: address, amount, [memo]`,
      };
    }

    const rawAddress = fields[0].trim();
    const rawAmount = fields[1].trim();
    const memo = fields[2] ? fields[2].trim() : '';

    // 1. Address format check
    if (!rawAddress.startsWith('0x') || rawAddress.length !== 42) {
      return {
        rows: [],
        error: `Line ${i + 1}: Invalid recipient address "${rawAddress}". Must be a 42-character hex address starting with 0x.`,
      };
    }

    if (!isAddress(rawAddress)) {
      return {
        rows: [],
        error: `Line ${i + 1}: Invalid EVM address checksum or format for "${rawAddress}".`,
      };
    }

    const checksummed = getAddress(rawAddress);
    if (checksummed === '0x0000000000000000000000000000000000000000') {
      return {
        rows: [],
        error: `Line ${i + 1}: Zero address (0x000...000) cannot receive payouts.`,
      };
    }

    // Reject payouts directly to the BatchPayout contract itself
    if (
      BATCH_PAYOUT_ADDRESS &&
      BATCH_PAYOUT_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
      checksummed.toLowerCase() === BATCH_PAYOUT_ADDRESS.toLowerCase()
    ) {
      return {
        rows: [],
        error: `Line ${i + 1}: Cannot disburse payout to the BatchPayout contract itself (${BATCH_PAYOUT_ADDRESS}).`,
      };
    }

    // 2. Amount precision and validation check
    const amountResult = parseUsdc(rawAmount);
    if (!amountResult.valid) {
      return {
        rows: [],
        error: `Line ${i + 1}: Invalid USDC amount "${rawAmount}". ${amountResult.error || 'Must be a positive decimal up to 6 decimal places.'}`,
      };
    }

    if (amountResult.baseUnits <= 0n) {
      return {
        rows: [],
        error: `Line ${i + 1}: Amount must be greater than zero. Received: "${rawAmount}".`,
      };
    }

    // Track duplicates
    const lower = checksummed.toLowerCase();
    addressCounts.set(lower, (addressCounts.get(lower) || 0) + 1);

    parsedRows.push({
      id: `import-${Date.now()}-${i}`,
      address: checksummed,
      amount: rawAmount,
      memo,
    });
  }

  if (parsedRows.length === 0) {
    return {
      rows: [],
      error: 'No valid payment entries found in input.',
    };
  }

  if (parsedRows.length > maxRecipients) {
    return {
      rows: [],
      error: `Cannot import ${parsedRows.length} recipients. The maximum allowed batch size is ${maxRecipients} recipients.`,
    };
  }

  const duplicates: string[] = [];
  addressCounts.forEach((count, addr) => {
    if (count > 1) duplicates.push(addr);
  });

  return {
    rows: parsedRows,
    hasHeaderRow,
    duplicateCount: duplicates.length,
    duplicateAddresses: duplicates,
  };
}

/**
 * Validates batch recipient count boundaries against contract limits.
 */
export function validateBatchLimits(
  count: number,
  maxRecipients: number = MAX_BATCH_RECIPIENTS
): {
  valid: boolean;
  error?: string;
} {
  if (count <= 0) {
    return { valid: false, error: 'Batch must contain at least one recipient.' };
  }
  if (count > maxRecipients) {
    return {
      valid: false,
      error: `Batch contains ${count} recipients, exceeding the maximum allowed limit of ${maxRecipients}.`,
    };
  }
  return { valid: true };
}
