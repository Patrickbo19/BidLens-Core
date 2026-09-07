# Earn Router

Earn Router is a funded-demand routing prototype. It is designed to connect users to currently available paid opportunities from approved publisher networks, rank them using live economics, and keep publisher/user rewards separated and auditable.

## Current provider target

Lootably Offers API (`https://api.lootably.com/api/v2/offers/get`).

Required runtime variables after publisher approval:

- `LOOTABLY_API_KEY`
- `LOOTABLY_PLACEMENT_ID`
- `LOOTABLY_POSTBACK_SECRET` (once the exact verification recipe is configured)

## Routes

- `/` — public publisher property / user UI
- `/health` — deployment health
- `/api/status` — provider connection state
- `/api/opportunities` — ranked opportunity feed
- `/postback/lootably` — conversion receiver
- `/privacy`
- `/terms`

## Compliance rule

Earn Router does not fabricate survey answers, fake installs, create false identities, or automate advertiser actions unless the provider/advertiser explicitly permits automation. The system routes and ranks funded opportunities; users complete human-required actions truthfully.

## Launch gate

1. Deploy publicly.
2. Apply for a Lootably publisher account using the deployed URL.
3. Create placement after approval.
4. Configure user reward / publisher margin.
5. Set runtime variables and postback.
6. Verify one real external conversion before expanding suppliers.
