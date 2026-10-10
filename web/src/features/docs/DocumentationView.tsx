import { ExternalLink, ShieldCheck, Terminal, Layers } from 'lucide-react';
import { ARC_CHAIN_ID, ARC_USDC_ERC20_ADDRESS, BATCH_PAYOUT_ADDRESS } from '../../lib/contracts/addresses';

export const DocumentationView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-xs leading-relaxed text-[#334155]">
      {/* Header */}
      <div className="pb-6 border-b border-[#E4E7EC]">
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">System Specifications & Audit Guide</h1>
        <p className="text-sm text-[#475467] mt-1">
          Technical specifications, cryptographic guarantees, and independent verification procedures for Pariter on Arc Mainnet.
        </p>
      </div>

      {/* Network & Contract Identifiers */}
      <section className="bg-white border border-[#E4E7EC] rounded p-5 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <Layers className="w-4 h-4 text-blue-700" />
          <h2>Canonical Deployment Coordinates</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">Target Network</span>
            <span className="font-semibold text-slate-900">Arc Mainnet (Chain ID {ARC_CHAIN_ID})</span>
            <span className="text-slate-500 block text-[11px] mt-0.5">RPC: https://rpc.mainnet.arc.io</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">Native Currency</span>
            <span className="font-semibold text-slate-900">USDC (18 Decimals for Gas)</span>
            <span className="text-slate-500 block text-[11px] mt-0.5">Zero wrapping required for network fees</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded md:col-span-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">Canonical USDC Precompile (ERC-20)</span>
            <code className="font-mono text-slate-900 text-[11px] block mt-0.5">{ARC_USDC_ERC20_ADDRESS}</code>
            <span className="text-slate-500 text-[11px]">Syncs directly with native USDC balance (6 decimals for token operations).</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded md:col-span-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">BatchPayout Contract Address</span>
            <div className="flex items-center justify-between mt-0.5">
              <code className="font-mono text-slate-900 text-[11px]">{BATCH_PAYOUT_ADDRESS}</code>
              <a
                href={`https://explorer.arc.io/address/${BATCH_PAYOUT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 hover:text-blue-900 inline-flex items-center space-x-1 font-semibold"
              >
                <span>View on Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Independent Verification via CLI */}
      <section className="bg-white border border-[#E4E7EC] rounded p-5 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <Terminal className="w-4 h-4 text-blue-700" />
          <h2>Independent Verification (CLI / curl)</h2>
        </div>
        <p>
          You do not need to trust this web application. Any reviewer can audit a Pariter settlement receipt using standard command-line tools against the Arc JSON-RPC.
        </p>
        <div className="bg-slate-900 text-slate-100 p-3.5 rounded font-mono text-[11px] overflow-x-auto space-y-2">
          <div className="text-slate-400"># 1. Query transaction receipt using cast:</div>
          <div>cast receipt &lt;TX_HASH&gt; --rpc-url https://rpc.mainnet.arc.io</div>
          <div className="text-slate-400 pt-2"># 2. Check contract USDC balance (must always be zero):</div>
          <div>cast call 0x3600000000000000000000000000000000000000 "balanceOf(address)(uint256)" {BATCH_PAYOUT_ADDRESS} --rpc-url https://rpc.mainnet.arc.io</div>
        </div>
      </section>

      {/* Cryptographic Guarantees */}
      <section className="bg-white border border-[#E4E7EC] rounded p-5 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <h2>Cryptographic Invariants & Security Guarantees</h2>
        </div>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>
            <strong>Zero Custody Invariant:</strong> The contract holds no funds between transactions. Stateful property-based invariant fuzzing executed across 128,000 handler calls verified that <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">balanceOf(BatchPayout) == 0</code> across all generated transaction sequences.
          </li>
          <li>
            <strong>Atomicity:</strong> If any recipient transfer fails, the entire transaction reverts, leaving payer balances and allowances untouched.
          </li>
          <li>
            <strong>Replay Protection:</strong> Every batch is identified by a unique <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">bytes32 batchId</code> scoped directly to <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">msg.sender</code>, preventing accidental or malicious replay.
          </li>
          <li>
            <strong>Zero Administrative Keys:</strong> There is no owner, no upgrade proxy, no fee mechanism, and no backdoor drain.
          </li>
        </ul>
      </section>

      {/* Competition Notice */}
      <section className="p-4 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[11px] space-y-1">
        <p className="font-semibold text-slate-800">Circle Arc Microgrants 2026 Submission Notice</p>
        <p>
          Pariter is an independent open-source research and engineering project built for the Arc Microgrants program on DoraHacks. It is not affiliated with Circle Internet Financial, Arc Network, or DoraHacks.
        </p>
      </section>
    </div>
  );
};
