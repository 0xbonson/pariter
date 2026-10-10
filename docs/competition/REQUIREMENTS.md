# Circle Arc Microgrants 2026 — Official Competition Requirements

**Retrieval Date:** 2026-10-11  
**Sources:**  
- DoraHacks Hackathon Detail: https://dorahacks.io/hackathon/arc-microgrants/detail  
- Arc Community Portal: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq  
- Arc Network Documentation: https://docs.arc.io/  
- Circle Developer Platform: https://developers.circle.com/  

---

## 1. Program Overview & Grant Structure

| Parameter | Official Specification |
| :--- | :--- |
| **Organizer / Host** | Circle on DoraHacks |
| **Program Name** | Circle Arc Microgrants 2026 |
| **Total Prize Pool** | 10,000 USDC |
| **Number of Grants** | 20 microgrants |
| **Grant Amount** | 500 USDC per selected project |
| **Review Schedule** | Rolling evaluation (applications reviewed upon receipt) |
| **Submission Deadline** | October 14, 2026 at 23:59 Eastern Time (ET) |
| **Local Time Equivalent** | October 15, 2026 at 10:59 Western Indonesia Time (WIB) |

---

## 2. Eligibility & Project Scope

- **Eligible Entities:** Independent builders, student teams, open-source contributors, hackathon participants, early-stage product teams.
- **Corporate Requirement:** None. No company registration, pitch deck, formal business plan, or existing venture traction required.
- **Eligible Project Types:** Functioning prototypes, focused micro-applications, technical experiments, developer utilities, and clear onchain proofs-of-concept.
- **Ineligible Submissions:** Pure pitch decks with no running software, projects deployed only on testnet, speculative tokens, mock-up only prototypes without verifiable onchain logic.

---

## 3. Mandatory Technical Requirements

1. **Target Blockchain:** **Arc Mainnet** (Chain ID: `5042`). Testnet-only deployments are not eligible.
2. **Native Gas Currency:** Arc uses **USDC as its native gas currency** with 18 decimal places.
3. **ERC-20 Interface:** The canonical native USDC ERC-20 contract is located at `0x3600000000000000000000000000000000000000` (6 decimal places).
4. **Public Repository:** The source code must be openly available in a clean public git repository containing build and verification instructions.
5. **Live Working Frontend:** Reviewers must be able to load a functional web application hosted on a public HTTPS domain.
6. **Verifiable Settlement:** Reviewers must be able to inspect real transactions executed on the Arc Mainnet via `https://explorer.arc.io` or direct JSON-RPC (`https://rpc.mainnet.arc.io`).

---

## 4. Evaluation Criteria

- **Arc Relevance:** Does the project leverage Arc's distinct architectural benefits (USDC as gas, high throughput, zero wrapping friction for USDC)?
- **Technical Credibility:** Is the implementation secure, well-tested, mathematically sound (avoiding floating-point inaccuracies), and atomic?
- **Implementation Quality:** Does the software deliver a refined, error-tolerant experience with verified receipts and clear states?
- **Continuity Potential:** Does this solve a genuine operational bottleneck (e.g., contributor compensation, grant disbursements) that deserves continued development?

---

## 5. Regulatory & Jurisdictional Notes

- Participation must adhere to standard DoraHacks and Circle terms of service.
- Sanctioned jurisdictions and restricted regions are excluded.
- The project must not operate custodial fund management, speculative token offerings, or unlicensed financial services.
