# Glossary

Domain terms used in code, docs and decisions. Product context is in `PRODUCT.md`; the reasons behind each choice are in `DECISIONS.md`.

- **Campaign:** one fundraising effort with its panel at `/<slug>/painel`, stored in KV as a page config (`PageConfig`). Either one-time or monthly, never both (D6, D7).
- **Campaign setup:** creating, editing and deleting a campaign in `/admin`: validating the form, resolving the payment link, getting a short link, writing to KV. Lives in `src/campaign-setup.ts` (D28, planned).
- **Short link:** the dub.sh link the QR and the button lead to. It belongs to a campaign when it points at that campaign's payment link code. `src/dub.ts` owns the rules (D28, planned).
