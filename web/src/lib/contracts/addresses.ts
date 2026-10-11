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

/**
 * Indicates whether a verified deployment address is configured.
 */
export const IS_MAINNET_DEPLOYED =
  BATCH_PAYOUT_ADDRESS !== '0x0000000000000000000000000000000000000000';

/**
 * Maximum recipient limit enforced by the BatchPayout smart contract.
 */
export const MAX_BATCH_RECIPIENTS = 250;

/**
 * Expected runtime codehash (keccak256) of BatchPayout compiled with solc 0.8.37 (cancun, 200 runs)
 * and immutable Arc canonical USDC precompile (0x3600000000000000000000000000000000000000).
 */
export const EXPECTED_BATCH_PAYOUT_RUNTIME_CODEHASH = (
  import.meta.env.VITE_EXPECTED_RUNTIME_CODEHASH ||
  '0x2f07db6a943509dc0879fea7f223d2cdd33b855a6699dc5872984b4987dbc66e'
) as `0x${string}`;

/**
 * Expected runtime bytecode length in bytes (2345 bytes / 4690 hex characters without 0x).
 */
export const EXPECTED_BATCH_PAYOUT_BYTECODE_LENGTH = 2345;
