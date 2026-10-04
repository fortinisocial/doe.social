---
target: loucas-por-tennis A page
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:/Users/bruno/www/fortini/doe.social/.claude/worktrees/rippling-riding-mountain/public/loucas-por-tennis/index.html"
target_fingerprint: "sha256:1bba0282ef5e9b42a8be81b5560931606a97faf7d78fb3109411edec7e161933"
target_path: /Users/bruno/www/fortini/doe.social/.claude/worktrees/rippling-riding-mountain/public/loucas-por-tennis/index.html
timestamp: 2026-10-03T21-19-34Z
slug: public-loucas-por-tennis-index-html
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 22/32 (n/a: 7, 10) — Acceptable (69%)
1 Status 2 (no "goes to Stripe", progress hidden) · 2 Real world 3 · 3 Control 3 (no lightbox swipe) · 4 Consistency 3 (logo link same-tab; Fortini naming) · 5 Error prevention 3 · 6 Recognition 3 · 7 n/a · 8 Minimalist 3 (repetition) · 9 Recovery 2 (no "how to cancel") · 10 n/a

## Design specificity
Content specific (real photos, invite, transparency, proof links); form generic NGO template; "Ajude a transformar vidas" category-generic; Neris Light gray + one teal reads corporate, not alegre. Detector: 2 warnings, both false positives (broken-image on lightbox img :234; clipped-overflow-container on main.page overflow-x). No overlay (agent-browser eval blocked by worktree guard). Boleto claim refuted: Stripe live shows the 4 links card-only, submit_type donate; D15 text stale.

## Priority issues
- [P1] Mobile sticky "Doar todo mês" bar covers H1 (360x640) / lead (375x812) before the reason to give. Fix: reveal after .lead scrolls past; smaller thumbs on phones. /impeccable adapt
- [P1] Thin reassurance at the moment of giving: .micro 14px Light --note gray; no "how to cancel"; links use Stripe default confirmation with no custom message. Fix: 15–16px --muted; what-happens-next line; custom thank-you on links (live Stripe write, ask first). /impeccable clarify
- [P2] Real progress hidden: /dados has donors and R$/mês vs R$ 1.000 goal. Fix: small live line near amounts hidden at zero/failure, or link to /painel. /impeccable delight
- [P2] ~1 MB images on first load: hero full/tenis.webp 513 KB for ~335px slot; thumbs 1000² 130–190 KB at ~107px. Fix: srcset/sizes, 400–600px thumbs. /impeccable optimize
- [P2] Repetition: logo "transformando vidas!" next to H1; "10 anos" x3; Fortini x3. Fix: drop "10 anos" from trust line (also fixes desktop wrap). /impeccable distill

## Persona red flags
Jordan: LT monogram unreadable; Selo Doar opaque; no "goes to Stripe". Casey: taps bar before reading; no lightbox swipe; _blank in WhatsApp webview. Riley: cancel path unexplained; no dead-link fallback; 820px bar 780px over 536px column. Friend 40–60: Neris Light 300 gray thin on low-end Android; expects Pix, one-time Pix unconfirmed.

## Minor
figcaption orphan "Horizonte" (text-wrap: balance); faint lightbox focus ring; desktop photo column top misaligned; #sticky outside landmark; amount names "sugerido R$ 50 /mês"; photo links don't announce viewer; "paga o dia a dia" overstates -> "ajuda a pagar"; "para que cada oficina continue acontecendo" brushes skill rule; D15 text stale.

## Questions
1. Why does the inviting friend vanish after line one? 2. Why hide the existing scoreboard? 3. Is R$ 50/mês card the right default vs one-time Pix?
