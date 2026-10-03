# Velto Uttara Monopoly Plan

Date: 2026-10-04  
Status: STRATEGY / EXECUTION SOURCE OF TRUTH  
Scope: Website + customer PWA + internal Ops  
Primary market: Uttara, Dhaka  
Principle: dominate a narrow customer relationship first, then expand outward.

## 1. The wedge

Velto should not try to become "the laundry app for Dhaka" yet.

The narrow market to own is:

> **Recurring wardrobe care for Uttara households that want pickup, predictable handling, and one place for ironing + wash & iron + dry cleaning.**

The product goal is not app installs. It is to make Velto the default habit for this customer.

The operating flywheel is:

**Discover Velto -> first pickup -> trustworthy execution -> delivered order -> second service -> repeat rhythm -> regular pickup -> review/referral**

Website, customer PWA and Ops are three parts of this same loop.

## 2. Production evidence behind the decision

Read from velto-production on 2026-10-04.

### Customer base
- 755 customers with valid non-cancelled order history.
- 389 have only one order.
- 366 have 2+ orders.
- 232 have 3+ orders.
- Ever-repeat rate: 47.8%.
- First-to-second within 30 days: 31.1%.
- Median first-to-second gap: 19 days.
- Top 20% of customers generate about 72.1% of lifetime revenue.

### Current rhythm segments
- regular_on_track: 76
- regular_due: 49
- slipping: 40
- occasional: 123
- lapsed: 78
- onetimer_warm: 82
- onetimer_gone: 277
- new: 28

Last 30 days:
- regular_on_track: 76 active, 189 orders, Tk 57,317 revenue
- regular_due: 43 active, 110 orders, Tk 42,643 revenue
- slipping: 6 active, 12 orders, Tk 7,287 revenue
- occasional: 60 active, 81 orders, Tk 50,646 revenue

### Service behaviour
First order -> 30-day repeat:
- Ironing only: 43.8%
- Wash + Iron only: 32.3%
- Dry Cleaning only: 19.4%
- Dry Cleaning + Ironing: 48.4%

Lifetime service mix:
- Dry Cleaning only: 293 customers, avg 1.31 orders, avg LTV Tk 821
- Ironing only: 188 customers, avg 2.27 orders, avg LTV Tk 364
- Wash + Iron only: 50 customers, avg 1.36 orders, avg LTV Tk 1,009
- Any two services: 166 customers, avg 5.34 orders, avg LTV Tk 2,697
- All three: 58 customers, avg 11.74 orders, avg LTV Tk 4,641

The important product truth:

> One service gets a customer in. Multiple services create the valuable relationship.

### Existing product adoption
- Customer accounts: 6
- Linked customer accounts: 5
- Website leads recorded: 4
- Website push subscriptions: 1
- Website routines: 0
- Website retention contacts: 0
- Website rhythm touches: 0

This means the problem is not lack of planned features. The problem is activation and adoption of the loop.

### Ops debt
Current production:
- 78 Picked orders; 13 are 7+ days old.
- 41 Ready orders; 32 are 7+ days old.
- 56 open legacy tasks; all 56 are older than 7 days.

The previous task model has failed adoption. Do not build new customer promises on top of unreliable execution.

## 3. Product architecture

Do not create another customer app.

### A. `velto-website`
Owns:
- acquisition
- service pages
- pricing
- booking / quote
- tracking
- customer sign-in
- account
- order history
- installable PWA
- reorder
- recurring pickup
- push notifications
- review flow
- second-service conversion
- retention / rhythm
- marketing attribution
- customer-facing invoice links

This website **is the customer app**.

### B. `velto-app`
Owns internal execution:
- intake
- order state
- items / stains / photos
- money
- delivery
- ironing
- outsource
- staff tasks
- day wall / exceptions
- customer follow-up execution
- operational audit

This becomes the only internal operations product.

### C. Legacy / labs
- `velto-ops-pwa`: legacy production only until cutover. No new product features.
- `velto-ops-engine`: architecture / research source only.
- UI lab repos: visual reference only.

No fourth production app.

## 4. The monopoly metric

Do not use "downloads" or "website traffic" as the north star.

The first monopoly milestone is:

> **200 Uttara customers in a reliable recurring-care relationship.**

A recurring-care customer should meet one of:
- 3+ lifetime orders and currently on-track/due;
- active standing/weekly routine;
- 2+ services used and ordered in last 30 days.

Supporting gates:
1. 200 recurring-care customers.
2. 45%+ of active customers use 2+ services.
3. 40%+ first-to-second conversion within 30 days.
4. <5% of active orders breach their operational promise without a customer update.
5. 80%+ of eligible delivered customers receive the post-delivery next-action flow.
6. Website/PWA reorder becomes a meaningful source of repeat orders, not a vanity feature.

Do not expand geography until these are stable.

## 5. Customer journey we are building

### Stage 1 — Discovery
Customer arrives from Meta, Google, Maps, referral or organic search.

