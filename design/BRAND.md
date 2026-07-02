# BAM BURGER — Brand Design System

> ملف حيّ لهوية BAM Burger. نبنيه حبة حبة ونرجع له كمرجع لأي صفحة/أصل بصري.
> Living brand reference for the BAM Burger identity. We build it up piece by piece.

- **Brand:** BAM Burger
- **Concept designer:** Anouchka d'Oreye
- **Status:** WIP — colors/type approximated from the identity deck & photos; replace `≈` values with exact source values when available.
- **Source files:** brand deck (Behance / `Google.pdf`), poster (`assets/bam-poster.jpg`), mascot (`assets/bam-mascot.png`).

---

## 1. Concept & Voice

> "Bam Burger reinvents street food with a bold format and a generous attitude.
> The star of the concept? A **UFO-style burger: fully sealed**, easy to eat on the
> go, and packed with flavor in every bite. No mess, just maximum pleasure.
> A brand that speaks **loud and clear: energetic, playful, and instantly recognizable.**"

**Personality:** loud · playful · retro/groovy · streetwear · confident · a little cheeky.

**Voice do's:** short, punchy, ALL-CAPS statements. Wordplay. Confidence.
**Voice don'ts:** corporate, soft, over-explained.

---

## 2. Taglines & Slogans

| Line | Use |
|---|---|
| `NOT YOUR USUAL BURGER.` | primary tagline (with the period) |
| `NO MORE BORING BURGERS` | poster / packaging band (repeats top & bottom) |
| `FRESH FRESH FRESH` | pattern / merch (outlined, warped, repeated rows) |
| `SALTY` | sticker / accent blob |
| `FRESH` | sticker / accent blob |

---

## 3. Color Palette

Bright, high-contrast, retro. Red + cream is the core; pink & teal are supports.

| Token | Role | HEX (≈, confirm) | Site `oklch()` token (current) |
|---|---|---|---|
| **Red** | primary / type / logo | `#E62D1A` | `--red: oklch(0.635 0.243 27)` |
| **Red deep** | stroke / shadow | `#B21D10` | `--red-deep: oklch(0.505 0.215 28)` |
| **Cream** | paper / panels / logo bg | `#F4EBD8` | `--cream: oklch(0.955 0.026 78)` |
| **Pink** | soft background | `#F6D8E4` | `--pink: oklch(0.905 0.055 350)` |
| **Pink deep** | background gradient end | `#F3C4D6` | `--pink-deep: oklch(0.845 0.092 352)` |
| **Teal** | accent / photo skies | `#17697A → #4FA0A0` (gradient) | `--teal: oklch(0.515 0.092 215)` |
| **Ink** | outlines / body text | `#2A1410` | `--ink: oklch(0.245 0.045 40)` |

**Pairings that work:** red-on-cream (primary lockup) · red-on-pink (taglines) · cream-on-teal (photo overlays) · red outline + cream fill (oval, tickets).

