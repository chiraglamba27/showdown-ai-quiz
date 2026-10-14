# DESIGN.md — SHOWDOWN // Live Game-Show Meets Print Poster

## 1. Aesthetic Direction: "Live Game-Show Meets Print Poster"
This is not a corporate dashboard, and it is not an AI chatbot wrapper. It is a live event instrument. It draws from:
- **Swiss Event Posters & Risograph Print:** Dense typography, heavy ink, intentional asymmetry, raw borders, hard offset drop shadows (`4px 4px 0px #000`), zero soft blurs.
- **Physical Game-Show Hardware:** Tactical buttons with mechanical press-states, high-contrast shape signifiers (▲ Triangle, ◆ Diamond, ● Circle, ■ Square), stark color blocks, and oversized typography engineered to be read from the back of a 200-seat lecture hall.
- **Brutalist Scale Contrast:** Tiny utility labels (`10px` mono uppercase) contrasted with colossal, room-shaking headers (`clamp(2.5rem, 6vw, 5.5rem)`).

---

## 2. The One Memorable Moment: The "Deal-Out" Generation
When the host submits a prompt (e.g. *"20 questions on Operating Systems"*), the interface does NOT show a boring loading spinner. 

Instead, the UI triggers a tactile **Card Deal Sequence**:
1. The prompt block drops down like an ink stamp.
2. Blank cards fly onto the canvas in a staggered mechanical cascade.
3. A raw mono teleprinter stream feeds into each card as the LLM synthesizes questions, printing the question stem, distractor options, and answer key in rapid succession.
4. Each validated card "snaps" shut with a hard black border and an audible/visual mechanical click.

---

## 3. Typography System
We load characterful display and monospace typefaces via Google Fonts:
- **Display / Question Face:** **Bricolage Grotesque** (900 Black & 800 ExtraBold) + **Space Grotesk**. Dense, punchy, slightly unruly ink traps. Used at extreme scales for the projector question, join codes, and headlines.
- **Body / Readable Copy:** **Instrument Sans** / **DM Sans**. Neutral, highly legible humanist grotesque for explanations and option body text.
- **Data / Metrics / Timers:** **JetBrains Mono**. Monospaced, tabular numbers for countdown timers, pin codes, scores, and token counters.

| Role | Font Family | Weight | Example Use |
| :--- | :--- | :--- | :--- |
| **Headline / Hero** | `Bricolage Grotesque`, sans-serif | 900 Black | Big Question Stem, Join Code, Victory Screen |
| **Section Header** | `Space Grotesk`, sans-serif | 700 Bold | Card Titles, Category Tags, Game Stage |
| **Body & Options** | `Instrument Sans`, sans-serif | 500 Medium / 600 SemiBold | Option text, explanations |
| **Mono & Telemetry** | `JetBrains Mono`, monospace | 700 Bold | Countdown (e.g. `00:15`), PIN `748 291`, Scores |

---

## 4. Color Palette & Game-Show Tokens

### Primary Canvas: Deep Print Ink (`#0a0b10`) with Raw Paper Overlay (`#f5f0e6`)
- **Canvas Base:** `#0a0b10` (Dark carbon ink)
- **Card Surface:** `#141721` (Cold iron) with accent layers in `#f4ede0` (Warm newsprint cream)
- **Key Foreground:** `#ffffff` (Pure white) and `#8f96a3` (Muted newsprint ink)
- **Hard Shadow:** `4px 4px 0px #000000` (Sticker/cutout poster depth)

### The Single Loud Accent: Signal Vermilion (`#ff371a`) + Electric Lemon (`#ffe500`)
- Primary event action, active countdown threshold, and stage markers.

### The 4 Game-Show Answer Channels (Color + Shape Signifier)
*Every option has a universal shape and letter to guarantee WCAG AA accessibility:*
- **Option A:** **Vermilion Red** (`#ff3344`) + **▲ Triangle**
- **Option B:** **Electric Cobalt** (`#2563eb`) + **◆ Diamond**
- **Option C:** **Signal Amber** (`#f59e0b`) + **● Circle**
- **Option D:** **Acid Emerald** (`#10b981`) + **■ Square**

### Correct / Incorrect State Invariants
- **Correct Key:** **Acid Hyper-Green** (`#00e676`) with glowing stamp `[CORRECT // 100 PTS]`
- **Incorrect Key:** **Muted Ash Charcoal** (`#1f2430`) with slashed boundary

---

## 5. Three Distinct Layout Surfaces

### Surface 1: Host Creator View (Desktop)
- Asymmetrical split layout.
- Left column: The "Dispatch Terminal" — raw prompt box with mechanical tactile presets (DBMS, OS, Networks), question count stepper, and difficulty toggle buttons.
- Right column: The question ledger. Cards are laid out like physical cue cards with drag handles, inline edits, and granular single-question re-roll levers.

### Surface 2: Host Live View (Projector-Friendly / Hero Screen)
- Engineered specifically for a lecture hall projector or 65" TV screen.
- **Giant Room-Scale Question:** `clamp(2rem, 5vw, 4.2rem)` line height `1.1`.
- **Top HUD:** Giant `6-digit PIN` (`JetBrains Mono`), participant head-count with live presence pulse, and progress indicator (`03 / 10`).
- **Urgent Timer Ring & Linear Gauge:** High-contrast mechanical bar with audio-visual acceleration in the final 5 seconds.
- **Live Answer Distribution Histogram:** Four giant vertical/horizontal meters showing real-time player votes with geometric shapes.
- **Podium / Leaderboard Reveal:** Physical rank-swapping animation with delta arrows (`▲ +3`).

### Surface 3: Participant View (Mobile-First / 390px Viewport)
- Designed for thumb reachability under table or in hands.
- Zero scrolling during active round.
- Four massive tap targets (minimum 72px height each), color-coded with tactile press states (`active:translate-y-1 active:shadow-none`).
- Haptic lock-in state: *"LOCKED IN • 1.42s"*.
- Reveal state: Screen pulses green (`CORRECT! +850`) or vermilion (`INCORRECT • Streak Broken`).

---

## 6. Prohibited Visual Tropes (Banned List)
- ❌ NO soft purple/blue/pink blurry radial gradients.
- ❌ NO gradient text clips (`bg-gradient-to-r text-transparent`).
- ❌ NO frosted glassmorphism (`backdrop-blur-xl bg-white/5`).
- ❌ NO decorative sparkles or floating AI stars.
- ❌ NO rounded-xl squircle uniformity.
- ❌ NO generic chart libraries with pastel defaults.
