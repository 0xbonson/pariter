export const ARC_CHAIN_ID = 5042;

/**
 * Canonical ERC-20 interface address for native USDC on Arc Mainnet.
 * 6 decimal places.
 */
export const ARC_USDC_ERC20_ADDRESS = '0x3600000000000000000000000000000000000000' as const;

/**
 * BatchPayout contract deployment on Arc Mainnet.
 * Can be overridden via VITE_BATCH_PAYOUT_ADDRESS environment variable.
 */
export const BATCH_PAYOUT_ADDRESS = (
  import.meta.env.VITE_BATCH_PAYOUT_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`;
