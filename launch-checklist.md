# Launch checklist — stop at owner gates

The code, tests, manifest, API definition, listing, sample, container configuration, and pricing recommendation are complete. The remaining actions require the owner's account authority or public-publishing approval.

## 1. Account and terms gate

1. Create or sign in to a CreateOS account.
2. Review and accept the current platform, marketplace, payout, tax, and data terms.
3. Confirm that the $0 tier still permits marketplace publication and one always-on project before proceeding.
4. Complete any identity or payout verification the live account requires. The public documentation reviewed for this package did not expose the exact cash-withdrawal method, so verify it in the dashboard before relying on revenue.

## 2. Deploy

Choose one reversible route:

- Upload the contents of this package as a Node.js 22 project; or
- put the package in a GitHub repository and connect that repository; or
- build from the included `Dockerfile`.

Configure:

- Start command: `node src/server.js`
- Port: `8080` / platform `PORT`
- Health route: `/health`
- No environment secrets

Do not use the separate on-chain Machine Payments deployment route; the signed-in $0 account route is the intended no-spend path.

## 3. Verify the live deployment

1. `GET /health` returns `status: ok`.
2. `GET /.well-known/mcp-tool.json` returns both tools.
3. `GET /openapi.json` loads.
4. Run `samples/sample-input.json` through `POST /v1/analyze`.
5. Confirm the output includes a decision, knockouts, compliance matrix, evidence gaps, and `external_ai_calls: 0`.

## 4. Publish and monetize

1. Create a marketplace Skill from the deployment.
2. Paste `marketplace-listing.md`.
3. Upload `assets/bidlens-core-icon.svg`.
4. Start at 5 credits per full analysis; use a 3-call trial only if supported.
5. If templates can be sold separately, list the deployable source at $19.
6. Keep the responsible-use text visible.
7. Public publication is a binding owner gate: review the final page, then approve it manually.

## 5. First 30-day decision rule

Do not spend on promotion. After 30 days, retain the listing if it has organic calls, saves, installs, or template interest. Change the title/keywords once if impressions exist but conversions do not. Retire it if there is no platform discovery signal; the same package remains usable on another MCP/API marketplace.
