# Future Follow-ups

## USDA FoodData Central scaling

- Add a persistent cache (Supabase) for USDA:
  - `foods/search` query → results (fdcIds + metadata), with TTL (e.g. 30–90 days)
  - `food/{fdcId}` details → normalized nutrients/serving, with TTL
- Rationale:
  - Reduce latency and repeated network calls.
  - Avoid rate-limit edge cases (many users behind one NAT/public IP).
  - Make the app resilient to USDA outages.
- Note: USDA calls are currently client-side (per-user IP). If moved server-side/proxied, rate limits would become shared across users and caching becomes more important.

