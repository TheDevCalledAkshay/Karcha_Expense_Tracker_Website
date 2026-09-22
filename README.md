# Karcha 💸

A local-first expense tracker — static site, no server, no accounts. All data lives in your browser (localStorage). Installable PWA: works offline on phone and laptop.

## Run locally

Open `index.html` in a browser, or serve it (needed for full PWA/offline features):

```
npx serve .
```

## Deploy to GitHub Pages

1. Create a repository on GitHub (e.g. `karcha`).
2. Push the contents of this folder to the `main` branch:
   ```
   git init
   git add .
   git commit -m "Karcha"
   git branch -M main
   git remote add origin https://github.com/<username>/karcha.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)` → Save**.
4. Your app is live at `https://<username>.github.io/karcha/`.
   - **Phone:** open in Chrome/Safari → menu → *Add to Home Screen / Install app*.
   - **Laptop:** open in Chrome/Edge → install icon in the address bar.
   - Works fully offline once installed. Data is per-device/per-browser (clearing site data wipes it — use Settings → Export backup first).

## Updating the app

If you change `index.html` / `style.css` / `app.js`, bump `CACHE_NAME` in `sw.js` (e.g. `karcha-v1` → `karcha-v2`) so installed clients pick up the new version on their next visit.

## Files

- `index.html` / `style.css` / `app.js` — the app
- `manifest.webmanifest` — PWA identity (name, icons, colors)
- `sw.js` — service worker (offline cache)
- `favicon.svg`, `icon-*.png`, `maskable-*.png`, `apple-touch-icon.png` — icons
