import { type Chain } from 'viem';

export const arcMainnet: Chain = {
  id: 5042,
  name: 'Arc',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.mainnet.arc.io'],
    },
    public: {
      http: ['https://rpc.mainnet.arc.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://explorer.arc.io',
    },
  },
  contracts: {
    // Canonical native USDC ERC-20 precompile
    usdcPrecompile: {
      address: '0x3600000000000000000000000000000000000000',
    },
  },
};
