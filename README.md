# kayura.github.io

Personal site for Kayura Narayanan. React 19 + Vite + Tailwind v4, with custom WebGPU shader effects.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # outputs to dist/
npm run preview
```

Requires Node >= 20.19 (Vite 8).

## Deploy (GitHub Pages)

1. Create a repo named **`kayura.github.io`** under the `kayura` account and push this to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml` and publishes `dist/`.

Tip: after your first `npm install`, commit `package-lock.json`, then change `npm install` → `npm ci` (and add `cache: npm`) in the workflow.

### Custom domain later

1. Add a `public/CNAME` file containing just your domain (e.g. `kayura.dev`).
2. Set the domain under Settings → Pages and point your DNS at GitHub Pages.

`base` is `/` (correct for both `kayura.github.io` and a custom domain). Only if you deploy to a *project* repo
(`user.github.io/some-repo`) do you need `VITE_BASE=/some-repo/` at build time.

## Project layout

```
src/
  App.tsx, main.tsx, index.css
  lib/
    custom-effect-runtime/   # ShaderEffect / ShaderFill + WebGPU runtime (from Figma)
    custom-effects/          # the wave + ripple shaders
public/
  assets/                    # SVGs/PNG referenced by App.tsx (via import.meta.env.BASE_URL)
  favicon.png
```

## Browser support notes

The shaders use **WebGPU** and the experimental **HTML-in-canvas** API.

- Without WebGPU: `ShaderEffect` falls back to rendering its children (the static pink mask), and `ShaderFill`
  renders nothing, so the animated wave background is simply absent.
- Without HTML-in-canvas (currently behind a flag in Chromium): the ripple effect won't work as intended.

Check current support before relying on it.

## Fonts

`src/index.css` loads fonts from `static.figma.com`. That's a hotlink you don't control; consider self-hosting
(all four are on Google Fonts: Rubik Burned, Rubik Doodle Shadow, Rubik Iso, Cormorant Garamond).
