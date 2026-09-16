# Arrey — Arc Testnet payments

Wallet-signed Circle USDC transfers and shared checkout. This release replaces the temporary simulated payment state with onchain records. No private key or custodial API secret is shipped in the website.

## Included

- EIP-6963 browser-wallet discovery, explicit account connection and Arc network switching.
- Direct ERC-20 USDC transfers, fee review, real receipts and ArcScan links.
- Shared bills: full, suggested equal or custom contributions; exact settlement to the creator's wallet only when fully funded.
- Merchant cancellation and contributor-claimed refunds after cancellation or expiry. Direct transfers and settled bills cannot be reversed.
- QR and share links including the verified registry address. Any device can read the same onchain bill.
- History shows wallet-linked onchain checkouts in pages of 20, with current status and amounts read from the contract. Confirmed checkout actions and direct-send receipts made through this browser are also saved per wallet on this device, deduplicated by transaction hash. ArcScan is the complete transaction record, including actions from other devices or wallets. Local receipt dates are recorded after confirmation, not claimed as onchain block timestamps. The v1 contract does not expose creation or update timestamps in its bill getter.
- Circle Bridge Kit + viem adapter for Ethereum Sepolia / Base Sepolia to Arc Testnet through CCTP. Official faucet link; incomplete bridge progress and returned recovery data are persisted locally so the same wallet can resume when Circle returns a retryable result.
- Responsive desktop layout, phone bottom navigation, single-column payment forms, readable inputs, reduced motion and keyboard dialogs.

## Run

Node.js 22+, then `npm install`, `npm run build`, `npm run dev`. Build output is `dist`; source is `web`. Contracts compile before each build using the locked Solidity compiler, optimizer 200, EVM Paris target.

`npm test` runs money parsing, gas-budget conversion and multi-wallet escrow lifecycle tests on a local EVM with a USDC fixture at Arc's address. It covers overpayment, unauthorized cancellation, refund ownership, expiry, duplicate refunds and failed-settlement rollback. These tests do not emulate Arc's native USDC precompile or prove production safety.

`npm run check:arc` verifies the live network ID and USDC decimals. `node scripts/deploy-testnet.mjs --status` reads the isolated test wallet balance. No transaction is sent by either command.

## Configure / deploy the checkout contract

The site can deploy and verify the exact checkout contract from the connected browser wallet under Network & contract. Fund that wallet with free Arc Testnet USDC first. The resulting share links include the registry address. The app checks runtime bytecode before requesting approvals.

For the automated test deployment, `node scripts/test-wallet.mjs` creates an ignored `.test-wallet.json` and prints only its address. Fund it from Circle Faucet, then run `node scripts/deploy-testnet.mjs`. This script refuses any network except 5042002, deploys at most one registry recorded in `public/deployment.json`, and exercises real testnet settlement/refund/direct-transfer calls using tiny test-token amounts. It writes the verified default address to `web/deployment.js`; rebuild afterwards. Never commit or publish `.test-wallet.json`.

Optional `.env.local` public build settings:

```env
VITE_ARREY_CONTRACT=0xYourVerifiedArcTestnetContract
VITE_WALLETCONNECT_PROJECT_ID=yourPublicReownProjectId
```

Without a Reown project ID, desktop injected wallets and mobile wallets' built-in browsers work; a normal mobile-browser WalletConnect QR connection is unavailable. There are no secret VITE variables.

## Arc / Circle integration

Arc Testnet: chain 5042002, RPC `https://rpc.testnet.arc.io`, explorer `https://testnet.arcscan.app`. Canonical USDC ERC-20 address: `0x3600000000000000000000000000000000000000` (6 decimals). Native gas uses the same USDC balance with 18-decimal units. The app displays a single balance and uses BigInt for money.

Circle Bridge Kit resolves CCTP contracts, approvals, burn, attestation and mint. Bridging funds the user's Arc wallet; a checkout payment remains a separate explicit signature. The source wallet needs test ETH; Arc mint transactions need Arc USDC gas. Bridge progress and recovery state are written to localStorage and sessionStorage as Circle emits updates. Keep the same wallet available when resuming an incomplete bridge. If Circle has not yet returned a retryable result, use the recorded source transaction with Circle's CCTP tooling rather than starting a duplicate transfer. Cross-chain end-to-end execution requires source-chain test tokens and gas and has not been verified by the local contract suite.

Circle custodial Wallets, fiat onboarding and enterprise payment APIs are not configured. This architecture deliberately uses the user's EVM wallet and the official Circle SDK without server-held keys. Multi-seller splits, batch sends, fiat/card checkout and cancellation windows on direct transfers are not implemented in this release.

Authoritative references:
- https://docs.arc.io/arc/references/connect-to-arc
- https://docs.arc.io/arc/references/contract-addresses
- https://docs.arc.io/app-kit/quickstarts/bridge-tokens-across-blockchains
- https://github.com/circlefin/docs-examples/tree/master/app-kit-bridge-evm
- https://faucet.circle.com/

## Deployment status and limits

If `web/deployment.js` is empty and `public/deployment.json` does not exist, the automated deployment is still waiting for test-wallet funding. The website clearly shows setup is required; it never invents a successful transaction or checkout.

The shared-checkout journeys can be verified by the local contract suite, but live checkout creation, contribution, cancellation and refund require a funded Arc Testnet wallet and a verified deployment. The Circle bridge also needs source-chain test USDC and gas. Neither flow has been claimed as live end-to-end verified until those prerequisites are supplied.

This is unaudited testnet software. Bills and wallet contributions are public onchain; business names are self-declared. The registry has no administrator withdrawals, upgrades, or fee recipient. Users retain responsibility for verifying recipient addresses and confirming wallet requests.

The dependency audit includes advisories in upstream Circle/WalletConnect dependencies and the local Ganache toolchain; do not treat this test release as a cleared mainnet dependency audit. WalletConnect and Circle bridge code load on demand; Ganache is development-only and is never bundled in the site.

Sites hosting reuses `.openai/hosting.json`. Only the `dist` static artifact is published; tests, private wallet files, and local deployment scripts are excluded from the hosted artifact.
