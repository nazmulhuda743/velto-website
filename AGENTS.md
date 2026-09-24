# Marchitect Build Agent Instructions — Velto

Before planning, editing code, adding dependencies, or making implementation decisions, read this file first and then read `docs/PROJECT-BUILD-SPEC.md` completely.

`docs/PROJECT-BUILD-SPEC.md` is the project source of truth.

Treat all items marked LOCKED as approved decisions. Do not independently reopen or reinterpret:

- positioning
- information architecture
- homepage hierarchy
- homepage copy
- conversion hierarchy
- trust strategy
- design tokens
- brand rules
- responsive behavior
- interaction direction
- technical stack

If implementation reveals a genuine contradiction or technical blocker, report it instead of silently changing the specification.

## Current implementation gate

First target: **HOMEPAGE ONLY**.

Implement, test, visually QA, and produce the required preview states for the homepage. Stop at the homepage approval gate before building the full internal-page system.

Minimal placeholder destinations such as `/book`, `/quote`, and service routes may exist only for navigation testing during the homepage build.

## Do not

- rewrite approved copy
- reorder, add, or remove homepage sections
- invent business facts, reviews, prices, ratings, policies, addresses, or claims
- create a new brand identity
- recreate or trace the Velto logo
- introduce generic SaaS card layouts, decorative gradients, glassmorphism, or meaningless motion
- add dependencies without a concrete technical reason
- expose private Supabase operational tables to the browser
- add ecommerce/cart logic

## Engineering behavior

Use the approved stack in the project specification.

Prefer semantic HTML, server components where appropriate, minimal client JavaScript, accessible interactions, responsive image loading, and strong mobile performance.

Run the site and inspect the rendered result. Do not treat code completion as visual completion.

Verify the approved desktop, laptop, tablet, mobile, and small-mobile states before calling the homepage complete.

Use the project states accurately: DESIGNED, BUILT, TESTED, APPROVED, DEPLOYED.
