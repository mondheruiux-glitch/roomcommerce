# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 17: Open Business Questions & Architectural Decisions

> **Audit Date:** October 14, 2026  
> **Status:** Unresolved Strategic Decisions for Product Owners & Stakeholders  

---

## 1. Open Strategic & Commercial Decisions

### `DEC-001`: Retailer Affiliate Policy Regarding Generative AI
* **Question:** Do Amazon Associates and Wayfair affiliate program operating agreements permit automated generative AI product recommendations without human editorial curation?
* **Why it Matters:** Affiliate network compliance teams may flag automated redirect links if not pre-approved or if disclosures are missing.
* **Related Files:** [`apps/api/src/modules/commerce/commerce.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/commerce/commerce.service.ts)
* **What Has Been Checked:** Codebase generates valid deep-links with UTM tracking tags and FTC-compliant "Affiliate Link" badges in `ProductDrawer`.
* **Action Required:** Product / Legal review of Amazon Associates and Wayfair operating agreements to confirm compliance.
* **Owner:** Product Manager / Legal Counsel.

---

### `DEC-002`: Monetization Model Beyond the $14.99 Move-In Pass
* **Question:** Should RoomCommerce offer a recurring monthly subscription ($29/month for interior designers / real estate staging agents) in addition to the consumer 30-day $14.99 Move-In Pass?
* **Why it Matters:** Real estate agents and home stagers generate hundreds of room concepts per month and exceed the 60-generation limit within days.
* **Related Files:** [`apps/api/src/modules/billing/billing.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/billing.service.ts), [`packages/contracts/src/billing.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts)
* **What Has Been Checked:** The database schema tracks `move_passes` with flexible `credits_remaining` and `expires_at` timestamps, which can easily support recurring subscriptions via Stripe Subscriptions.
* **Owner:** Executive Leadership / Product Owner.

---

### `DEC-003`: Multi-Region Compute vs Centralized US-East-1
* **Question:** Should Modal GPU workers and AWS ECS clusters remain centralized in `us-east-1`, or should European edge regions be deployed?
* **Why it Matters:** European users experience ~120ms round-trip latency to `us-east-1`. However, Modal L4 GPU execution is serverless and Cloudflare edge caches static assets globally.
* **What Has Been Checked:** Cloudflare CDN handles all static WebP assets and edge routing. Database and GPU workers are in US-East.
* **Recommendation:** Keep centralized US-East-1 for MVP to minimize operational overhead and database cross-region latency.
* **Owner:** Technical Architect.

---

### `DEC-004`: Production Authentication Provider Strategy
* **Question:** Should RoomCommerce retain its lightweight NestJS passwordless magic link system, or integrate an external identity provider like Clerk or Auth0?
* **Why it Matters:** External providers add hosted social logins (Google, Apple) but introduce vendor lock-in and monthly active user costs.
* **What Has Been Checked:** The existing custom auth module implements JWT cookies, magic links, and pass entitlements cleanly with 10 passing unit tests.
* **Recommendation:** Retain custom auth for MVP; add Google OAuth provider directly to the existing NestJS auth module when requested.
* **Owner:** Engineering Lead.
