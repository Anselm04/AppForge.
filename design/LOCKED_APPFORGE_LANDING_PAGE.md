# LOCKED DESIGN — TrillionAI AppForge Landing Page

> **Design approved by product owner: 6 November 2026.**  
> **Status:** LOCKED visual direction, pending implementation and real end-to-end certification.  
> **Repository:** `Anselm04/AppForge.` — PRIVATE.  
> **Approved visual:** TrillionAI AppForge neon mountain/anvil landing page generated and approved in the product-owner conversation. The original PNG is a conversation asset and is **not yet committed to this Git repository**.

## Design ownership and change control

The visual composition, A/anvil emblem, TrillionAI product-family identity, mountain artwork, neon colour system, and core layout are now approved as the reference for AppForge. They may not be materially redesigned without the owner's explicit approval.

This document is a **visual/product experience specification**, not authorisation to modify AppForge runtime, integrate Identity or Observability, publish pricing, merge PRs, or deploy.

## Brand identity

- Name: **TrillionAI AppForge™** with clearly recognisable TrillionAI product-family affiliation.
- Primary distinctive mark: large, polished **A formed with an anvil silhouette**, emphasising building/forging software.
- Retain the memorable anvil-and-A brand as AppForge's defining product identity; use the TrillionAI infinity mark to identify the company family.
- Signature palette: near-black/deep navy backgrounds, electric cyan and blue, vibrant violet/magenta gradients, restrained green verification accents.
- Signature imagery: electric blue/purple mountains, glowing halo behind the A/anvil hero, subtle futuristic lighting and luminous card outlines.
- Interface language must be consistent with the approved TrillionAI Identity and Observability dashboards, while reflecting AppForge's specialised builder role.

## Locked page layout

### 1. Header/navigation
- TrillionAI AppForge brand and **AI Product Factory** descriptor
- Overview, Features, Pricing, Examples, Docs, Support
- Localisation picker with supported language labels
- Sign In and Get Started CTA
- Fully responsive mobile navigation with accessible keyboard and screen-reader semantics

### 2. Hero
**Eyebrow:** BUILD • CUSTOMISE • DEPLOY • SCALE

**Headline:** TrillionAI AppForge™

**Concept positioning:** Turn your idea into a real, working product — fast, professional and ready for the world.

**Actual launch copy must be evidence-backed:** never guarantee every prompt produces deployable software, assert unsupported one-click deployment, or claim 'no coding required' for cases that still require manual code changes.

Primary CTA: **Build Your Product Now** (only if the onboarding → verified subscription/credits → generation flow is operational).

Secondary CTA: **See It In Action** (real, validated demo with clear demo labeling).

Visual: the monumental bright neon **A/anvil** floating over the purple/cyan mountain landscape with glowing circular halo. The brand mark remains focal and must not be replaced by generic AI imagery.

### 3. Six feature cards
In a balanced 6-column desktop grid (responsive on narrower displays):
1. Build Anything — clearly state supported application categories and technical limits
2. AI-Powered — assisted generation with genuine status feedback
3. Fully Customisable — verified edit, refine, preview and save lifecycle
4. Export & Deploy — source export and deployment only where actually supported
5. Business Ready — authentication, payments and analytics by supported templates/adapters
6. Secure & Scalable — bounded claims backed by operational/security evidence

### 4. Builder preview — Create Your Product
A high-fidelity embedded product builder demo following the approved reference:
- Left product sidebar with Build Product, My Projects, Templates, Deployments, Credits & Billing, Usage & Analytics, Settings
- Large clear brief/prompt text input
- Output type selectors: Mobile App, Web App, Business Tool, Custom
- Distinct **Generate Product** CTA
- Example mobile output mockups (restaurant reservation app and booking confirmation) clearly labelled **Illustrative demo** unless generated and verified using a real AppForge build
- Real production interface must show prompt safety, estimated complexity/cost, credit budget, current build state, retries, errors and resume-from-saved-project controls

