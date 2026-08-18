# Fabuyo — Agency Website + Private Portfolio CMS

A dark, high-contrast, fully responsive agency site with a hidden, Firebase-secured
admin console. Built with **pure HTML5, CSS3 (variables/flex/grid) and vanilla ES6+
modules** — no framework runtime.

```
/
├── index.html          # Public agency portal & showcase
├── admin.html          # Private/Hidden admin portal & dashboard
├── firestore.rules     # Production Firestore security rules
├── storage.rules       # Production Storage security rules
├── css/
│   └── style.css       # Unified design system (CSS variables)
└── js/
    ├── firebase-config.example.js  # Safe placeholder reference
    ├── app.js                       # Public gallery, filters, contact form
    └── admin.js                     # Auth guard, uploads, CRUD logic
```

---

## 1. The hidden admin route

The public site contains **zero** links, buttons or references to the console.
Access it only by typing the address directly:

- `https://yourdomain.com/admin`, or
- `https://yourdomain.com/?page=admin` (instant redirect into the console)

The dashboard never renders until `onAuthStateChanged` confirms a signed-in
admin; signed-out visitors only ever see the login card and a dead end.
`admin.html` also ships `noindex, nofollow` meta by default.

---

## 2. Firestore database schema

### Collection: `projects`

| Field         | Type                 | Notes                                          |
| ------------- | -------------------- | ---------------------------------------------- |
| `title`       | string               | Project name (≤ 90 chars)                      |
| `category`    | string               | One of `E-commerce · Corporate · Service · Creative` |
| `description` | string               | Card copy (≤ 280 chars)                        |
| `liveUrl`     | string               | `https://…` — opened via “Live preview”        |
| `imageUrl`    | string               | Storage download URL for the screenshot        |
| `imagePath`   | string               | Storage path, e.g. `portfolio/17…x_home.webp` (used for cleanup on delete) |
| `createdAt`   | timestamp (server)   | Set on create                                  |
| `updatedAt`   | timestamp (server)   | Set on every save                              |

Example document:

```json
{
  "title": "Velvet Muse Boutique",
  "category": "E-commerce",
  "description": "Conversion-focused fashion storefront with lookbooks and a one-page checkout.",
  "liveUrl": "https://velvetmuse.example.com",
  "imageUrl": "https://firebasestorage.googleapis.com/v0/b/your-app.appspot.com/o/portfolio%2F1723456789_velvet.webp?alt=media&token=…",
  "imagePath": "portfolio/1723456789_velvet.webp",
  "createdAt": "2025-06-01T10:00:00Z",
  "updatedAt": "2025-06-01T10:00:00Z"
}
```

### Collection: `inquiries` (contact-form leads)

```json
{
  "name": "Ada Lovelace",
  "email": "ada@company.com",
  "company": "Analytical Engines Ltd.",
  "service": "Custom Web Development",
  "budget": "$3k – $10k",
  "message": "We need a new site before our September launch…",
  "status": "new",
  "createdAt": "serverTimestamp"
}
```

### Storage layout

```
/portfolio/{timestamp}_{sanitized-filename}.{jpg|jpeg|png|webp}
```

---

## 3. Security rules

- **`firestore.rules`** — public read of `projects`; create-with-schema of
  `inquiries`; **every other read/write requires authentication**. Includes
  field-type/size validation server-side.
- **`storage.rules`** — public read under `/portfolio/`; uploads restricted to
  authenticated users, **< 5 MB** and `image/jpeg | image/png | image/webp`
  only (mirrors the client-side validation in `admin.js`).

Paste each file into the matching **Rules** tab in the Firebase console
(Firestore → Rules, Storage → Rules) and hit **Publish**.

---

## 4. Setup checklist (5 minutes)

