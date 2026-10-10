export const batchPayoutAbi = [
  {
    type: 'constructor',
    inputs: [{ name: '_usdc', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'MAX_BATCH_SIZE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'executeBatch',
    inputs: [
      { name: 'recipients', type: 'address[]', internalType: 'address[]' },
      { name: 'amounts', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'batchId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'referenceCommitment', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: 'totalTransferred', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasBatchExecuted',
    inputs: [
      { name: 'payer', type: 'address', internalType: 'address' },
      { name: 'batchId', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isBatchExecuted',
    inputs: [
      { name: 'payer', type: 'address', internalType: 'address' },
      { name: 'batchId', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IERC20' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BatchSettled',
    inputs: [
      { name: 'payer', type: 'address', indexed: true, internalType: 'address' },
      { name: 'batchId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'referenceCommitment', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'recipientCount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'totalTransferred', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PayoutExecuted',
    inputs: [
      { name: 'payer', type: 'address', indexed: true, internalType: 'address' },
      { name: 'batchId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'recipient', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'index', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;