> ⚠️ The web build currently uses `--red ≈ #FF2E1F` (a touch more orange than the deck's `#E62D1A`). Align to `#E62D1A` when we finalize.

---

## 4. Typography

### 4.1 Display / Logo face — "the wavy BAM"
The signature face: **ultra-bold, rounded, groovy 1970s display lettering with a hand-drawn wave/wobble.**
- Very heavy weight, small rounded counters, soft blobby terminals.
- Tight kerning — letters nearly touch, horizontally **and** vertically.
- Each repetition is slightly different (hand-lettered feel), not geometric.
- `A` = rounded apex (no sharp point), low crossbar · `M` = splayed rounded legs · `B` = full round bowls.

**Web status:** no exact free match. Current fallback in the teaser is **Lalezar** (rounded/bold, but NOT wavy).
**Candidates to test for the wave:** `Bagel Fat One`, `Shrikhand` (Google Fonts).
**Best fix:** rebuild the primary lockup as a **hand-tuned SVG** (see §5).

### 4.2 Secondary / body — mono (confirmed)
Menu descriptions, the French formula line, and small print are all set in a **light monospaced / typewriter** face, **red, UPPERCASE, letter-spaced**. Headings (`MENU`, `SIDES`, `SAUCES`) stay in the wavy display face — the mono is only for supporting copy.
- **Candidate:** `Space Mono`, `JetBrains Mono`, or similar.
- **Contrast rule:** big wavy display heading ↔ small mono caps body. Never set headings in mono or body in the display face.

### 4.3 Arabic (web)
- **Tajawal** (400/500/700/800/900) for all Arabic UI copy.

---

## 5. Logo & Lockups

### 5.1 Primary lockup — `BAM / BAM / BAM` + `BURGER` oval
- Cream near-square panel; `BAM` stacked ×3 filling edge-to-edge.
- Horizontal red-outlined **oval** (cream fill) across the middle row with `BURGER` inside, letters slightly arched to follow the ellipse.
- **TODO:** rebuild as clean SVG. AI generation was rejected (uneven letters, mushy wave).

### 5.2 Mascot — "walking BAM" (the UFO burger)
- A **horizontal red oval body** (reads as a flying saucer / UFO — ties to the "UFO-style burger" concept) with `BAM` lettered across it in cream, same wavy style.
- Thin line-art **arms** (one raised with a ✌️ peace sign) + **legs** in cream trousers with chunky **red sneakers**, mid-walk stride.
- Style: minimal red line-art, single red color, playful.
- Used on: menus, signage, storefront, merch, packaging.
- ⚠️ **Not used on the puzzle teaser** (product must stay hidden pre-reveal).

### 5.3 Single wavy `BAM`
- Standalone wordmark for tight spaces / header.

**Clear space & don'ts:** don't stretch, recolor outside palette, add effects/gradients to the letters, or use the mushy AI version.

---

## 6. Imagery / Art Direction

- **Retro film look:** warm grain, slightly faded, 90s/2000s point-and-shoot.
- **Streetwear + deli energy:** subjects in tracksuits; supermarket/deli backdrops; teal studio skies.
- **Signature props:** menu card on a **red string with a wooden clothespin**; tomatoes; cream tees with red `FRESH` print.
- **Packaging:** plain **white sealed takeaway box** with small red BAM logo (the "UFO-style, fully sealed" burger).

---

## 6b. Patterns & Motifs

### `FRESH` repeat (outline warp)
- The word **`FRESH`** stacked in ~6 rows, filling the frame edge-to-edge on **cream**.
- **Red outline only** (no fill), same heavy rounded display face.
- Rows are **warped / arched** (subtle "puff/arc" wave) so the block ripples.
- The **walking BAM mascot** (filled red) sits centered on top of the pattern.
- Used on: merch (tee backs), posters, backgrounds.
- **Web use idea:** subtle looping `FRESH` outline strip as a section divider or reward-screen backdrop (low opacity so it doesn't fight the content).

### `NO MORE BORING BURGERS` band
- Red caps line repeated top & bottom of the hero poster, framing the subject.

---

## 7. Menu (from the deck)

### Burgers
| Name | Ingredients | Price |
|---|---|---|
| **THE BAM EFFECT** | Angus beef, maturated cheddar, pickled onions, tomato, BAM secret sauce | 10€ |
| **THE OSLO TRIP** | Fresh salmon, cream cheese, red onions, fresh herbs | 12€ |
| **THE BAM TRUFFLE** | Angus beef, 10-months Comté, pickles, arugula, red onions, truffle sauce | 15€ |

### Sides — 4€ each
FRESH FRIES · CORN · MIXED SALAD

### Menus (combo = burger + side + drink + sauce)
| Menu | Price |
|---|---|
| MENU BAM SALMON | 17€ |
| MENU BAM CHICKEN | 15€ |
| MENU BAM BEEF | 17€ |
| MENU BAM ITALIAN | 15€ |

### Sauces — 0.80€
KETJEP · DALLAS · COW-BOY · MAYO · 16-20 · BRAVA

### Menu layout & icon system
Two menu formats exist:
- **À la carte** — cream card, huge red wavy `MENU` heading, items with a **thin red rule under each name spanning to the right-aligned price**, mono description beneath. Mascot sits **bottom-right**. Presented pinned to a **red string with a wooden clothespin** on a teal sky.
- **Combo (pink card)** — centered `MENU` heading, a **rounded-rect box with a pictographic formula row**: `BAM (mascot) ➕ SIDE (bowl) ➕ BOISSON (cup w/ straw) ➕ SAUCE (sauce cup)`, French mono line under it, the `MENU BAM …` list with right-aligned prices, then a bordered **`SAUCES`** box.

**Recurring layout habits:**
- Generous **negative space**; content anchored, not crowded.
- **Mascot almost always bottom-right** as a signature sign-off.
- Simple **red line-art icons** (side bowl, drink, sauce cup) — thin, single-color, playful.
- Prices **right-aligned**, item names left, thin red leader rule between.

---

## 8. Web Implementation Notes

- **Teaser page:** `/bam-puzzle` (`bam-puzzle.html`) — hidden pre-launch teaser + jigsaw + reward.
- Design tokens live in the `:root{}` block of `bam-puzzle.html` (colors above, `--ease`, shadows).
- Fonts loaded: `Lalezar` (display) + `Tajawal` (Arabic) via Google Fonts.
- **Reward save-card:** canvas story image (1080×1920); must `await document.fonts.load(...)` before drawing (otherwise falls back to a default font).

---

## 9. Assets Inventory

| File | What |
|---|---|
| `assets/bam-poster.jpg` | "NO MORE BORING BURGERS" hero poster (used as puzzle art) |
| `assets/bam-mascot.png` | walking BAM mascot |
| _todo_ | clean SVG of the primary `BAM/BAM/BAM` lockup |
| _todo_ | transparent PNG/SVG of single wavy `BAM` |

---

## 10. Open TODOs

- [ ] Confirm exact HEX values from the source (red/cream/pink/teal).
- [ ] Identify or license the real display font (or finalize the SVG lockup).
- [ ] Rebuild primary lockup as vector; add to `assets/`.
- [ ] Align web `--red` to the true brand red.
- [ ] Add the mono body font for menu-style text.
