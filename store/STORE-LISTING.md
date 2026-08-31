# Colorable — Google Play Store Listing Kit
Package: `com.magiccoloringbook.colorable` · Version 1.0 (versionCode 2) · Epiphany Unlimited, Inc.

---

## App name  *(30 char limit)*

```
Colorable: Coloring Page Maker
```
`30/30` — Alternates if that reads long: `Colorable — Photo Coloring` (26) · `Colorable Coloring Pages` (24)

---

## Short description  *(80 char limit)*

```
Turn photos into coloring pages with on-device AI, then color them in.
```
`70/80`

---

## Full description  *(4000 char limit)*

```
Any photo can be a coloring page. Colorable makes it one in seconds — right on
your phone.

Pick a photo of your kid, your dog, your house, your favorite vacation moment.
Colorable's on-device AI traces it into clean, crisp line art. Print it, or
color it right in the app with brushes, a full color wheel, and pinch-to-zoom.

HOW IT WORKS

1. Add a photo. Pick one from your gallery with the standard Android photo
   picker.
2. Watch it transform. A neural line-art model turns the photo into a
   coloring page — entirely on your device, in seconds.
3. Color it in. Open the Coloring Studio: brush and eraser, a full color
   wheel, adjustable brush size and opacity, undo and redo, and natural
   pinch-to-zoom and two-finger pan.
4. Build a book. Collect your pages, give your book a title, and export a
   print-ready PDF coloring book.

MADE FOR COLORING

• On-device AI line art — no upload, no waiting on a server
• Coloring Studio with brush, eraser, color wheel, and hex color input
• Pinch to zoom, two-finger pan, and up to 20 steps of undo
• Stylus support with pressure sensitivity
• Save pages on your device and pick up where you left off
• Export a full coloring book as a PDF — print it or share it

YOUR PHOTOS STAY YOURS

Colorable processes photos entirely on your device. The AI model runs locally
— your photos are never uploaded, never stored on our servers, and never used
to train anything. Your finished pages are saved on your device, private to
your account.

Your account is just an email address, used to sign you in. You can
permanently delete your account and everything associated with it from inside
the app, at any time.

No ads. No trackers. No selling your data.

Read the full policy: https://colorableai.netlify.app/privacy

QUESTIONS

We answer our own support email: info@epiphanyunltd.com

Colorable is a product of Epiphany Unlimited, Inc.
```
`~1,900 / 4,000`

---

## Categorization

| Field | Value |
|---|---|
| App category | **Art & Design** |
| Tags *(pick 5)* | Coloring book, Drawing, Art & Design, Photo Editing, Creativity |
| Contains ads | **No** |
| In-app purchases | **No** *(the Android build ships no upgrade CTA — App.tsx:971. If Play Billing lands later, flip this and add SKUs.)* |

### Target audience — read before answering the form

Pick **13 and older** (or 18+). Do NOT include under-13 age groups even though
coloring appeals to kids: targeting children triggers Google's Families policy
(no account requirement for kids, teacher-approved review, restricted APIs),
and Colorable requires an email account. "Appeals to all ages but targeted at
adults who print pages for their kids" is the honest and compliant answer.

---

## Contact details

| Field | Value |
|---|---|
| Email | `info@epiphanyunltd.com` |
| Website | `https://colorableai.netlify.app` |
| Phone | *optional — leave blank* |
| Privacy policy | `https://colorableai.netlify.app/privacy` |
| Data deletion | `https://colorableai.netlify.app/privacy` *(Account & Data Deletion section — merge web PR #6 and redeploy BEFORE submitting, or reviewers see the homepage)* |

---

## Data safety form — answers

| Question | Answer |
|---|---|
| Does your app collect or share user data? | **Yes** (account data only) |
| Data collected | **Email address**, **Name** (display name) — for Account management |
| Is it shared with third parties? | **No** (processor: Supabase, acting on our behalf) |
| Is it encrypted in transit? | **Yes** |
| Can users request deletion? | **Yes** — in-app Delete Account + web page |
| Photos/Videos collected? | **No** — processed on-device only, never transmitted |

The on-device claim is literally true and load-bearing: `services/geminiService.ts`
has no network path for photos (the Gemini fallback was removed for exactly this
declaration). Do not re-add one without updating this form.

---

## Release notes  *(500 char limit, "en-US" release)*

```
First release of Colorable.

Turn any photo into a clean coloring page with on-device AI — photos never
leave your phone. Color pages in the studio with brushes, a full color wheel,
pinch-to-zoom, and undo/redo. Collect pages into a book and export a
print-ready PDF.
```
`~280/500`

---

## Graphics

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, no alpha | ⬜ export from `android/app/src/main/res/mipmap-*` source art |
| Feature graphic | 1024×500 PNG/JPG, no alpha | ⬜ create — photo → line art split makes itself |
| Phone screenshots | 2 min / 8 max · 9:16 or 16:9 · 320–3840 px per side | ⬜ capture on device |
| 7" / 10" tablet | same specs | ⬜ optional — use the Fold unfolded |

### Screenshots to capture (in this order)

1. **Workspace, empty state** — the "Add Page" tile as the clear call to action
2. **Before/after** — a photo tile next to its finished line-art page
3. **Coloring Studio mid-color** — half-colored page, color wheel open
4. **Pinch zoom** — zoomed into a detail while coloring
5. **The book** — several finished pages in the grid, book title visible
6. **PDF export** — the finished book preview

Shoot at 1080×2400 on the Fold's cover screen (`adb shell screencap`, or
Power+VolDown). Use photos you own — a pet or a landscape demos best; avoid
identifiable strangers. Play won't promote the listing with fewer than 4
phone screenshots, so shoot at least 4 even though 2 passes validation.

---

## Pre-submission checklist

- [ ] Merge web PR #6 (`/privacy` route + deletion section) and redeploy the site
- [ ] Merge web PRs #4/#5 if not already (email redirect fix, per-user data + backdoor removal on web)
- [ ] Supabase: Site URL set to `https://colorableai.netlify.app` (Auth → URL Configuration)
- [ ] Supabase: custom SMTP configured — the built-in mailer's ~2 emails/hour will strand real users at signup
- [ ] Netlify env vars set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (delete-account function), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Upload `android/app/build/outputs/bundle/release/app-release.aab` to the internal testing track first; verify signup → color → delete-account once via the Play-delivered build, then promote
