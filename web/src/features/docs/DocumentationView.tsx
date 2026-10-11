import React from 'react';
import { ExternalLink, ShieldCheck, Layers, Scale, DollarSign, FileCheck } from 'lucide-react';
import {
  ARC_CHAIN_ID,
  ARC_USDC_ERC20_ADDRESS,
  BATCH_PAYOUT_ADDRESS,
  IS_MAINNET_DEPLOYED,
  EXPECTED_BATCH_PAYOUT_RUNTIME_CODEHASH,
} from '../../lib/contracts/addresses';
import { SETTLEMENT_LEGAL_DISCLAIMER } from '../verification/settlementVerification';

export const DocumentationView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-xs leading-relaxed text-[#334155]">
      {/* Header */}
      <div className="pb-6 border-b border-[#E4E7EC]">
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">System Specifications & Audit Guide</h1>
        <p className="text-sm text-[#475467] mt-1">
          Technical specifications, cryptographic guarantees, gas economics, and independent verification procedures for Pariter on Arc Mainnet.
        </p>
      </div>

      {/* Positioning & Competitive Landscape */}
      <section className="bg-white border border-[#E4E7EC] rounded p-5 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <Scale className="w-4 h-4 text-blue-700" />
          <h2>Positioning & Competitive Landscape</h2>
        </div>
        <p>
          <strong>Pariter</strong> is an open-source, non-custodial USDC batch payout and independent settlement verification tool designed specifically for small teams, grant programs, and contributor communities on Arc Mainnet.
        </p>
        <p className="text-slate-600">
          Batch transfers and settlement verification are established primitives in Web3. Pariter does not claim to have invented batch transfers or receipt verification. Several capable solutions exist across the ecosystem:
        </p>
        <div className="border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px]">
                <th className="py-2.5 px-3">Tool / Platform</th>
                <th className="py-2.5 px-3">Target Audience</th>
                <th className="py-2.5 px-3">Architecture & Pricing</th>
                <th className="py-2.5 px-3">Key Trade-off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-semibold text-slate-900">Pariter (This project)</td>
                <td className="py-2 px-3">Small teams, grant organizers, bounties</td>
                <td className="py-2 px-3">100% open-source, <strong>$0 protocol fee</strong>, pure client-side</td>
                <td className="py-2 px-3 text-slate-500">Focused exclusively on Arc USDC; no multi-token or fiat off-ramps</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-semibold text-slate-900">payrail</td>
                <td className="py-2 px-3">DAOs, operations teams</td>
                <td className="py-2 px-3">USDC/EURC batches, maker/checker multisig, SaaS backend</td>
                <td className="py-2 px-3 text-slate-500">Hosted platform with managed infrastructure</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-semibold text-slate-900">Arctools Multisender</td>
                <td className="py-2 px-3">General token airdrops</td>
                <td className="py-2 px-3">Multi-token sender, published per-batch service fee</td>
                <td className="py-2 px-3 text-slate-500">Charges platform service fee per dispersal batch</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-semibold text-slate-900">Request Finance</td>
                <td className="py-2 px-3">Enterprises, corporate finance</td>
                <td className="py-2 px-3">Full-suite crypto invoicing, multi-chain, accounting sync</td>
                <td className="py-2 px-3 text-slate-500">Enterprise subscription SaaS; heavyweight setup</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-semibold text-slate-900">Ryntra</td>
                <td className="py-2 px-3">Audit & compliance teams</td>
                <td className="py-2 px-3">Verifiable payment receipt and proof engine</td>
                <td className="py-2 px-3 text-slate-500">Enterprise verification infrastructure</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Gas Economics & Real Fee Breakdown */}
      <section className="bg-white border border-[#E4E7EC] rounded p-5 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <DollarSign className="w-4 h-4 text-emerald-700" />
          <h2>Gas Economics & Fee Transparency</h2>
        </div>
        <p>
          On Arc Mainnet, gas fees are paid directly in native USDC (18 decimals). Pariter discloses all base transaction overheads honestly so teams understand the trade-offs between individual transfers and atomic batch execution:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">1-Time ERC-20 Approval</span>
            <span className="font-mono text-sm font-bold text-slate-900 mt-1 block">~45,000 gas</span>
            <span className="text-slate-500 text-[11px]">~0.0009 USDC at 20 gwei. Required once per payer allowance.</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">Single Individual Transfer</span>
            <span className="font-mono text-sm font-bold text-slate-900 mt-1 block">~29,000 gas</span>
            <span className="text-slate-500 text-[11px]">~0.00058 USDC per single recipient. No contract loop overhead.</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">Atomic Batch Payout</span>
            <span className="font-mono text-sm font-bold text-slate-900 mt-1 block">Base ~36k + ~28k/recip</span>
            <span className="text-slate-500 text-[11px]">Guarantees all-or-nothing atomicity. 50 recipients settle in 1 tx.</span>
          </div>
        </div>
        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded text-[11px] text-blue-900">
          <strong>Efficiency Guideline:</strong> For 1 single recipient, a standard wallet transfer is slightly cheaper because it skips the contract base entry and Net Balance Conservation check. For 5 or more recipients, atomic batching provides major operational savings by eliminating dozens of separate wallet signatures and preventing partial execution failures.
        </div>
      </section>

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
              {IS_MAINNET_DEPLOYED ? (
                <>
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
                </>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded">
                    Pending Mainnet Deployment
                  </span>
                  <span className="text-slate-400 text-[11px]">(Contract not yet deployed to Arc Mainnet)</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded md:col-span-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">Compiled Runtime Bytecode Hash (Keccak256)</span>
            <code className="font-mono text-slate-900 text-[11px] block mt-0.5 break-all">{EXPECTED_BATCH_PAYOUT_RUNTIME_CODEHASH}</code>
            <span className="text-slate-500 text-[11px]">Compiled with Solidity 0.8.37 (cancun, 200 runs). Verified during every public receipt audit.</span>
          </div>
        </div>
      </section>

      {/* Independent Verification & Proof Pack Bundle */}
      <section className="bg-white border border-[#E4E7EC] rounded p-5 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <FileCheck className="w-4 h-4 text-emerald-700" />
          <h2>Independent Proof Pack & CLI Auditing</h2>
        </div>
        <p>
          You do not need to trust this web application. Any auditor can independently audit a Pariter settlement receipt using standard command-line tools or export an inspectable Proof Pack bundle:
        </p>
        <div className="bg-slate-900 text-slate-100 p-3.5 rounded font-mono text-[11px] overflow-x-auto space-y-2">
          <div className="text-slate-400"># 1. Query transaction receipt and execution logs using cast:</div>
          <div>cast receipt &lt;TX_HASH&gt; --rpc-url https://rpc.mainnet.arc.io</div>
          <div className="text-slate-400 pt-2"># 2. Verify runtime bytecode matches expected compiled codehash:</div>
          <div>cast code {BATCH_PAYOUT_ADDRESS} --rpc-url https://rpc.mainnet.arc.io | cast keccak</div>
          <div className="text-slate-400 pt-2"># 3. Reconcile canonical ERC-20 USDC transfers against BatchSettled event:</div>
          <div># Verify that totalTransferred in BatchSettled matches inbound payer transfer and outbound recipient transfers</div>
        </div>
        <div className="p-3.5 rounded bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-start space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Proof Pack Export:</strong> The Public Settlement Verifier allows export of machine-readable <code className="font-mono">pariter-proof-pack.json</code> bundles and <code className="font-mono">pariter-reconciliation.csv</code> reports containing cryptographic event logs, runtime bytecode hashes, and 1-to-1 integer reconciliation evidence.
          </div>
        </div>
      </section>

      {/* Cryptographic Guarantees & Token Accounting */}
      <section className="bg-white border border-[#E4E7EC] rounded p-5 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <h2>Cryptographic Invariants & Dual-Unit Accounting</h2>
        </div>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>
            <strong>Dual-Unit Separation on Arc:</strong> Arc uses native USDC (18 decimals, standard EVM wei format) for network execution gas fees, while application balances and transfers utilize the canonical 6-decimal precompile at <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">0x3600000000000000000000000000000000000000</code>. Pariter enforces strict separation and uses integer <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">bigint</code> math with zero floating-point conversions.
          </li>
          <li>
            <strong>Net Balance Conservation Invariant:</strong> The contract retains zero net USDC from any batch execution. It enforces an atomic post-execution conservation check (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">balanceAfter == balanceBefore</code>). All authorized payer funds are fully disbursed to recipients, while remaining resilient against griefing attacks where third parties transfer unsolicited tokens directly to the contract.
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

      {/* Legal & Factual Disclaimer */}
      <section className="p-4 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[11px] space-y-2">
        <p className="font-semibold text-slate-800">Legal & Technical Boundaries</p>
        <p>{SETTLEMENT_LEGAL_DISCLAIMER}</p>
        <p className="text-slate-500 pt-1">
          Circle Arc Microgrants 2026 Submission: Pariter is an independent open-source research and engineering project built for the Arc Microgrants program on DoraHacks. It is not affiliated with Circle Internet Financial, Arc Network, or DoraHacks.
        </p>
      </section>
    </div>
  );
};
