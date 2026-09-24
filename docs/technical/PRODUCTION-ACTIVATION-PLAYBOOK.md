# Controlled Production Activation Playbook

This is the planned production sequence. Do not execute production writes during readiness work.

## Database + deployment sequence

1. Confirm reviewed main/PR commit and freeze unrelated launch-critical merges.
2. Capture current production function/view definitions, ACLs, bucket config, DNS and previous Vercel deployment.
3. Confirm production backup/PITR availability and record the recovery point/change window.
4. Run `001_preflight.sql`.
5. Apply `002_public_pricing.sql` and immediately verify the 534-row fingerprint.
6. Apply `003_website_content.sql`.
7. Apply `004_tracking.sql`.
8. Apply `005_booking_quote.sql`.
9. Apply `006_permissions.sql`.
10. Run `007_verify.sql`; stop if any expected ACL/search-path/index/bucket result is wrong.
11. Configure Vercel Production using `PRODUCTION-ENVIRONMENT.md` with `VELTO_OPS_WRITES_ENABLED=false`.
12. Deploy the reviewed application and complete the `VERCEL-CUTOVER.md` domain checks.
13. Run `npm run verify:production-readiness` and `npm run verify:launch`.
14. Verify `/api/prices?q=Blazer` reports `source=live` and spot-check pricing/POA/sq-ft UI.
15. Verify `/admin/login`, then one authorized admin read. Do not make unnecessary content changes during cutover.
16. Verify order tracking manually with one known controlled order + its matching phone. Confirm a wrong phone does not reveal the order.

## Controlled Ops write activation

17. Prepare one real controlled booking payload, expected outlet and a unique idempotency key.
18. Temporarily set `VELTO_OPS_WRITES_ENABLED=true`.
19. Submit exactly one website booking.
20. Confirm exactly one open `pickup` task with the expected `WEB-XXXXXXXX` reference, normalized phone source, and outlet.
21. Retry the same request with the same idempotency key. Confirm the same reference and zero duplicate task.
22. Submit one controlled household quote. Confirm exactly one open `call` task.
23. Test Sector 18 separately: `Uttara Sector 18` must route to `RUAP`.
24. Test the outside-area label separately: `Outside Uttara Sectors 1–18` must **not** route to RUAP.
25. Inspect Vercel/Supabase logs for permission failures, retries, duplicate writes or unexpected 5xx.
26. Keep writes enabled only if every controlled check is correct. Otherwise turn the switch off immediately.

## Immediate rollback

Fastest action for any booking/quote anomaly:

`VELTO_OPS_WRITES_ENABLED=false`

Then:

1. Confirm new website booking/quote attempts can no longer reach the Ops RPC.
2. Do not delete tasks already created by successful real tests unless operations explicitly decide they are test records.
3. If RPC behavior itself is wrong, run/review `008_rollback.sql` to revoke website execution, then restore the captured prior function definition if required.
4. If pricing/view behavior is wrong, restore the captured view definition/ACL and verify the fingerprint before reopening traffic.
5. If application behavior is wrong, restore the previous known-good Vercel deployment while writes remain disabled.
6. Use DNS rollback only when the domain/project configuration itself is the failure; deployment rollback is normally faster.

## Data-preserving rollback boundary

The rollback plan never requires deleting operational `orders`, `customers`, `tasks`, `price_list`, website content or uploaded media. Website limiter rows are non-operational and can remain until normal cleanup.
