Bootstrap acceptance criteria:
- Worker starts with no the402 key and stays healthy.
- When THE402_API_KEY is added, worker derives participant id from referral code.
- Worker sets its own the402 webhook URL.
- Worker finds existing Earn service listings by exact name; creates only missing ones.
- Worker caches service ids and handles job_dispatch.
- Worker subscribes to request.created up to $25 while unverified.
- Auto-bid is exact-match only and can be disabled with THE402_AUTO_BID=false.
- Earnings endpoint returns settled/held/pending values from the402 when configured.
