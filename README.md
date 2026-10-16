# SR Chess Academy — Website Rebuild ♟️

> Modern rebuild / redesign of **Shivika Rohilla Chess Academy (srchessacademy.com)** — Delhi chess school since 2020. Static multi-page site + interactive Three.js 3D hero.

![HTML](https://img.shields.io/badge/HTML-Vanilla-orange)
![CSS](https://img.shields.io/badge/CSS-Custom-blue)
![JS](https://img.shields.io/badge/JS-ES_Modules-yellow)
![Vite](https://img.shields.io/badge/Vite-8-purple)
![Three.js](https://img.shields.io/badge/Three.js-0.185-black)

## ✨ What It Does

- 🏠 **New frontend** (~25 pages + 17 blog posts) — replaces live site
- ♟️ **3D pipeline:** Blender `Chess Scene.blend` + TurboSquid Wooden King/Queen OBJ → `public/ChessScene.glb` hero

### Homepage Highlights (`index.html` 645 lines)
Loading solar-system overlay, checker `#grid-trail-container`, 2x full-page canvases `#webgl-board / #webgl-pieces`, chapter-rail (pawn→king), board-scatter stats (148.2K sessions / 3085+ enrollments count-up), Dream Move, psychology, services bento, founder WIM Shivika Rohilla, 5-level ladder, coach slider (GM Tejas Bakre + IMs), testimonial deck carousel.

### Inner Pages Logic (`main.js` 972 lines / `inner.js` 375 lines)
Scroll-measured 3D phases (`kingIn/Hold/Out`, `queenIn/Hold/Out`), raycast hover, drag-rotate, parallax, `IntersectionObserver` reveals, lightbox `dialog`, shop cart (`localStorage srca-cart` + ₹ + filters), 10-Q parent/child stress scoring, mock mobile→OTP auth, form toasts.

Pages: `coaching, consultation, coffee-connect, workshops(-school/-parents/-corporate), social-media-management, coaches_details, blog, gallery, shop, cart, faq, contact, career, privacy/terms/shipping/refund, signin/signup`

## 🎯 Features in Detail — What it does & How it helps you (students / parents / academy)

| Feature | What it does | How it helps you |
|---------|--------------|------------------|
| ♟️ **Interactive 3D hero (Three.js GLB)** | Scroll-driven King/Queen intro-hold-outro, hover glow, drag-rotate, checker floor + chapter-rail pawn→king. | Wow factor = longer stay + more trial bookings. Kids love playing with pieces. |
| 🏆 **Trust stats + Founder story** | Count-up 148.2K sessions / 3085+ enrollments, WIM Shivika Rohilla profile, 5-level ladder (Beginner→Tournament). | Parents trust numbers + Woman International Master title → higher conversion. |
| 👨‍🏫 **Coaches slider (GM + IMs)** | Cards for GM Tejas Bakre, IMs, with photo, rating, specialty, Book-trial CTA. | Pick right coach by level, one-click trial — no phone chase. |
| 📝 **Coaching / Consultation / Coffee-Connect** | Level-wise syllabus, 1:1 consultation form, casual coffee meetup booking + toast confirm. | Clear path from “curious” → “paid batch” in 3 clicks. |
| 🏫 **Workshops (School / Parents / Corporate)** | Separate pages with agenda, age group, duration, bulk enquiry form. | Schools book bulk workshops, parents learn support, corporates book team events. |
| 🛒 **Merch Shop + Cart (₹, localStorage)** | Boards, clocks, books with filters, qty +/-, cart persists, checkout mock. | Extra revenue + brand — kids want academy T-shirt/board. |
| 🧠 **Parent/Child Stress Test (10-Q PSS)** | 10-question psychology quiz, instant score + tips (psychology section tie-in). | Shows academy cares about mental toughness → differentiator vs rote coaching. |
| 📰 **Blog (17 posts) + Gallery + Testimonials** | SEO posts (e.g. mental-toughness), lightbox gallery, deck carousel reviews. | Google traffic + proof — parents read before paying. |
| 🔐 **Signin/Signup (mobile→OTP mock) + FAQ/Contact/Career** | Mobile OTP UI, FAQ accordion, contact form, career apply, privacy/terms/shipping/refund. | Low-friction login, fewer support calls, hiring pipeline built-in. |

## 🛠️ Tech Stack

- Frontend only (no backend/DB): Vanilla HTML + `style.css` + `pages.css` + ES-modules
- Build: Vite 8.2 with custom `htmlIncludes()` (`<!-- @include partials/*.html -->`) + auto multi-page `htmlEntries()` (root + `blog/`)
- 3D: `three 0.185.1` (`GLTFLoader`, `OBJLoader`), auto-scaled board (~13 units)
- Fonts/CDN: `Cinzel + Plus Jakarta Sans`, `font-awesome 6.5`
- State: `localStorage` cart only

## 📁 Project Structure

```
chess-homepage/
├── index.html, about.html, coaching.html, coaches.html, cart.html, signin/signup...
├── blog/ (17 posts, e.g. mental-toughness-in-chess.html)
├── partials/ nav.html, footer.html, head.html
├── main.js, inner.js, style.css, pages.css
├── vite.config.js, package.json
├── public/ ChessScene.glb + 12926*/12927* .obj/.mtl/.jpg
└── dist/ (built output)
```

## 🚀 Getting Started

```powershell
npm install

# Dev
npm run dev
# → http://localhost:5173/

# Build + preview
npm run build
npm run preview
# output: dist/

# Static preview without Node:
python -m http.server 8080
# then /dist/index.html for build
```

## 👤 Client

**Shivika Rohilla Chess Academy** — rebuild by Veer / office team. Original: srchessacademy.com