1. **Create a project** at <https://console.firebase.google.com> → *Add project*.
2. **Add a Web App** (`</>` icon) and copy the Firebase web configuration values.
3. **Add these Vercel Environment Variables**: `FIREBASE_API_KEY`,
   `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`,
   `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, and optionally
   `FIREBASE_MEASUREMENT_ID`.
4. **Enable auth**: Authentication → Sign-in method → **Email/Password** → Enable.
5. **Create your admin user**: Authentication → Users → *Add user*.
6. **Create databases**: Firestore Database → *Start in production mode*;
   Storage → *Get started*.
7. **Publish rules**: paste `firestore.rules` and `storage.rules` (above).
8. Done — visit `/admin`, sign in, publish your first project.

> The build generates `js/firebase-config.js` from Vercel variables. That file
> is ignored by Git; use `js/firebase-config.example.js` for local reference.

---

## 5. Run & deploy

ES modules require an HTTP origin (they will not run from `file://`):

```bash
# any static server works
npx serve .
# or Firebase Hosting
npm i -g firebase-tools && firebase login
firebase init hosting   # public dir: .  (answer "No" to SPA rewrite)
firebase deploy
```

---

## 6. Feature map

**Public (`index.html` + `js/app.js`)**
- Hero, services, process, trust sections, contact with client-side validation
- Live portfolio from Firestore — search by title + category filters,
  debounced, with graceful demo fallback and loading skeletons
- Contact leads written to the `inquiries` collection (validated client-side
  *and* by security rules)

**Admin (`admin.html` + `js/admin.js`)**
- Email/password sign-in, session guard, secure logout
- Realtime project table (onSnapshot) with stats and instant search
- Create/Edit modal with drag-and-drop screenshot upload, type/size
  validation and a live progress bar
- Delete removes the Firestore document **and** the Storage image;
  replacing an image cleans up the old file automatically
- Every write re-verifies an active session before touching Firestore

---

## 7. Responsive architecture (mobile-first)

`css/style.css` is authored **mobile-first**: every base rule describes the phone
layout, and each `min-width` tier progressively restores the desktop composition.
There are **no `max-width` layout queries**, so the PC rendering can never be
altered by a mobile fix.

| Tier   | Query                | What it restores                                            |
| ------ | -------------------- | ----------------------------------------------------------- |
| base   | `0 – 479px`          | Fluid 100% widths, single column, 16px gutters, stacked CTAs |
| **xs** | `min-width: 480px`   | Side-by-side buttons, 2-up stat cards, inline toolbars       |
| **sm** | `min-width: 641px`   | 24px gutters, full type scale, 2-col forms/footer/process    |
| **md** | `min-width: 861px`   | Desktop nav, 2-col services/why/contact, real admin table    |
| **lg** | `min-width: 1081px`  | Hero split + floating visual stage, 4-col process & footer   |

### Guarantees

- **Desktop is pixel-identical.** `.container` is `width:100%` with a padding
  gutter and `max-width: calc(1200px + gutters)`, so the desktop content box
  measures exactly **1200px** — the same as the original fixed rule.
- **`box-sizing: border-box`** is applied to `*, *::before, *::after`, so
  padding can never push an element past `100vw`.
- **No global `overflow: hidden`.** Horizontal overflow is prevented
  *structurally*: fluid widths, `min-width: 0` on every grid/flex child,
  `overflow-wrap: break-word` for long URLs, and real padding gutters.
  The only `overflow: hidden` declarations are scoped to decorative
  containers (hero orbs, marquee track, footer wordmark).
- **Stacking.** Hero split, services, why, contact, footer, form rows, dash
  toolbars and modal footers all collapse to a single column on mobile and
  return to their multi-column grids at their breakpoint.
- **Admin table reflow.** The `760px` min-width table is quarantined inside the
  `md` tier; on phones the same markup reflows into stacked cards — no
  horizontal scrolling, no CSS-driven squish.
- **iOS niceties.** Inputs render at `16px` on mobile (prevents Safari's
  zoom-on-focus) and revert to the design size at `sm`; touch targets are
  40px on phones; `text-size-adjust` is locked.

---

© Fabuyo Studio — crafted with precision, served at light speed.