Website must answer:
- Do you serve my area?
- What do you clean?
- What will it cost?
- Can I trust you?
- How soon?
- How do I book?

Primary CTA: Book a Pickup.

### Stage 2 — First pickup
Keep booking short.

Required:
- phone
- name
- sector/address
- service
- preferred pickup window
- optional item details

Do not force account creation before the first order.

After booking:
- show clear reference
- show pickup expectation
- offer account / notification activation after value is created

### Stage 3 — Execution
Customer promise must be backed by Ops.

The website must never promise a slot or turnaround Ops cannot carry.

Every website booking must become visible in `velto-app` automatically.

Staff should not copy-paste website requests into another system.

### Stage 4 — Delivery
Delivery is the strongest retention moment.

Every delivered order should generate:
- invoice / receipt link
- rating
- issue recovery if rating is low
- Google review path if rating is high
- one intelligent next-service suggestion
- one-tap rebook / routine option
- sign-in / PWA invitation only after usefulness is obvious

### Stage 5 — Rhythm
The product learns the customer's normal gap.

Examples:
- weekly ironing customer -> remind near normal day
- dry-cleaning-only customer -> convert to everyday care
- wash-and-iron customer -> make rebooking one tap
- slipping regular -> human follow-up task
- seasonal blanket/curtain customer -> seasonal reminder, not weekly spam

The customer should feel Velto remembers them without becoming annoying.

## 6. Website plan

### Keep
- current premium trust direction
- real process proof
- location proof
- live pricing
- Book Pickup hierarchy
- service-specific landing pages
- attribution
- tracking

### Change focus
The public website should not become a giant content site.

Its job:
1. bring qualified Uttara demand
2. convert it
3. hand it into the operating system
4. start the repeat loop

### Highest-value website work
1. Make live booking the default path and verify end-to-end reliability.
2. Clean analytics so test/internal sessions do not pollute funnel reporting.
3. Separate first-time service intent:
   - dry cleaning
   - ironing
   - wash + iron
   - household/seasonal
4. After form success, show the next operational truth: pickup request received, what happens next.
5. Track real revenue attribution through lead -> customer -> order -> repeat.

Do not add more decorative sections until the booking funnel is measurable.

## 7. Customer PWA plan

The installed website becomes a convenience layer for existing customers.

### Home screen
The customer should see, in order:
1. current order / next pickup
2. Rebook last order
3. Book same service
4. Usual items
5. Next suggested service
6. history / invoices
7. notifications / preferences

Not a generic dashboard.

### Killer actions
- **Rebook last order**
- **Same as usual**
- **Add dry cleaning to this pickup**
- **Set my regular day**
- **Where is my order?**

If the PWA cannot save taps versus WhatsApp, it has no reason to exist.

### Account activation
Do not make app install the goal.

Ask after:
- successful booking
- delivered invoice
- second repeat
- when enabling order updates

Reason:
the customer now understands the value.

## 8. Retention engine

The database already has most of the building blocks. Activate them in controlled order.

### Priority 1 — First-timer conversion
Target:
- new
- onetimer_warm

Goal:
get the second order within 30 days.

Message should depend on first service.

Dry-cleaning first:
- do not ask for another special occasion
- introduce everyday wardrobe care / ironing / wash + iron

Ironing first:
- make the next pickup effortless
- introduce "same day next week" or "same as last time"

Wash + Iron first:
- encourage routine
- introduce dry cleaning as an add-on when relevant

### Priority 2 — Regular protection
Target:
- regular_due
- slipping

These customers deserve higher priority than cold acquisition because their value is proven.

The app should create one clear action:
- reminder
- WhatsApp/call
- one-tap pickup
- exception if the customer's normal rhythm is broken

### Priority 3 — Lapsed win-back
Target:
- lapsed

Use previous service and cadence.
Do not send a generic discount blast.

### Priority 4 — Seasonal
Target:
- customers whose history contains blankets, comforters, curtains, carpets, jackets or winter dry cleaning

Trigger from season and previous behaviour.

Do not treat seasonal customers as churned weekly customers.

## 9. Second-service ladder

This is one of the strongest economic levers.

Current production behaviour shows:
- one-service customers are low-frequency
- two-service customers are worth roughly Tk 2.7k average lifetime
- all-three customers are worth roughly Tk 4.6k average lifetime

Therefore:

### Dry Cleaning only
Next action:
**Everyday clothes too**
Offer ironing or wash + iron.

### Ironing only
Next action:
**Add dry cleaning to the pickup you already make**
No extra trip.

### Wash + Iron only
Next action:
**Add dry cleaning when needed**

### Two-service customer
Introduce the missing third service only when behaviour makes sense.

No random upsell carousel.

## 10. Ops plan

Ops exists to protect the promise made by the customer side.

The internal app should not become a giant ERP.

### Core rule
Every screen must answer:
- what needs action now?
- who owns it?
- when is it due?
- what is blocked?
- what will hurt a customer if we miss it?

