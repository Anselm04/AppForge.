# AppForge Brand Guidelines v1.0

> Trillion AI Tech — Premium programmatic brand system

---

## 1. Brand Philosophy

AppForge is an **AI-native app builder** — not a traditional SaaS. Our brand visuals reflect this through:

- **Deep space / constellation motifs** — representing the multi-agent network
- **Electric blue + cyan + silver palette** — coding energy meets precision engineering
- **Programmatic SVG assets** — infinitely scalable, editable in code, zero raster
- **Dark-first design** — every asset looks native on `#080c18` without inversion

---

## 2. Logo System

### Logo Mark (`logo-mark.svg`)

The mark is a **3-node constellation** — three interlocked circles connected in a triangle, representing the Planner, Coder, and Reviewer agents.

| Variant | File | Size | Use |
|---------|------|------|-----|
| Full mark | `logo-mark.svg` | 200x200 | App icon, avatar, nav logo |
| Small mark | `logo-mark.svg` | 64x64 | Favicon, inline icon |
| Tiny mark | `logo-mark.svg` | 32x32 | Browser favicon, list item icon |

**Rules:**
- Always maintain the 1:1 aspect ratio
- Minimum size: 32x32px (any smaller loses node detail)
- Never rotate, distort, or change node colors
- Transparent background only (no colored boxes behind the mark)
- For favicon: `npx svgexport logo-mark.svg favicon.ico 32:32`

### Wordmark (`wordmark.svg`)

**AppForge** in Inter 800 weight. "App" is silver (`#e2e8f0`), "Forge" is electric blue (`#4aa3ff`).

| Variant | File | Size | Use |
|---------|------|------|-----|
| Full wordmark | `wordmark.svg` | 600x160 | Navbar, hero headers, invoices |
| Compact | `wordmark.svg` | 300x80 | Email signature, footer |
| Mini | `wordmark.svg` | 200x53 | Mobile nav, tight layouts |

**Rules:**
- Minimum width: 200px (below this, descender spacing breaks)
- Never change the "App" / "Forge" color split — it's the brand lockup
- Never italicize, underline, or add shadows to the text
- Always use Inter or system-ui fallback — never serif fonts

### Combined Lockup

For maximum impact, place the **Logo Mark** (left) + **Wordmark** (right) with 24px gap. Use this on:
- GitHub README headers
- Pitch deck title slides
- Social media banners

---

## 3. Color Palette