### 5. Pricing
Three high-contrast cards: Starter, Business (visually featured), Pro.

**Important: the image shows $19, $49 and $99/month with sample credit counts. These are illustrative concept values, NOT automatically approved live prices, entitlements, quotas, or Stripe Price IDs.**

Before publishing:
- Confirm actual plan prices, NZD/USD currency, taxes and billing frequency with the owner
- Display plan inclusions, credit allowances, credits per operation, and limitations
- Explain that advanced/complex builds may require additional compute/credits
- Show explicit usage estimates and top-up prices before charging; no undisclosed costs
- Confirm cancel-anytime conditions and refund/cancellation policy
- Make all purchase CTAs rely on verified Stripe checkout, webhook receipt and entitlement state
- Do not promise a free tier unless it genuinely exists and has enforceable limits

### 6. How It Works
Four distinct stages with glowing icons linked by arrows:

**1. Describe** → **2. Generate** → **3. Customise** → **4. Deploy**

Every published step must correspond to a working and independently verified real customer action. Include a saved project/resume path, export alternatives and clear failure states.

### 7. Proof/trust strip
The approved layout includes concise statements about real products, source ownership and business readiness. Do not make claims about ownership, security, automatic deployment or commercial outcomes beyond the actual terms and verified capabilities.

## Mandatory account and product lifecycle

The published AppForge journey must support and be tested for:
1. Welcome → account creation
2. Email verification, and phone verification wherever required by an approved policy
3. Login, logout, password reset, recovery and multi-factor access where enabled
4. Plan selection, confirmed Stripe payment, webhook confirmation and correct subscription/credit entitlement
5. Prompt submission and truthful complexity/cost estimate
6. Actual build with observable progress, failures and retry behaviour
7. Product preview, editing and saved project state
8. Sign out/in and resume the correct existing project
9. Source export and supported deployment
10. Account/subscription management, cancellation and deletion where applicable

Never substitute a screenshot, mocked output, test stub or passing UI test for this complete real-world acceptance test.

## Accessibility, responsiveness and performance

- Functional Flutter responsive implementation, fitting mobile portrait, desktop and tablet screens
- Clear information hierarchy and adaptive feature/pricing grids
- Keyboard operation and accessible focus states
- Screen-reader labels for inputs, controls, pricing and build state
- Reduced-motion mode for all glow/animation effects
- Accessible contrast, status text beyond colour alone, scalable fonts
- Web performance budgets, image optimisation, caching, semantic information and SEO/AEO metadata
- Localisation where actually supported; no language in a switcher that is not properly translated

## Design-to-code strategy

Use Flutter/Dart for the reusable product UI and existing Node.js/TypeScript server services; share neutral branding tokens and accessible components across the TrillionAI family without sharing confidential business logic between unrelated products.

Develop design implementation only when AppForge development is expressly resumed. Keep code changes in a feature branch, use a representative screenshot comparison and widget/e2e tests, and require successful real build/credit/payment acceptance testing before release.

## Isolation and integration restrictions

AppForge runtime work and integration with TrillionAI Identity, Observability, Manager, Secure or Ecosystem Core are **on hold**. This design lock does not authorise connecting, changing, or deploying any of those systems.

TrillionAI's internal ecosystem intelligence, company revenue and privileged agent infrastructure must not be displayed to AppForge customers.

## Acceptance and sign-off

- Layout visibly matches approved A/anvil neon mountain reference
- All six feature cards and builder demo match the hierarchy and colour treatment
- Pricing is transparent, approved and derived from live plan configuration
- Login, purchase, build, resume, export and supported deployment are real and testable
- No unverified commercial or production capability claims
- Frontend is accessible and responsive
- Security, API, billing and ownership boundaries are independently validated
- Product owner explicitly approves implementation before production rollout

**Approved visual direction remains locked. Implementation is pending.**
