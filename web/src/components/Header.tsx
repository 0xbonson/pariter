import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { arcMainnet } from '../lib/chain/arcChain';
import { Wallet, LogOut, AlertTriangle, ExternalLink } from 'lucide-react';

interface HeaderProps {
  activeTab: 'payout' | 'verify' | 'docs';
  onTabChange: (tab: 'payout' | 'verify' | 'docs') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [walletConnectError, setWalletConnectError] = useState<string | null>(null);

  const isWrongNetwork = isConnected && chainId !== arcMainnet.id;

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleConnect = () => {
    setWalletConnectError(null);
    if (!connectors || connectors.length === 0 || !connectors[0]) {
      setWalletConnectError('No Web3 wallet extension found. Please install MetaMask or Rabby.');
      return;
    }
    connect(
      { connector: connectors[0] },
      {
        onError: (err) => {
          if (err.message.includes('User rejected') || err.message.includes('rejected')) {
            setWalletConnectError('Connection request rejected in wallet.');
          } else {
            setWalletConnectError(err.message || 'Failed to connect wallet.');
          }
        },
      }
    );
  };

  return (
    <header className="border-b border-[#E4E7EC] bg-white sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & Wordmark */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('payout')}>
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Pariter Logo" className="w-8 h-8 rounded" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-lg text-[#0F172A]">PARITER</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                  Arc Mainnet
                </span>
              </div>
              <p className="text-xs text-[#64748B] hidden sm:block">Atomic USDC Settlement</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 border-l border-[#E4E7EC] pl-6 h-8">
            <button
              onClick={() => onTabChange('payout')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'payout'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              New Payout
            </button>
            <button
              onClick={() => onTabChange('verify')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'verify'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Verify Settlement
            </button>
            <button
              onClick={() => onTabChange('docs')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'docs'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Specifications
            </button>
          </nav>
        </div>

        {/* Right Controls: Network status & Wallet */}
        <div className="flex items-center space-x-3">
          {/* Network indicator */}
          <div className="hidden lg:flex items-center space-x-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Chain ID 5042</span>
          </div>

          {isWrongNetwork ? (
            <button
              onClick={() => switchChain({ chainId: arcMainnet.id })}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Switch to Arc</span>
            </button>
          ) : isConnected && address ? (
            <div className="flex items-center space-x-2">
              <a
                href={`https://explorer.arc.io/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-100 transition-colors"
                title="View on Arc Explorer"
              >
                <span>{truncateAddress(address)}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <button
                onClick={() => disconnect()}
                aria-label="Disconnect wallet"
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors focus-visible:ring-1 focus-visible:ring-red-500"
                title="Disconnect wallet"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isPending}
              aria-label="Connect wallet"
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{isPending ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Wallet Connection Error Banner */}
      {walletConnectError && (
        <div className="bg-red-50 border-t border-red-200 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
            <span>{walletConnectError}</span>
          </div>
          <button
            onClick={() => setWalletConnectError(null)}
            className="text-red-600 hover:text-red-900 font-bold ml-3 text-sm px-1 leading-none"
            aria-label="Dismiss wallet error"
          >
            ×
          </button>
        </div>
      )}

      {/* Mobile nav */}
      <div className="md:hidden flex border-t border-[#E4E7EC] px-4 py-2 space-x-2 bg-slate-50">
        <button
          onClick={() => onTabChange('payout')}
          className={`flex-1 py-1.5 text-xs font-medium rounded text-center ${
            activeTab === 'payout' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          New Payout
        </button>
        <button
          onClick={() => onTabChange('verify')}
          className={`flex-1 py-1.5 text-xs font-medium rounded text-center ${
            activeTab === 'verify' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          Verify
        </button>
        <button
          onClick={() => onTabChange('docs')}
          className={`flex-1 py-1.5 text-xs font-medium rounded text-center ${
            activeTab === 'docs' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          Specs
        </button>
      </div>
    </header>
  );
};
