# Marketplace listing

## Title

BidLens Core — RFP Knockout & Compliance API

## Short description

Turn RFP or tender text into an explainable bid/no-bid screen, mandatory knockout list, evidence gaps, deadlines, and a source-linked compliance matrix—without a paid AI API.

## Full description

Stop spending proposal hours before checking whether the opportunity is actually winnable and compliant.

BidLens Core analyzes user-supplied RFP, RFQ, tender, and solicitation text against a factual company profile. It identifies must/shall requirements first, flags expired deadlines and missing credentials, produces an explainable score range, and returns a response-ready compliance matrix with source-line citations.

### Outputs

- GO, CONDITIONAL GO, HOLD, or NO-GO decision support
- Mandatory PASS / FAIL / UNKNOWN knockout screen
- Explainable 100-point score range across seven bid factors
- Deadlines, NAICS codes, set-asides, credentials, and stated values
- Source-linked compliance matrix
- Evidence gaps and five prioritized next actions
- Prompt-injection flags for suspicious instructions embedded in source text

### Built for

Small businesses, government contractors, consultants, proposal teams, procurement advisors, sales engineers, and AI-agent workflows that need structured RFP decision data.

### Why this version

BidLens Core is deterministic and stateless. It makes no external AI calls, requires no customer API key, and never fabricates company credentials or past performance. Missing facts stay `UNKNOWN`, which makes the result safer to automate and inexpensive to call repeatedly.

### Responsible use

BidLens Core provides decision support, not legal or procurement advice. It cannot guarantee compliance or a win. A human reviewer must verify the official solicitation, amendments, scanned tables, portal-only instructions, and final submission.

## Search tags

RFP, RFQ, tender, solicitation, bid no-bid, government contracting, compliance matrix, procurement, proposal automation, MCP, AI agent, risk scoring

## Suggested pricing

- Full analysis: 5 credits / call ($0.05 gross)
- Compliance extraction: 3 credits / call, if per-tool pricing is supported
- Deployable template: $19 one time

At the platform's stated 80% Skill share, a 5-credit call yields $0.04 to the publisher before any taxes or later policy changes. Do not project revenue without observed call volume.

## Sample invocation

> Analyze this solicitation against our company profile. Identify mandatory failures before scoring, then return the compliance matrix and five next actions.
