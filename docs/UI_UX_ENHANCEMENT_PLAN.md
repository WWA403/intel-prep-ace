# UI/UX Enhancement Plan

**Date:** November 23, 2025  
**Prepared by:** AI Assistant  
**Scope:** All UI/UX feedback to-date for the Hireo interview preparation tool.

---

## Inputs & Approach

Themes were clustered, conflicting recommendations were resolved using standard product heuristics (Nielsen-Molich, WCAG 2.1 AA, and common SaaS onboarding patterns), and resulting actions were sized with the “small team, limited audience” constraint in mind.

---

## Experience Themes & Recommended Actions

### 1. Access, Onboarding & Communication
- **Hireo landing unusable for guests:** “Start Research” remains disabled and there is no inline copy explaining that research requires authentication.  
  _Action:_ Detect `!user` upfront, swap the form for a compact “Sign in to start research” panel with CTA and sample output preview.
- **Navigation disappears for logged-out visitors:** Users lose the ability to reach docs/support once redirected to `/auth`.  
  _Action:_ Always render a lightweight navigation bar (logo + Docs + Support + Sign in) regardless of auth state.
- **Deep-link redirects lack context:** Visiting `/dashboard`, `/practice`, or `/profile` sends users to `/auth` with no explanation.  
  _Action:_ Pass the intended route as a query param and surface a banner (“Sign in to continue to Practice”) inside the auth screen.
- **Onboarding void:** No first-time guidance, presets, or empty-state education.  
  _Action:_ Add a three-step “How it works” strip on the home page and contextual empty states that describe the next action.

### 2. Copy, Typography & Form Inputs
- **Global glyph bug:** The letter “s/S” fails to render, making every string look corrupted.  
  _Action:_ Revert to the default font stack (Tailwind `font-sans`) until the custom font subset is fixed; regression-test Hireo auth copy.
- **Form bloat and unclear optionality:** Long research form overwhelms users and hides validation.  
  _Action:_ Split into “Required info” and “Advanced options” accordions, add inline validation + character counters, and highlight optional fields.
- **CV upload UX gaps:** Button implies functionality, but uploads neither persist nor show file names.  
  _Action:_ Until processing ships, disable the button, label it “Upload PDF (Coming Soon)”, and show privacy copy explaining the roadmap.
- **Auth tab data leakage:** Shared form state between Sign In/Up causes password bleed and confusing validation.  
  _Action:_ Maintain independent state per tab and add “Forgot password” + “Back to product” links.

### 3. Navigation & Information Architecture
- **Search selector purpose unclear & empty states weak:** Users do not realize it switches research sessions and it can appear empty.  
  _Action:_ Rename to “Active Research”, add helper text/tooltip, and show an inline empty state (“Run your first research to see it here”).
- **History access inconsistent:** Dashboard empty state references a TODO button; navigation history is conditional.  
  _Action:_ Implement a shared “History” sheet accessible from every page with recent searches, filters, and empty-state guidance.
- **Dashboard density:** Stage cards mix durations, guidance, and questions without hierarchy.  
  _Action:_ Collapse secondary details behind accordions and keep primary metrics (stage name, status, recommended action) visible.

### 4. Practice Experience
- **Swipe gestures conflict with scrolling & hints clash with content:** Users trigger actions accidentally and hints overlap.  
  _Action:_ Increase swipe threshold, ignore swipes when vertical scroll > certain delta, and move hints into a dismissible banner shown on the first card only.
- **Bottom navigation overlays question cards on mobile:** Sticky bar hides input fields.  
  _Action:_ Add `pb-24` to the scroll container, make the nav non-sticky below `md`, and enlarge question dots to ≥ 12px touch targets.
- **Setup wizard overwhelm:** Filters, stages, and difficulties all appear simultaneously.  
  _Action:_ Convert to a stepper (Goal → Stages → Filters → Review) with presets (“Quick practice”, “Deep dive”) and remembered defaults.
- **Voice recording + guidance honesty:** UI implies saving audio and always exposes detailed rationale.  
  _Action:_ Label recording as “Local preview only” until upload works and collapse rationale/company context behind a “Show details” toggle.

### 5. Accessibility & Responsiveness
- **Keyboard, ARIA, and contrast gaps:** Icon-only buttons lack labels, focus states are subtle, and muted text may fail WCAG.  
  _Action:_ Add `aria-label`s, increase focus ring contrast, and audit `text-muted-foreground` against WCAG 2.1 AA (4.5:1).  
- **Touch target sizing & safe areas:** Multiple controls (< 44px) and sticky elements ignore notches.  
  _Action:_ Enforce min 44x44px targets, add `pb-[env(safe-area-inset-bottom)]`, and test on iPhone SE + 14 Pro + Android mid-range.
