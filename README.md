# 🇩🇪 Deutsch Vocab

A mobile-optimized Progressive Web App for practicing A1-level German vocabulary. Built with vanilla HTML, CSS, and JavaScript — no frameworks, no dependencies.

## Features

- **501 A1-level German nouns** across 20 categories
- **Two-step quiz**: pick the English meaning, then pick the correct article (der/die/das)
- **3 practice modes**:
  - All Words — random from the full database
  - By Category — focus on a specific topic (animals, food, family, etc.)
  - By Article — practice only der, die, or das words
- **Progress tracking** — mastered words saved per browser via localStorage
- **Streak tracking** with best streak record
- **Offline support** — works without internet after first visit (Service Worker)
- **PWA installable** — add to Home Screen for a native app experience
- **A2 & B1 levels** — coming soon

## Getting Started

### Run locally

```bash
# Clone the repo
git clone https://github.com/abubakr380/german.git
cd german

# Serve with any static file server
python3 -m http.server 8080

# Open http://localhost:8080
```

### Install on iPhone

1. Open the URL in **Safari**
2. Tap **Share** (↑) → **Add to Home Screen**
3. Opens fullscreen without browser chrome

## Tech Stack

- **HTML5** — semantic structure
- **CSS3** — iOS-inspired dark mode, glassmorphism, animations
- **Vanilla JS** — quiz engine, localStorage, Service Worker
- **PWA** — manifest.json + sw.js for offline & installability

## Project Structure

```
├── index.html       # App shell with all views
├── style.css        # Design system & responsive styles
├── app.js           # Quiz engine, navigation, state management
├── words.js         # A1 vocabulary database (501 nouns)
├── sw.js            # Service Worker for offline caching
└── manifest.json    # PWA manifest
```

## Multi-user

Each user gets their own independent progress — data is stored in the browser's localStorage, so sharing the same URL works out of the box.

## License

MIT