### Cut the dead task model
The old `tasks` table has 56 stale open tasks.

Do not revive that system as the main execution model.

Use the lean `velto-app` direction:
- task = human handoff/action
- derived priority
- batches where work is naturally batched
- exceptions instead of alert spam
- one source of truth for order money/status

### Day-0 cleanup before cutover
1. reconcile stale Picked orders
2. reconcile stale Ready orders
3. archive/close dead legacy tasks
4. fix staff identities/roles
5. verify website booking appears in Ops
6. verify payment path
7. verify delivered status creates downstream customer flow
8. only then cut over

## 11. One shared event spine

Every important action should create one trustworthy business event.

Minimum events:
- lead_created
- pickup_requested
- pickup_confirmed
- order_created
- intake_completed
- advisory_requested
- processing_started
- ready
- out_for_delivery
- delivered
- payment_recorded
- rating_received
- second_service_requested
- routine_requested
- reminder_sent
- reorder_created

The customer layer reads the safe subset.
Ops acts on the operational subset.
Analytics reads all of them.

Do not maintain separate meanings in three apps.

## 12. Data moat

The moat is not "AI".

The moat is a clean history of:
- household
- services used
- usual items
- order frequency
- preferred day
- preferred time
- sector
- average basket
- response to reminders
- service affinity
- issue history
- delivery reliability

This lets Velto become easier to use every time.

AI can later use this data for messages and recommendations, but AI does not replace the underlying rules.

## 13. Execution sequence

### Phase 0 — Consolidate
- Freeze feature development in legacy Ops.
- Treat `velto-app` as the internal successor.
- Treat `velto-website` as website + customer PWA.
- Document repo boundaries.
- No new customer repo.

### Phase 1 — Make the first-order loop real
- production-safe booking
- quote
- tracking
- Ops intake of website request
- attribution
- clean funnel analytics
- no manual duplicate entry

Success gate:
A real customer can discover -> book -> be fulfilled -> see status without staff workarounds.

### Phase 2 — Make delivery create the next order
- invoice link
- rating
- low-rating recovery
- Google review
- second-service offer
- rebook same order
- routine request

Success gate:
80%+ eligible delivered orders receive the post-delivery path.

### Phase 3 — Make the PWA useful
- phone sign-in
- account linking
- order history
- one-tap rebook
- usual items
- next pickup
- push order updates

Success gate:
PWA users reorder faster than equivalent non-PWA customers.

### Phase 4 — Turn retention on
- first-timer playbook
- regular due
- slipping regular
- lapsed
- seasonal
- holdout measurement

Success gate:
30-day first-to-second rate improves from 31.1% toward 40%+ without blanket discounts.

### Phase 5 — Operational reliability
- cut over to `velto-app`
- promise tracking
- exceptions
- delivery / money / ironing control
- stale order cleanup
- daily manager wall

Success gate:
customer promise breaches are visible before customers complain.

### Phase 6 — Deepen the Uttara monopoly
- standing pickup
- household profiles
- same-as-usual booking
- multi-service relationship
- referrals
- local SEO by service + sector
- building/office micro-clusters only when operationally efficient

### Phase 7 — Expand adjacent
Only after the monopoly gates hold:
1. adjacent Dhaka geography
2. selected B2B/hotel corridors
3. additional household-care categories

Do not expand because an ad can reach there.
Expand when the system can deliver the same trust.

## 14. 90-day focus

### Month 1
- finish and verify production website booking/track/customer activation blockers
- clean stale Ops truth
- connect website request -> `velto-app`
- launch delivered invoice / rating / second-service flow
- baseline the full funnel

### Month 2
- activate first-timer + regular-due + slipping retention
- launch one-tap rebook / same-as-usual
- actively onboard repeat customers into PWA after delivery
- measure second-service conversion

### Month 3
- standing pickup / routine
- segment-specific home screen
- seasonal winter campaign from actual order history
- push / WhatsApp where allowed
- tighten SLA / exception board
- decide expansion only from KPI gates

## 15. What we deliberately will not build now

- separate native customer app
- marketplace
- broad Dhaka launch
- loyalty points system before repeat loop works
- complicated subscription pricing
- AI chatbot as the main product
- dozens of automated reminders
- a giant CRM separate from Supabase
- another order database
- another staff task engine
- features with no measured path to acquisition, retention, trust or execution

## 16. Decision rule for every future feature

A feature gets built only if it materially improves one of:

1. qualified Uttara acquisition
2. first-order conversion
3. trust / reliability
4. first-to-second conversion
5. second-service adoption
6. recurring habit
7. operational execution
8. measurable unit economics

If it does none of these, it is distraction.

## 17. The actual strategic position

Velto should become:

> **The default wardrobe-care system for a narrow group of Uttara households — not another laundry page.**

Own the customer's recurring behaviour first.
Then own more services.
Then own more households.
Then expand geography.