- **Component overlap:** Navigation (`z-50`) competes with dialogs/sheets; progress dialog lacks scroll lock.  
  _Action:_ Define a z-index scale (`nav=40`, `dialog=80`, `toast=100`) and apply `overflow-hidden` to `<body>` while dialogs are open.

### 6. Feedback & Status Communication
- **Progress dialog & loading states inconsistent:** Some flows show basic spinners; others have no messaging.  
  _Action:_ Create a shared loading pattern (skeletons for content, progress dialog with “What’s happening” log, estimated time) and reuse everywhere.
- **Errors lack recovery paths:** Messages like “Please sign in to continue” appear only after time investment.  
  _Action:_ Pair each error with a clear CTA (“Sign in”), describe remediation steps, and log for support when retries fail.
- **Saved answers & notes uncertainty:** Users cannot tell when answers or session notes persist or how to edit them.  
  _Action:_ Provide inline success states (“Saved · 2:14 PM”), allow edits until session completion, and autosave notes with debounce.

---

## Component & Overlay Watchlist
- **Navigation vs. Dialog/Sheet:** Reduce nav z-index to 40 and bump modal overlays to at least 80 to avoid content peeking through.  
- **Practice swipe overlay:** Keep `pointer-events-none` but ensure overlay never exceeds card bounds on small screens.  
- **Progress dialog vs. header:** Increase dialog z-index to 90 and add backdrop blur plus scroll lock.  
- **Dashboard “Start Practice” CTA positioning:** Switch to flow layout on screens < 1024px to prevent clipping.  
- **Voice recording row:** Stack controls vertically below `md` to avoid collisions with note editor.

---

## Prioritized Backlog

| Priority | Theme | Key Fixes | Effort | Owner |
| --- | --- | --- | --- | --- |
| **P0** (Critical) | Rendering & Access | Fix missing glyph bug, gate Hireo form behind auth-aware CTA, always show navigation, add redirect context | 2-3 dev days | Frontend |
| **P0** (Critical) | Practice usability | Add content padding under sticky nav, raise swipe threshold, enlarge question dots, clarify swipe hints | 2 dev days | Frontend |
| **P1** (High) | Forms & Uploads | Progressive disclosure for research form, disable “Upload PDF” until ready, add validation feedback | 3 dev days | Frontend |
| **P1** (High) | History & IA | Ship cross-page history sheet, rename search selector, improve dashboard empty state | 3-4 dev days | Frontend |
| **P1** (High) | Accessibility | Define z-index scale, add ARIA labels and focus styles, enforce touch target sizing | 2 dev days | Frontend |
| **P2** (Medium) | Practice setup & guidance | Introduce presets/stepper, clarify voice recording limitations, collapse rationale details | 1 week | Frontend + Design |
| **P2** (Medium) | Feedback consistency | Shared loading/success patterns, error recovery CTAs, autosave session notes | 1 week | Frontend |
| **P3** (Low) | Visual polish | Standardize spacing, button sizes, progress components, and status badges | Ongoing | Design System |

_Effort assumes two engineers sharing work without over-engineering; backlog can be sequenced sprint-by-sprint._

---

## Quick Wins (≤ 1 week)
- Re-enable default font stack and smoke-test Hireo auth screens.
- Render navigation for all users with Sign In / Docs / Support links.
- Gate Hireo form with inline auth prompt and add sample data card.
- Disable CV upload buttons with “Coming Soon” badge + privacy copy.
- Increase practice question nav dots to 12px and add bottom padding.
- Introduce redirect-aware banner on `/auth` (“Sign in to resume Practice”).

---

## Validation & Follow-Up
1. **UI verification:** Mobile Safari (iPhone SE + 14 Pro), Android Chrome, Desktop Chrome/Safari/Edge.  
2. **Accessibility:** Run axe DevTools + manual keyboard walkthrough for home, auth, dashboard, and practice.  
3. **Analytics hooks:** Track Hireo CTA clicks when unauthenticated to confirm gating reduces dead-end attempts.  
4. **User testing:** 3 returning users (practice heavy) + 2 new users (landing → auth → dashboard) to confirm improvements reduce confusion.  
5. **Documentation:** Update `docs/UI_UX_REVIEW*.md` summaries once remediation ships instead of generating new stand-alone reports.

---

Delivering on the P0/P1 items will unblock new users, restore trust in the marketing surface, and stabilize the practice workflow without over-building. Remaining items can be folded into routine polish cycles as the team’s capacity allows.


