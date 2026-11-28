# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` first.** It is the binding handoff contract for this repo: the non-negotiables
(Angular, styling, content and honesty rules), the exact verification sequence to run before
reporting done, and scope rules (no commits, no deploys, declare new dependencies). This file
does not repeat those rules; it adds commands and architecture context.

Spec documents, in authority order: `docs/PLAN.md` (do only the current phase), `docs/TRD.md`,
`docs/PRD.md` (§2 honesty guardrails are binding). `docs/README.md` holds current status.
Never implement from `docs/_archive/`. The root `README.md` is unedited Angular CLI boilerplate.

## Commands

```bash
npm start                    # ng serve, http://localhost:4200
npm run lint                 # ng lint (angular-eslint + typescript-eslint)
npm test                     # Vitest via @angular/build:unit-test, watch mode
npm run test:ci              # one run with coverage; enforces the coverage thresholds
npm run build:prod           # test:ci, then production build (prerendered static output)
node scripts/check-contrast.mjs   # WCAG AA check of the theme token pairs

# Single spec file / single test name
npm test -- --watch=false --include src/app/content/content.validation.spec.ts
npm test -- --watch=false --filter "rule 9"
```

Coverage thresholds (80% lines for `src/app/content/**` and `src/app/core/**`) live in
`vitest-base.config.mts`, loaded by `angular.json` as `runnerConfig`. Bundle budgets
(initial 300 kB warn / 350 kB error, component style 6/10 kB) are in `angular.json`.
Neither may be loosened to get a build through.

## Architecture

- **Static prerender, no runtime server.** `angular.json` sets `outputMode: "static"` with
  `src/main.server.ts` / `src/server.ts` used only at build time. `src/app/app.routes.server.ts`
  prerenders `''` and `404` and client-renders `**`; `RenderMode.Server` is rejected in static
  mode. Output is `dist/portfolio/browser/`; `404/index.html` is the file the host's error
  mapping points at (TRD §4.1 records the verified output layout).
- **Single page.** `pages/home/home.html` composes the section components in
  `pages/home/sections/*` (hero, currently, about, experience, skills, projects, contact). Nav is
  anchor links to section ids; `pages/not-found` serves both `/404` and the wildcard.
- **Content layer.** `src/app/content/models.ts` defines the types (`Level` is the only
  proficiency scale; there is deliberately no phone field). The other modules (`profile`,
  `experience`, `projects`, `skills`, `certs`, `about`) hold the data. Sections read from these;
  reusable presentational pieces are in `src/app/shared/*` and the shell in `src/app/layout/*`.
- **Content gate.** `src/app/content/content.validation.spec.ts` encodes the PRD honesty rules
  as tests (no placeholders, timeline must back the year claims, ordinal skill levels only, no
  React claim, no phone number, Go kept out of projects, etc.). Because `build:prod` runs
  `test:ci` first, a content violation fails the build. `pages/home/home.spec.ts` is the
  single-page acceptance suite (section ids, one `<h1>`, counts).
- **Theming.** Tokens are declared once in `src/styles.css` with CSS `light-dark()` and exposed to
  Tailwind v4 through `@theme inline`, so the OS preference works with no JS. An explicit choice
  (`localStorage` key `aizal.theme`) is applied as `data-theme` in `src/main.ts` before
  bootstrap, because the CSP (`script-src 'self'`) forbids an inline script. Runtime toggling
  is in `src/app/core/theme.ts`.
- **`core/`.** `seo.service.ts` sets title/meta; `obfuscate.ts` assembles the email from
  `emailUser` + `emailDomain` so the full address never appears in source or bundle.

## Hosting state

The site is live on **AWS Amplify Hosting at https://main.d1hdxafvdzhpo8.amplifyapp.com**
(app `d1hdxafvdzhpo8`, branch `main`, `ap-southeast-2`, AWS CLI profile `aws-agent`). It is a
manual deployment, so there is no connected repository and no Amplify build. The planned private
S3 + CloudFront design (PLAN Phases 5–7) is on hold. The earlier GitHub Pages host
(`gh-pages` branch, https://mdaizal.github.io) is superseded.

Republishing, in order:

1. `git fetch` and sync with `origin/main` first. Building from a stale clone once shipped
   broken styling.
2. `npm run build:prod`, then confirm `dist/portfolio/browser/index.html` has **no**
   `media="print"`. The Amplify CSP (`script-src 'self'`) blocks Angular's critical-CSS swap,
   which is why `angular.json` sets `inlineCritical: false`. Keep it that way.
3. Zip the *contents* of `dist/portfolio/browser/` with forward-slash paths:
   `C:\Windows\System32\tar.exe -a -cf portfolio.zip *` run from inside that directory.
   Do not use `Compress-Archive`, which writes backslash paths.
4. `aws amplify create-deployment --app-id d1hdxafvdzhpo8 --branch-name main` (read the JSON
   output), `PUT` the zip to `zipUploadUrl`, then `aws amplify start-deployment` with the
   returned `jobId`. Only one deployment can be pending at a time. Clear a stuck one with
   `aws amplify stop-job`.
5. Verify on the live URL, not a local server: a local preview has no CSP, so it cannot catch
   styling the CSP blocks.

Security headers (HSTS, CSP, nosniff, cache rules) are Amplify app custom headers, not files
in this repo. There is no `.github/workflows/` yet: the token lacks the `workflow` scope.

The `docs/` files still give the project root as `E:\Go Projects\portfolio-site\`. The repo now
lives here, renamed to `mdaizal.github.io`.
