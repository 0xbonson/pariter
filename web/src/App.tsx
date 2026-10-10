import React, { useState } from 'react';
import { Header } from './components/Header';
import { PayoutComposer } from './features/payouts/PayoutComposer';
import { ReceiptVerifier } from './features/verification/ReceiptVerifier';
import { DocumentationView } from './features/docs/DocumentationView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'payout' | 'verify' | 'docs'>('payout');

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9FB] text-[#0F172A]">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1">
        {activeTab === 'payout' && <PayoutComposer />}
        {activeTab === 'verify' && <ReceiptVerifier />}
        {activeTab === 'docs' && <DocumentationView />}
      </main>

      <footer className="border-t border-[#E4E7EC] bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">PARITER</span>
            <span>—</span>
            <span>Independent USDC Settlement Infrastructure on Arc Mainnet</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <span>Arc Mainnet (Chain ID 5042)</span>
            <span className="text-slate-300">|</span>
            <a
              href="https://explorer.arc.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-800 transition-colors"
            >
              Explorer
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="https://docs.arc.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-800 transition-colors"
            >
              Arc Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
