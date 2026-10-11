import { MAX_BATCH_RECIPIENTS } from '../../lib/contracts/addresses';
import { RecipientRow } from './PayoutComposer';

export interface ParseImportResult {
  rows: RecipientRow[];
  error?: string;
}

/**
 * Parses multi-line text input (CSV or tab-delimited) into structured recipient rows.
 * Enforces line syntax: address, amount, [memo]
 * Strictly rejects batches that exceed maxRecipients (default 250).
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

  const lines = input.trim().split('\n');
  const parsedRows: RecipientRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Split on comma or tab
    const parts = rawLine.split(/[,\t]/).map((p) => p.trim());
    if (parts.length < 2) {
      return {
        rows: [],
        error: `Line ${i + 1} format invalid. Expected: address, amount, [memo]`,
      };
    }

    parsedRows.push({
      id: `import-${Date.now()}-${i}`,
      address: parts[0],
      amount: parts[1],
      memo: parts[2] || '',
    });
  }

  if (parsedRows.length === 0) {
    return {
      rows: [],
      error: 'No valid payment entries found.',
    };
  }

  if (parsedRows.length > maxRecipients) {
    return {
      rows: [],
      error: `Cannot import ${parsedRows.length} recipients. The maximum allowed batch size is ${maxRecipients} recipients.`,
    };
  }

  return { rows: parsedRows };
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
