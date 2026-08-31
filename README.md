# BidLens Core — CreateOS launch package

BidLens Core is a stateless, deterministic MCP and REST service that turns user-supplied RFP, RFQ, tender, and solicitation text into:

- a `GO`, `CONDITIONAL GO`, `HOLD`, or `NO-GO` recommendation;
- a mandatory knockout screen;
- an explainable weighted score range;
- deadline, NAICS, set-aside, credential, and contract-value signals;
- a source-line compliance matrix;
- evidence gaps and the five highest-value next actions.

It makes **zero external AI calls**, needs **no paid API key**, and deliberately marks missing company facts `UNKNOWN`. That keeps marginal cost low enough for metered marketplace calls and avoids inventing credentials or past performance.

## Run locally

Requires Node.js 20 or newer.

```bash
npm test
npm run check
npm start
```

Test the REST endpoint:

```bash
curl -s http://localhost:8080/v1/analyze \
  -H 'content-type: application/json' \
  --data @samples/sample-input.json
```

Test the MCP process:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node src/mcp.js
```

## Deploy

The repository is ready for CreateOS file upload, GitHub, or Docker deployment.

- Runtime: Node.js 22
- Service command: `node src/server.js`
- Port: `8080` (or the platform-provided `PORT`)
- Health check: `GET /health`
- Discovery manifest: `mcp-tool.json`
- Discovery route: `GET /.well-known/mcp-tool.json`
- OpenAPI: `GET /openapi.json`
- No secrets or environment variables required

The current public CreateOS documentation says a root `mcp-tool.json` is exposed through the standard well-known discovery route. This package also serves that route directly for portability.

## Suggested marketplace configuration

- Title: **BidLens Core — RFP Knockout & Compliance API**
- Category: AI Agents / Developer Tools / Business Operations
- Skill price: **5 credits per full analysis** ($0.05 gross)
- Secondary compliance extraction: **3 credits** if per-tool pricing is available
- Template price: **$19 one time**
- Free trial: 3 calls, if the current publishing form supports it

Do not imply a guaranteed compliant bid or probability of winning. Keep the responsible-use caveat in the listing.

## Company profile fields

All fields are optional, but more evidence narrows the score range:

- `services`, `keywords`
- `licenses`, `certifications`, `clearances`, `registrations`
- `set_asides`, `states`
- `known_absences`
- `complete_fields` — only use when a category inventory is genuinely complete
- `win_signals`, `competitive_risks`
- `delivery_capacity`
- `minimum_contract_value`, `minimum_margin_percent`, `minimum_days_to_bid`
- `past_performance`, `evidence_notes`

## Safety and privacy

- Solicitation text is treated as untrusted data; prompt-injection-like text is flagged and ignored.
- No source text is intentionally persisted by the service.
- No credential, reference, date, page number, or company claim is invented.
- Automated review can miss scanned tables, images, portal-only instructions, and later amendments.
- A human signer must verify the final response against the official solicitation and amendments.

## Package map

- `src/analysis.js` — deterministic analysis engine
- `src/server.js` — zero-dependency REST server
- `src/mcp.js` — zero-dependency MCP stdio server
- `mcp-tool.json` — marketplace/discovery tool manifest
- `openapi.json` — REST API description
- `test/analysis.test.js` — publication regression tests
- `marketplace-listing.md` — paste-ready listing copy
- `launch-checklist.md` — owner-gate handoff
- `opportunity-review.md` — current market comparison and evidence

## License

MIT. The marketplace listing name and artwork remain product branding, not a transfer of third-party trademarks.
