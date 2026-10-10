import { describe, it, expect } from 'vitest';
import { encodeEventTopics, encodeAbiParameters, parseAbiParameters, keccak256, toHex } from 'viem';
import { batchPayoutAbi } from '../../lib/contracts/batchPayoutAbi';
import { formatUsdc } from '../../lib/money/usdc';

describe('Settlement Event Decoding & Receipt Parsing', () => {
  it('correctly formats and reconciles batch total amounts', () => {
    const rawTotal = 1_000_000_000n; // 1,000 USDC
    expect(formatUsdc(rawTotal)).toBe('1,000.00');
  });

  it('correctly hashes and commitments for memos', () => {
    const memo = 'Core Contributor Grant Oct 2026';
    const commitment = keccak256(toHex(memo));
    expect(commitment).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('verifies event signatures match BatchSettled and PayoutExecuted', () => {
    const batchSettledTopic = encodeEventTopics({
      abi: batchPayoutAbi,
      eventName: 'BatchSettled',
    });
    expect(batchSettledTopic[0]).toBe('0x114edc483cfa264c35c0e7100579164fd7f40072439b1545d7b8c53abf70d5df');

    const payoutExecutedTopic = encodeEventTopics({
      abi: batchPayoutAbi,
      eventName: 'PayoutExecuted',
    });
    expect(payoutExecutedTopic[0]).toBe('0xd56d9cc3140b53c279710baeab6c5fa48ba65d8c26fb7db989c230f46a25b69c');
  });
});
