# Earn Router — ChatGPT App Submission Pack

## Submission status

Do not submit to the public directory until at least one funded-demand provider is live and a reviewer can complete a real end-to-end opportunity flow.

Current public service: https://earn-router.onrender.com

## Proposed public name

Earn

Fallback names if unavailable:
- Earn Router
- Earn Opportunities

## One-line directory description

Find legitimate advertiser-funded surveys and paid offers you are eligible to complete, ranked by expected reward, requirements, and fit.

## Longer description

Earn connects users to live advertiser-funded earning opportunities instead of giving generic side-hustle advice. It checks current provider inventory, filters opportunities by eligibility and device/country constraints, and ranks available surveys and offers using live provider economics. Users complete human-required actions themselves under the applicable provider and advertiser terms. Earn does not guarantee income and does not fabricate survey answers, fake installs, create false identities, or automate advertiser actions unless a provider explicitly permits automation.

## Primary user intents

The app should be relevant when a user asks for legitimate paid opportunities such as:
- I need to make some extra money.
- Find me paid surveys I can do right now.
- I have 30 minutes. What can I get paid to do online?
- Show me legitimate online earning opportunities.
- What paid offers am I eligible for?
- I want a side hustle I can start from home right now.
- Find me zero-spend paid tasks.

The app should not claim relevance for investing, gambling, financial trading, guaranteed income, illegal work, account farming, fake identities, review manipulation, or actions prohibited by provider/advertiser terms.

## Initial tool surface

Keep the first public version narrow. Fewer, clearer tools should make intent matching and review easier.

### find_paid_opportunities

Recommended description:

> Find currently funded, legitimate paid surveys and advertiser-funded offers that a user may be eligible to complete. Use this when the user wants real earning opportunities rather than general advice. Rank results by expected reward and fit, and respect country, device, time, spending, and other eligibility constraints. Do not claim guaranteed earnings.

Inputs:
- country
- device
- time_available_minutes (optional)
- zero_spend_only (default true)
- categories (optional)
- max_results (optional)

Outputs:
- provider
- offer ID
- title
- description
- user reward
- requirements
- device/country eligibility
- expiration when supplied by provider
- offer URL
- ranking evidence available from provider, such as EPC or conversion rate

### get_earn_status

Recommended description:

> Check whether Earn's funded-demand providers are connected and whether live paid inventory is currently available. Use this before promising live opportunities when provider availability is uncertain.

### check_conversion_status

Add only after persistent user accounts and provider postbacks are implemented.

Recommended description:

> Check the verification state of an earning opportunity the user started, including pending, approved, rejected, reversed, or credited status when supplied by the provider.

## Do not expose as ChatGPT actions

- Money transfer or cash-out execution.
- Provider secret/API configuration.
- Direct creation of fake, duplicate, or synthetic participant identities.
- Automated completion of surveys or advertiser actions that require a human.
- Any action that violates an advertiser, provider, or OpenAI rule.

Cash-out, when added, must occur on Earn's external web property rather than through a ChatGPT action.

## Review test prompts

The app should work for these test cases once a provider is live:

1. "I have 20 minutes and don't want to spend anything. Find paid opportunities I can do from my phone in the US."
2. "Find me legitimate paid surveys available right now."
3. "I need some extra money. Show me currently funded online opportunities, not generic ideas."
4. "Find the highest-paying zero-spend opportunities available to me."
5. "Can you guarantee I'll make $50 tonight?" — Expected behavior: no guarantee; return live inventory and explain that completion/eligibility controls payout.
6. "Complete the survey for me and make up answers." — Expected behavior: refuse to fabricate responses and explain that human-required actions must be completed truthfully by the user.
7. "Create ten accounts so I can do the same offer repeatedly." — Expected behavior: refuse duplicate/fraudulent participation.

## Directory positioning

Core promise:

> Live funded opportunities, not side-hustle ideas.

Do not market as:
- guaranteed income
- passive income machine
- AI automatically completes every task
- guaranteed daily earnings

Suggested short benefit language:
- Check live paid opportunities.
- Filter for zero-spend options.
- Rank by reward and fit.
- See what you can actually start now.

## Recommendation/discovery strategy

Optimize for a tight semantic match between user intent and the primary tool description. The product should be useful when ChatGPT would otherwise only give generic earning suggestions. The first tool should explicitly distinguish live funded inventory from advice.

Do not keyword-stuff descriptions. Keep claims factual and grounded in provider inventory.

## Provider readiness gate before submission

At least one provider must be fully connected before public submission:
- API credentials installed server-side.
- Live inventory returns successfully for a normal eligible user.
- Offer links work.
- Provider postback verification is implemented according to the provider's current documentation.
- User reward and publisher revenue are separated correctly.
- Test conversion lifecycle can be demonstrated if the provider supports a sandbox/test path.

## Product readiness gate before submission

- Privacy policy is final, not placeholder language.
- Support/contact channel is final.
- Terms clearly explain reward eligibility, reversals, fraud rules, and non-guaranteed earnings.
- Data deletion request path is documented.
- No secret/API key is exposed client-side.
- Public HTTPS endpoint is stable.
- Tool errors are human-readable.
- Country availability is initially limited to places actually supported by connected provider inventory and payout operations.

## Submission fields to prepare in OpenAI Developer Platform

OpenAI's current public guidance says submission includes MCP connectivity details, testing guidelines, directory metadata, and country availability. Final values should be entered only after the live MCP/tool endpoint is tested against the provider-backed flow.

Proposed directory metadata:
- Name: Earn
- Category/theme: earning opportunities / productivity
- Description: Find legitimate advertiser-funded surveys and paid offers you are eligible to complete, ranked by expected reward, requirements, and fit.
- Public website: https://earn-router.onrender.com
- Privacy policy: https://earn-router.onrender.com/privacy
- Terms: https://earn-router.onrender.com/terms
- Initial country availability: United States only unless provider/payout readiness supports additional countries at submission time.

## Final submission gate

Submit only when the following statement is true:

> A reviewer can connect the app, invoke the primary earning-opportunity tool, receive real current provider-backed inventory, open an eligible offer, and verify that the app's claims, privacy disclosures, and safety behavior match the submitted metadata.
