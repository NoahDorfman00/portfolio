# noahgdorfman.com — design language

The site should read like a well-made datasheet written by a person: strict structure, warm paper, and a voice that's allowed to be funny. Reference implementations: [`index.html`](../index.html) and [`projects/petlibro.html`](../projects/petlibro.html). All styles live in [`css/site.css`](../css/site.css); only use classes that exist there.

## Principles

1. **Structure, not costume.** Borrow a datasheet's discipline — grid, rules, tables — but none of its cosplay. No part numbers, rev tags, spec-sheet jargon, numbered "features," or fake technical ornaments.
2. **Tables are a feature.** Anything list-shaped (projects, experience, parts, states) is a table with hairline rows. It's the signature move.
3. **One signal color, used like a highlighter.** Amber marks what's live or interactive. It is never text.
4. **Let the work be the color.** Photos and real data carry the visual interest; chrome stays quiet.
5. **Sound like Noah.** Specific, first-person, a little dry. Explain why things exist, not just what they are.

## Color

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F4F2EC` | Page background (warm off-white) |
| `--paper-2` | `#EBE8DF` | Inline code, placeholders |
| `--ink` | `#141414` | Primary text, heavy rules |
| `--ink-2` | `#4A4740` | Secondary text, descriptions |
| `--muted` | `#807B70` | Labels, metadata, mono details |
| `--hair` | `#D6D1C5` | Row dividers |
| `--signal` | `#FFB341` | Amber: status dot, link underlines, chart lead, selection |
| `--signal-wash` | `rgba(255,179,65,.22)` | Row hover, highlighter marks, callouts |

Amber on paper fails contrast as text — use it only as fills, underlines, and dots. Text on amber is always `--ink`.

Light mode only for now. If dark mode comes later, it inverts paper/ink and keeps amber as-is.

## Type

IBM Plex Sans + IBM Plex Mono (Google Fonts). Weights: 400, 500, 600.

| Role | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Display (home name) | Sans | `clamp(48px, 7.5vw, 92px)`, leading .95 | 600 | -0.035em |
| Page title | Sans | `clamp(40px, 6vw, 72px)` | 600 | -0.035em |
| Section heading | Sans | 30px (h3 22px) | 600 | -0.02em |
| Lede | Sans | 22px / 1.45 | 400 | — |
| Body | Sans | 17–18px / 1.55–1.65 | 400 | — |
| Table text | Sans | 15px | 400 / 500 for names | — |
| Labels & metadata | Mono | 12–13px | 400 | — |

Sentence case everywhere — no all-caps labels. Mono is for small factual details only (years, stacks, timestamps, section labels), never for paragraphs.

## Layout

- Max width 1120px, gutter 32px (20px under 860px).
- **The rail:** most sections are a two-column row — a 220px mono label on the left, content on the right. Collapses to stacked under 860px.
- Header: name left, nav right, 2px ink rule beneath.
- Section rhythm: 56px vertical padding, 0.5px hairline between sections.
- **Rules carry hierarchy.** 2px ink rule = top of a table or block. 0.5px ink = table header bottom. 0.5px hair = between rows.
- No cards, no shadows, no rounded corners (except dots).

## Components

- **Link** — ink text with a 2px amber underline that fills the whole word on hover.
- **Table row** — hairline-separated grid; amber wash on hover; arrow nudges right if it links somewhere.
- **Now panel** — 2px top rule, pulsing amber dot, local clock, label/value rows. Values come from `data/github.json`.
- **Facts list** — `dl` with mono labels (Year, Made with, I did, Links).
- **Language bar** — single stacked bar, lead language in amber, the rest in ink tints; mono key beneath.
- **Problem → fix table** — the personality device: why each project exists, in one line.
- **Lessons** — numbered, bold title + one sentence, two columns on desktop. Keep to 3–6.
- **Callout** — amber wash block, reserved for warnings.
- **Pager** — previous / next project at the bottom of detail pages.

## Imagery

Every photo and video gets the **printed** treatment, so it sits on the paper like ink:

```css
img, video { filter: saturate(.75) contrast(1.08) sepia(.15); mix-blend-mode: multiply; }
```

Project images that live on a project's own site (social cards, App Store screenshots, screenshots of the live app) are pulled by [`scripts/sync-images.sh`](../scripts/sync-images.sh), which a weekly workflow runs. To add one, add a line to its manifest rather than copying the file by hand. Build photos are curated by hand.

Real photos of real builds (cutting mats, guts, the thing on the wall) beat renders and stock. Captions are mono, muted, short, and allowed to be funny.

## Motion

Minimal: link fill (.2s), row hover wash (.15s), arrow nudge, the status-dot pulse. No hover previews or popovers. No scroll-triggered animations, no particles.

## Data

`scripts/github-stats.mjs` writes `data/github.json` (needs `GITHUB_TOKEN`). It exposes public repo names only; private repos contribute only to aggregate language percentages. No contribution heatmaps or streaks.

## Voice

- First person. Concrete nouns over adjectives ("a button on the kitchen wall," not "an innovative IoT solution").
- Lead with the problem, then the fix.
- Dry humor is welcome in ledes, captions, and the problem → fix table; keep technical sections straight.
- Avoid: "passionate," "innovative," "leveraging," "solutions," emoji.

## Project pages

Full template (when the README is rich): title block + facts + hero media → Why → How it works → The build → What it taught me → Parts/stack → pager.

Short template (thinner projects): title block + facts + hero media → Why → a few images → pager.

## Social image

`assets/social.png` (1200×630) is rendered from [`social.html`](social.html) with the local server running:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=6000 --screenshot=assets/social.png http://localhost:8737/design/social.html
```

Bump the `?v=` on the `og:image` URLs when it changes so link previews refresh.