| Name | Hex | Token | Usage | DO | DON'T |
|------|-----|-------|-------|-----|-------|
| **Electric Blue** | `#4aa3ff` | `--color-accent-blue` | Primary CTAs, links, active states | Use on dark backgrounds (#080c18, #0d1f38) | Use on white/light backgrounds |
| **Neon Cyan** | `#00e5ff` | `--color-accent-cyan` | Secondary highlights, code syntax, Coder agent | Pair with Electric Blue for gradients | Use as primary CTA color alone |
| **Deep Navy** | `#080c18` | `--color-bg-primary` | Page backgrounds, base surfaces | Use as 90%+ of any screen | Use as text color |
| **Slate** | `#0d1f38` | `--color-bg-secondary` | Cards, modals, elevated panels | Elevate above Deep Navy with 1px border | Use as primary background (too busy) |
| **Silver** | `#e2e8f0` | `--color-text-primary` | Headlines, primary text | Always on dark backgrounds | Use on white (invisible) |
| **Gold** | `#fbbf24` | `--color-accent-gold` | Premium tiers, pricing highlights, badges | Sparingly — 1 element per screen max | Use for error states |
| **Violet** | `#a855f7` | `--color-accent-violet` | Reviewer agent, reviewer status | With cyan/blue for agent differentiation | Use for success states |
| **Teal** | `#14b8a6` | `--color-accent-teal` | Deploy success, live badges, health OK | Confirmatory states only | Use for warnings |

### Gradient Usage

| Gradient | Formula | Use |
|----------|---------|-----|
| Blue-to-cyan | `linear-gradient(135deg, #4aa3ff, #00e5ff)` | Hero buttons, primary CTAs |
| Cyan-to-teal | `linear-gradient(135deg, #00e5ff, #14b8a6)` | Deploy-related CTAs |
| Gold-to-amber | `linear-gradient(135deg, #fbbf24, #d97706)` | Premium tier upgrade buttons |

---

## 4. Typography

| Weight | Size | Use | Font |
|--------|------|-----|------|
| **800 (ExtraBold)** | 48-64px | Page headlines, hero titles | Inter, system-ui |
| **700 (Bold)** | 32-40px | Section headers, feature titles | Inter, system-ui |
| **600 (SemiBold)** | 16-24px | Nav links, buttons, card titles | Inter, system-ui |
| **400 (Regular)** | 14-16px | Body text, descriptions | Inter, system-ui |
| **400 (Mono)** | 13-14px | Code snippets, agent names, logs | JetBrains Mono, SF Mono, monospace |

**Rules:**
- Never use font-weight below 400 for any UI text
- Line-height: 1.5 for body, 1.2 for headlines
- Letter-spacing: -0.02em for headlines, normal for body
- Max line length: 65 characters for body text

---

## 5. Hero Banner (`hero-banner.svg`)

### Specs
- **Aspect ratio:** 16:9 (1920x1080 native)
- **Safe zone:** All critical visuals stay within 1600x900 (centered)
- **Text zone:** Leave center 600x200 empty for overlaid headline text

### Usage
| Platform | Size | Notes |
|----------|------|-------|
| Website hero | 1920x1080 or smaller | Overlay "Build full-stack apps with AI" in center |
| GitHub README | 1200x675 | Center crop from 16:9, keep nodes visible |
| Pitch deck | Full bleed | Add title text in top-center safe zone |
| Twitter header | 1500x500 | Crop from top 50% of banner |

---

## 6. Feature Illustrations

All feature illustrations are **2:1 aspect ratio** (1200x600 native).

| Illustration | File | Represents | Use |
|-------------|------|-----------|-----|
| Pipeline | `feature-pipeline.svg` | 3-agent build flow | Homepage, onboarding, Product Hunt |
| Deploy | `feature-deploy.svg` | Vercel/cloud deploy | Pricing, deployment docs, blog |
| Security | `feature-security.svg` | Compliance & shield | Enterprise sales, security page |
| Billing | `feature-billing.svg` | Credits & subscriptions | Pricing, billing dashboard, Stripe |

### Sizing
- **Large:** 1200x600 (full-width sections)
- **Medium:** 800x400 (blog posts, side panels)
- **Small:** 600x300 (cards, inline features)

---

## 7. Social Preview (`social-preview.svg`)

### Specs
- **Aspect ratio:** 1.91:1 (Open Graph / Twitter Card standard)
- **Native size:** 1200x630
- **Safe zone:** Logo + wordmark in left 60%, text/tagline in right 40%

### Platform Mappings
| Platform | Recommended Size |
|----------|-----------------|
| Twitter / X | 1200x630 (large summary card) |
| LinkedIn | 1200x627 |
| Facebook / OG | 1200x630 |
| Discord embed | 800x420 |

**HTML meta tags:**
```html
<meta property="og:image" content="https://appforge.dev/branding/social-preview.svg"/>
<meta name="twitter:image" content="https://appforge.dev/branding/social-preview.svg"/>
<meta name="twitter:card" content="summary_large_image"/>
```

---

## 8. Spacing & Layout

### Logo Clear Space
Minimum 16px padding on all sides of the logo mark. Never place closer than this to borders, text, or other elements.

### Wordmark Spacing
The wordmark underline accent (`rect` below text) must always remain 8-12px below the baseline. Do not crop it.

### Feature Illustration Padding
When placing inside cards or sections:
- Card border-radius: 12px (`rounded-xl`)
- Internal padding: 24px
- Never stretch — maintain 2:1 ratio

---

## 9. Export & Conversion

All assets are **native SVG** — editable in any vector editor or code editor.

### Why SVG over PNG
| Factor | SVG | PNG |
|--------|-----|-----|
| File size | ~2-15KB | ~50-300KB |
| Scalability | Infinite | Fixed resolution |
| Dark mode | Native (no separate variants) | Requires 2x exports |
| Editability | Code/Figma/Illustrator | Locked pixels |
| Animation | CSS/JS animateable | Static |

### Conversion Commands (when PNG/ICO fallback is needed)
```bash
# Install svgexport globally
npm install -g svgexport

# Hero banner → PNG (for email clients that block SVG)
svgexport hero-banner.svg hero-banner.png 1920:1080

# Logo mark → favicon ICO (browsers)
svgexport logo-mark.svg favicon.ico 32:32

# Wordmark → PDF (pitch decks)
npx svg2pdf wordmark.svg wordmark.pdf

# Social preview → JPG (LinkedIn sometimes prefers)
svgexport social-preview.svg social-preview.jpg 1200:630
```

---

## 10. Dos and Don'ts

### DO
- Use SVG assets directly in `<img src>` tags — browsers support SVG natively
- Scale to any size without quality loss
- Edit colors in the SVG source if you need to match a custom theme
- Use Deep Navy (`#080c18`) as the default background for all branded pages
- Combine Logo Mark + Wordmark for high-impact headers
- Maintain the 3-node constellation proportions in the logo

### DON'T
- Never change the node colors in `logo-mark.svg` (blue/cyan/silver = brand identity)
- Never place the logo on a busy/photographic background
- Never stretch or squash any illustration (maintain aspect ratios)
- Never use raster (PNG/JPG) as the primary asset — only as fallback
- Never use Electric Blue (`#4aa3ff`) on white/light backgrounds (illegible)
- Never crowd the logo mark — respect the 16px clear space

---

## 11. Quick Reference Card

```
┌─────────────────────────────────────────────┐
│  APPFORGE BRAND QUICK REFERENCE              │
├─────────────────────────────────────────────┤
│  Primary:    #4aa3ff  (Electric Blue)        │
│  Secondary:  #00e5ff  (Neon Cyan)            │
│  Background: #080c18  (Deep Navy)            │
│  Surface:    #0d1f38  (Slate)                │
│  Text:       #e2e8f0  (Silver)               │
│  Premium:    #fbbf24  (Gold)                 │
│  Reviewer:   #a855f7  (Violet)               │
│  Deploy:     #14b8a6  (Teal)                 │
├─────────────────────────────────────────────┤
│  Font: Inter / system-ui                     │
│  Headlines:  800 weight, 48-64px             │
│  Body:       400 weight, 14-16px             │
├─────────────────────────────────────────────┤
│  Logo mark:  logo-mark.svg (1:1)             │
│  Wordmark:   wordmark.svg (3.75:1)           │
│  Hero:       hero-banner.svg (16:9)          │
│  Social:     social-preview.svg (1.91:1)     │
│  Features:   feature-*.svg (2:1)             │
└─────────────────────────────────────────────┘
```

---

*Brand Kit v1.0 — Generated for Anselm04/AppForge — Trillion AI Tech*
