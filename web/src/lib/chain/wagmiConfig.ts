import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { arcMainnet } from './arcChain';

export const config = createConfig({
  chains: [arcMainnet],
  connectors: [
    injected({
      target: 'metaMask',
    }),
    injected(),
  ],
  transports: {
    [arcMainnet.id]: http('https://rpc.mainnet.arc.io'),
  },
});
