# PLAN.md — Portfolio Site: Build & Deploy Plan

> Execution plan for Aizal's Angular single-page portfolio, deployed to AWS S3 + CloudFront.
> Companion docs: `PRD.md` (what to build), `TRD.md` (how to build it).
> Project root: **`E:\Go Projects\portfolio-site\`**. Superseded versions live in `_archive/`.

---

## 0. Decisions locked in

| # | Decision | Chosen | Notes |
|---|----------|--------|-------|
| D1 | Hosting | **S3 (private) + CloudFront + OAC**, served on the **CloudFront default HTTPS domain** | **$0/month** on the AWS free tier — no domain purchase, no Route 53, no ACM. Custom domain is v2. **Fallback only if CloudFront cannot be set up:** plain S3 static-website hosting (HTTP-only, slower, no custom error pages) — works, but visibly worse. |
| D2 | Rendering | **Prerendered static (SSG)**, `outputMode: "static"` | Real HTML at build time, no Node server at runtime. |
| D3 | Page structure | **Single scrolling page** with anchor sections + a separate prerendered 404 | Per owner's choice. Mitigated with correct anchor ids and `scroll-margin-top` so the sticky header never covers a heading. |
| D4 | Styling | **Tailwind CSS v4 + CSS custom-property design tokens** | No component library. |
| D5 | Deployment | **Owner runs every AWS command; the agent guides** | Pi writes code, scripts and docs, and produces exact copy-pasteable commands *with the expected output*. Pi does **not** create or modify AWS resources. |
| D6 | CI/CD | Manual `npm run deploy` first, then GitHub Actions with OIDC | No long-lived AWS keys at any point. |
| D7 | Domain | **Deferred to v2** | v1 ships on `<id>.cloudfront.net`. |
| D8 | Content | Real data from the owner's résumé — `PRD.md` §8 | Résumé PDF supplied at `src/assets/aizal-resume.pdf`. Only §11 open questions remain. |
| D9 | Project location | **`E:\Go Projects\portfolio-site\`** | E:\Go Projects is itself a git repo for the owner's learning projects; a `/portfolio-site/` entry has been added to its `.gitignore` so the parent repo does not track the nested site repo. |

### Division of work (D5 in practice)

| Work | Who |
|------|-----|
| Angular code, Tailwind design system, content modules, tests, `scripts/*.sh`, docs | Agent (Pi) |
| Exact AWS CLI commands + the output you should see for each | Agent produces, **you run** |
| AWS console clicking (CloudFront distribution, bucket settings, IAM role) | **You** |
| GitHub repo creation, branch protection, repository variables | **You** (agent gives the exact values to paste) |
| Retiring `mdaizal.github.io` | **You** (steps in Phase 9.4) |
| Buying a domain, DNS records, ACM validation | **You** (v2 only) |
| Verification runs (`curl`, Lighthouse, axe) | Either — commands are provided |

---

## Phase 0 — Prerequisites

| Step | Action | Status / Done when |
|------|--------|--------------------|
| 0.1 | AWS account + working credentials | ✅ `aws sts get-caller-identity` → account `323661593352` |
| 0.2 | AWS CLI v2 | ✅ `aws-cli/2.40.1` |
| 0.3 | Node.js 26 LTS | ✅ `node -v` → `v26.13.1` (installed via winget, 2026-11-13) |
| 0.4 | npm latest | ✅ `npm -v` → `12.2.2` (engines allow node ≥26) |
| 0.5 | Angular CLI 22 | ✅ `ng version` → CLI **22.2.7**, on Node 26.13.1 / npm 12.2.2 |
| 0.6 | Résumé PDF staged | ✅ `src/assets/aizal-resume.pdf` (from `~/Documents/Aizal_Resume.pdf`) |
| 0.7 | Docs relocated to the project root | ✅ `E:\Go Projects\portfolio-site\docs\` |
| 0.8 | GitHub repo created (empty, branch `main`) | ⬜ Repo URL known |
| 0.9 | Resolve PRD §11 open questions | ⬜ At minimum Q2 (employment end date), since the hero's availability line depends on it |

## Phase 1 — Repository & scaffold

| Step | Status | What actually happened |
|------|--------|------------------------|
| 1.1 | ✅ | Scaffolded with `ng new portfolio --directory .` into this folder. **Two deviations from the original plan:** `--style=tailwind` (v22 offers Tailwind as a first-class style choice — it wired Tailwind v4 and `.postcssrc.json` automatically, so no separate manual step was needed) and `--ssr=true` (configures SSR *and* SSG/prerendering at creation, so `ng add @angular/ssr` proved unnecessary). Also `--zoneless=true --test-runner=vitest --package-manager=npm --skip-git --defaults`. **`ng new` did refuse the non-empty directory**, so `docs/` and the résumé PDF were staged outside the folder and restored afterwards. |
| 1.2 | ✅ | Prerender wiring was already present from `--ssr=true`: `src/main.server.ts`, `src/app/app.config.server.ts`, `src/app/app.routes.server.ts`, `src/server.ts`. |
| 1.3 | ✅ | `outputMode: "static"` set. Build emits **no** `dist/portfolio/server/` directory — server bundles are built as intermediates but not written to disk. |
| 1.4 | ✅ | **Verified empirically.** `Prerendered 2 static routes.` Emitted: `browser/index.html` (9,405 B, real `<h1>`), `browser/404/index.html` (9,214 B, real `<h1>Page not found</h1>`), `browser/index.csr.html` (8,622 B, empty shell), `browser/assets/aizal-resume.pdf`, `prerendered-routes.json` = `{"/": {}, "/404": {}}`. The `RenderMode.Client` wildcard emitted nothing. **Full result recorded in `TRD.md` §4.1 — that section is authoritative.** |
| 1.5 | ✅ | Tailwind v4 via `--style=tailwind`. `src/styles.css` has `@import 'tailwindcss';`; `.postcssrc.json` registers `@tailwindcss/postcss`. |
| 1.6 | ✅ | `.nvmrc` (`26`), `.editorconfig`, `.prettierrc`, `eslint.config.js` (via `ng add angular-eslint` — added a working `lint` target to `angular.json`), `.gitattributes` (LF normalisation so Windows matches Linux CI), `.gitignore` extended with `.env`, `.env.*`, `.env.deploy`. `npm run lint` → **All files pass linting.** |
| 1.7 | ⏳ | `git init -b main`, 47 files tracked, commit *"chore: scaffold Angular 22 workspace…"* on `main`, authored as Aizal. **Push blocked:** the GitHub repo does not exist yet (Phase 0.8). |

**Corrections to this plan's original assumptions** (all reflected in `TRD.md`):

- Assets are served from **`public/`**, not `src/assets/` — Angular 20+ copies `public/` to the output root. The résumé now lives at `public/assets/aizal-resume.pdf` and is served at `/assets/aizal-resume.pdf`. Leaving it in `src/assets/` would have silently not deployed it.
- Styles are **`src/styles.css`**, not `.scss`, because `--style=tailwind` implies CSS.
- **Angular's `budgets` measure raw bytes, not gzip.** The first production build *failed* because 180 kB was configured as if it were gzip while the raw initial total is 275 kB (73 kB gzip). Ceilings are now 300 kB warning / 350 kB error.
- A cold build took ~272 s; warm builds ~10 s. Set CI timeouts accordingly.
- `ng test` on the scaffold initially failed because `app.spec.ts` asserted the default welcome template; the spec now asserts the routing shell instead.

## Phase 2 — Design system & content layer

| Step | Status | What actually happened |
|------|--------|------------------------|
| 2.1 | ✅ | Tokens declared once using CSS **`light-dark()`** in `src/styles.css`, mapped into Tailwind via `@theme inline`. The OS preference applies with zero JavaScript; an explicit choice sets `data-theme` on `<html>`. **Deviation from the plan:** the original design used an inline `<script>` in `index.html` to set the theme before first paint — that is blocked by the project's own `script-src 'self'` CSP, so the stored override is applied in `main.ts` before bootstrap instead, and `light-dark()` covers the no-choice case with no flash at all. Documented in `TRD.md` §6.1. |
| 2.2 | ✅ | `layout/skip-link`, `layout/header` (sticky, 5 anchors, résumé, GitHub + LinkedIn, theme toggle, accessible mobile menu, `IntersectionObserver` scroll-spy with `aria-current`), `layout/footer`, `layout/monogram`. Wired into `app.html` as skip link → header → `<main id="main">` → footer. |
| 2.3 | ✅ | `models.ts`, `profile.ts`, `experience.ts` (**6 entries**), `skills.ts` (**6 groups**), `projects.ts` (**6 cards**), `certs.ts`. Contact address stored split (`emailUser`/`emailDomain`) so the contiguous string never reaches the bundle. |
| 2.4 | ✅ | Primitives with specs: `SectionHeading`, `TagChip`, `ButtonLink`, `ProjectCard`, `TimelineEntry`, `SkillGroup`. Small presentational primitives use inline templates; `ProjectCard` and `TimelineEntry` use separate `.html` files. |
| 2.5 | ✅ | **Deviation from the plan:** validation is a Vitest suite (`content.validation.spec.ts`, 10 rules) rather than `scripts/validate-content.ts`, and `build:prod` is now `npm run test:ci && ng build --configuration production`. Same guarantee, no extra dependency, and it gets TypeScript and real imports for free. **Verified by injection:** replacing `availability` with `{{FILL_ME}}` makes `build:prod` exit **1**; restoring it exits **0**. |
| 2.6 | ✅ | `scripts/check-contrast.mjs` (not in the original plan) parses the tokens out of `styles.css` and gates every foreground/background pair. **24 pairs, 0 failures** — lowest light `learning`-on-surface 4.68:1, lowest dark `border-strong`-on-surface 3.64:1. |

**Defects the gates caught during Phase 2** (both real, both fixed):

- `ButtonLink` used a **property** binding for `target`, and `HTMLAnchorElement.target` coerces `null` to the string `"null"` — every internal link would have shipped `target="null"`. Now `[attr.target]`.
- `@angular-eslint/template/interactive-supports-focus` correctly rejected a `(keydown)` handler on the non-focusable `<header>`; Escape/Tab handling moved to a component `host` listener.

Bundle after Phase 2: **280 kB raw / 79 kB gzip** (budget ceilings are 300 kB warning / 350 kB error).

## Phase 3 — Sections

**✅ Complete.** All seven sections built as components under `pages/home/sections/`, composed by `home.html`. Verified against the **prerendered production build**, not just `ng serve`.

| Evidence | Result |
|---|---|
| Sections present in `browser/index.html` | `#top`, `#currently`, `#about`, `#experience`, `#skills`, `#projects`, `#contact` — all 7 |
| `<h1>` count | **1** (the hero) |
| Experience timeline entries | **6**, each with its date range (`Jun 2022 – Oct 2026` … `Dec 2006 – Jan 2008`) |
| Project cards | **7**, with repository links on exactly the 2 that have one |
| Skill groups | **6**, `learning` items visually distinct |
| Prerendered page size | 76,527 bytes (real content, not a shell) |
| `npm test` | **60 passed** (9 files), incl. 13 new integration assertions in `pages/home/home.spec.ts` |
| Lint / build | clean · 291 kB raw / 80 kB gzip · 2 routes prerendered |

Browser-verified beyond the build output:

- **Theming works with zero JavaScript.** Emulating `prefers-color-scheme: dark` resolves `--canvas` to `rgb(11,15,20)` and `--ink` to `rgb(232,238,245)` from `light-dark()` alone, with no `data-theme` set.
- **No horizontal overflow** at 320 / 360 / 390 / 768 / 1024 px (PRD NFR-6).
- **Sticky-header anchor fix confirmed**: `scroll-margin-top` computes to `72px` = the 56 px `--header-height` + 1rem, so a jump never hides the heading.
- **Mobile nav swaps correctly**: desktop nav `display: none`, toggle visible with `aria-expanded="false"`.
- External links carry `rel="noopener noreferrer"`; no phone number anywhere in the rendered text.

**Defects found by the visual pass and fixed:**

- The Contact lead rendered as **"Available immediately — Software engineering roles — .NET-adjacent…"** — availability and the open-to statement were concatenated with an em-dash, producing one run-on. Now two sentences, assembled in a computed signal.
- The Phase 1 placeholder home carried its **own `<main id="main">`** while the app shell provides one too. Removed — a duplicate landmark would have broken the skip link.

Original plan steps, for reference:

| Step | Action | Done when |
|------|--------|-----------|
| 3.1 | Hero `#top` — incl. the availability marker and a working résumé button | Matches PRD §6.1 |
| 3.2 | Currently `#currently` (3 items; SAA target **January 2027**) | Matches PRD §6.2 |
| 3.3 | About `#about` + "How this site is built" | Matches PRD §6.3 |
| 3.4 | Experience `#experience` — **all 6 entries**, newest first, with date ranges | Matches PRD §6.4 and §8 |
| 3.5 | Skills `#skills` (6 groups, honest labels, `learning` visually distinct, no React) | Matches PRD §6.5 |
| 3.6 | Projects `#projects` (6 cards from `projects.ts`) | Matches PRD §6.6 |
| 3.7 | Contact `#contact` + footer (no phone number) | Matches PRD §6.7 |
| 3.8 | 404 page | Matches PRD §6.8 |

## Phase 4 — Quality gates

**✅ Met for NFR-1 and NFR-2. Two items remain open (see the bottom of this block).**

Division of labour: the SEO slice and the accessibility fixes were implemented by the **Pi CLI** from written briefs in `.delegation/`; the axe/Lighthouse measurement, diff review, gate re-runs and commits were done by the supervising agent. No delegate output was accepted without independent verification.

**Lighthouse, mobile, against the built output served statically:**

| Category | Before the a11y fixes | After | NFR-1 target | |
|---|---|---|---|---|
| performance | 96 | **100** | ≥95 | ✅ |
| accessibility | **86** | **100** | ≥95 | ✅ |
| best-practices | 100 | **100** | ≥95 | ✅ |
| seo | 100 | **100** | =100 | ✅ |

**NFR-2:** LCP **1.3 s** (< 2.0), CLS **0.001** (< 0.05), TBT **70 ms** (was 210 ms).
**axe-core:** 0 violations on both `/` (34 passes) and `/404/` (33 passes).

### Two real defects found — and why the gates missed them

Both were invisible to unit tests and to the design-token contrast gate, because both only exist in the **assembled DOM**:

1. **`TagChip` rendered an `<li>`.** Angular inserts the component's host element between parent and child, so the shipped DOM was `ul > app-tag-chip > li` — axe `list` (13 nodes) and `listitem` (52 nodes), both serious. Fixed by rendering a `<span>` and having parents emit the `<li>`. A component tested in isolation has no `<ul>` parent, so no unit test could see it.
2. **`opacity-80` on the skill level label silently broke contrast.** The rendered colour became `#c3753a` on white = **3.54:1** (needs 4.5:1), where the token pair alone measures 5.02:1. The token gate compares token pairs, not blended text.

Lesson recorded in the `angular-static-site` skill: unit tests and a token gate are cheap early checks, but **measure the assembled artifact** before claiming an accessibility target.

### Deliberately deferred to Phase 6 (the origin does not exist yet)

`canonical`, `og:url`, `og:image` and `sitemap.xml` all require an absolute site origin, which only exists once the CloudFront distribution is created. Shipping an invented URL would be a false claim, so they are recorded here rather than guessed. Phase 6 must add all four. Note the `og-image.png` asset (1200×630) also needs creating.

### Coverage gate — 4.1 now CLOSED

Implemented in Slice C. The ≥80% lines requirement is now **enforced**, not asserted:

- Provider `@vitest/coverage-v8@5.1.0` (pinned to the installed Vitest 5.1.0) — the only new dependency.
- Scope in `angular.json`'s `test` target: `coverageInclude` = `src/app/content/**/*.ts` + `src/app/core/**/*.ts`, excluding specs; reporters `text`, `text-summary`, `json-summary`.
- Thresholds in `vitest-base.config.mts` (80% lines per directory), loaded via the builder's `runnerConfig`.
- `test:ci` now runs coverage, and `build:prod` runs `test:ci` — so the gate sits in the path of every production build.

**Measured baseline (lines):** total **97.43%**; all seven `content/` modules **100%**; `core/obfuscate.ts` and `core/seo.service.ts` **100%**; `core/theme.ts` **94.11%** (the `matchMedia` branch, unreachable in jsdom without monkey-patching a global — correctly left uncovered rather than hacking a test). `npm run test:ci` wall clock **10 s** with coverage on; 69 tests.

**Proven to fail, not just pass:** raising a threshold to 99% gives exit **1** with `ERROR: Coverage for lines (96.66%) does not meet "src/app/core/**" threshold (99%)`; restoring it gives exit **0**. A gate never observed to fail is not a gate.

> **Correction to the Slice C brief.** The brief asserted the Angular builder "has no threshold option". That was wrong: `@angular/build:unit-test` **does** expose `coverageThresholds` (schema line 150, wired at `options.js:102`). It cannot express *per-directory* thresholds though, so the Vitest `runnerConfig` route was still the right implementation — but the stated reason was incorrect, and `ng test --help` does not list the option, which is what made the reconnaissance mistake. Read the builder *schema*, not `--help`.

### Still open — one item

- **4.6 cross-browser spot check was not done.** Every measurement above is Chromium (Chrome headless via Lighthouse; the browser harness is Chromium). Safari, Firefox and real iOS are unverified.

Original plan steps, for reference:

| Step | Action | Done when |
|------|--------|-----------|
| 4.1 | Vitest: content modules, validator, obfuscation helper, every primitive | `npm test` green; ≥80% lines on `content/` and `core/` |
| 4.2 | Accessibility: WCAG 2.2 AA — contrast, keyboard-only pass, focus visible, skip link, `prefers-reduced-motion` | 0 axe violations; Lighthouse a11y ≥ 95 |
| 4.3 | SEO: title/description, canonical, OG/Twitter (1200×630 image), `robots.txt`, `sitemap.xml`, JSON-LD `Person`, favicon set | Lighthouse SEO = 100 |
| 4.4 | Performance: budgets enforced, résumé PDF and OG image sized, no layout shift | Lighthouse Perf ≥ 95 mobile; LCP < 2.0 s throttled |
| 4.5 | Preview the real static output with a plain static server (not `ng serve`) | Prerendered HTML and anchors behave as they will in production |
| 4.6 | Cross-browser/device spot check | No breakage in Chrome, Edge, Firefox, Safari/iOS |

## Phase 5 — AWS: S3 bucket *(you run these)*

**✅ COMPLETE — verified against the account, not from the operator's summary.**

| Setting | Verified value | Why it matters |
|---|---|---|
| Bucket | `aizal-portfolio-site` — `arn:aws:s3:::aizal-portfolio-site` | name confirmed free before creation |
| Region | **`ap-southeast-2`** (Sydney) — deliberate, see below | permanent; a bucket's region cannot be changed |
| Block Public Access | all four `true` | ✅ the single most important line — nothing is public |
| Versioning | `Enabled` | ✅ free rollback for a bad deploy |
| Default encryption | `AES256` | ✅ on by default for new buckets, but verified rather than assumed |
| Object ownership | `BucketOwnerEnforced` | ✅ ACLs disabled; access is bucket-policy + IAM only |
| Static website hosting | **absent** (`NoSuchWebsiteConfiguration`) | ✅ required — website endpoints are HTTP-only and cannot use OAC |
| Bucket policy | absent (`NoSuchBucketPolicy`) | ✅ correct; CloudFront's OAC policy arrives in Phase 6.3 |
| Contents | empty | ✅ correct until Phase 6.1 |

**Two steps silently did not take effect** — versioning (`get-bucket-versioning` returned `{}`) and tagging (`NoSuchTagSet`). Both were re-run and now verify. The lesson: `put-*` prints nothing on success, so a clean-looking command sequence is not evidence — the only proof is a `get-*` that returns a real value. The operator's pasted summary also omitted the versioning check entirely, which is precisely the check that would have surfaced it.

**Region decision: `ap-southeast-2` (Sydney), not `ap-southeast-5` (Malaysia).** Measured from the operator's machine, ap-southeast-5 was ~7× closer (66 ms vs 495 ms, TLS-inclusive single request). The bucket nonetheless landed in Sydney because the `LocationConstraint` never reached the create call, and the operator elected to keep it. Rationale is sound: CloudFront caches globally, so **viewer** latency is identical either way — the region only affects deploy-time uploads and origin fetches on cache misses. Recorded because these docs previously suggested ap-southeast-5.

**Root cause of the wrong region: shell variables do not persist between terminal invocations.** `BUCKET`/`REGION` were set in one call and referenced in another, so `"$REGION"` expanded to empty and the CLI fell back to the `~/.aws/config` default. **Owner-run AWS instructions must use literal values, not shell variables.**

Steps as originally specified, with `{{BUCKET_NAME}}` = `aizal-portfolio-site` and `{{REGION}}` = `ap-southeast-2`. Run from the project root in **git-bash**, using **literal values rather than shell variables**.

| Step | Command you run | Output you should see |
|------|-----------------|-----------------------|
| 5.1 | `aws s3api create-bucket --bucket {{BUCKET_NAME}} --region {{REGION}} --create-bucket-configuration LocationConstraint={{REGION}}` *(omit the LocationConstraint flag only for `us-east-1`)* | JSON with a `Location` field, no error |
| 5.2 | `aws s3api put-public-access-block --bucket {{BUCKET_NAME}} --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'` | **no output** (silence = success) |
| 5.3 | `aws s3api get-public-access-block --bucket {{BUCKET_NAME}}` | all four values `true` |
| 5.4 | `aws s3api put-bucket-versioning --bucket {{BUCKET_NAME}} --versioning-configuration Status=Enabled` | no output |
| 5.5 | `aws s3api put-bucket-tagging --bucket {{BUCKET_NAME}} --tagging 'TagSet=[{Key=Project,Value=portfolio-site},{Key=Owner,Value=aizal}]'` | no output |
| 5.6 | `aws s3 ls` | the bucket listed |

**Do not enable S3 static website hosting** — CloudFront reads the bucket over the REST endpoint with OAC.

## Phase 6 — AWS: CloudFront + TLS + cache + headers *(you run / click these)*

| Step | Action | Expected result |
|------|--------|-----------------|
| 6.1 | Upload a first build: `npm run build:prod` then the **three-pass** sync in TRD §13.3 — pass 1 immutable (hashed assets only), pass 2 short TTL (`assets/*`, `robots.txt`, `favicon.ico`), pass 3 `must-revalidate` (HTML) | `upload: …` lines, then `aws s3 ls s3://aizal-portfolio-site/` shows `index.html` |

| 6.2 | Create the CloudFront distribution (console is easiest): origin = the S3 **REST** endpoint, **Origin access control** = new OAC, viewer protocol = *Redirect HTTP to HTTPS*, allowed methods `GET, HEAD`, compress objects = Yes, default root object = `index.html`, price class = `PriceClass_100` | Distribution state → `Deployed` (~3–5 min) |
| 6.3 | Paste the bucket policy CloudFront suggests (it grants `s3:GetObject` to `cloudfront.amazonaws.com` for this distribution only) | Bucket stays fully private; `https://<d-id>.cloudfront.net/` returns your page |
| 6.4 | Response headers policy: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP (per TRD §12) | `curl -I https://<d-id>.cloudfront.net/` shows every header |
| 6.5 | Custom error responses: **403 → `/404/index.html`, response code 404**; **404 → `/404/index.html`, response code 404** | A bad path renders the 404 page and returns `HTTP/2 404` |
| 6.6 | Verify caching: hashed JS, `index.html`, **and the résumé PDF** | JS → `max-age=31536000, immutable`; HTML → `max-age=0, must-revalidate`; **PDF → `max-age=3600, must-revalidate`** |
| 6.7 | **Explore the free tier while you're here** — note the CloudFront metrics view and where invalidation history lives. This is study material for the SAA exam. | You can describe the request flow viewer → CloudFront → OAC → S3 unaided |

**No ACM certificate and no Route 53 in v1** — CloudFront serves HTTPS on its own `*.cloudfront.net` domain for free.

**Verified after the first upload:** 11 objects, 1.28 MiB, correct `Content-Type` on every object, `max-age=0,must-revalidate` on all HTML, `immutable` on the hashed JS/CSS.

**✅ Both pending items are cleared** — the build was re-run and re-uploaded, then verified against S3:

- S3's `index.html` is **byte-identical** to the local build (75,131 B), contains **6** project cards, no `cloud-lab`, one `<h1>`.
- `assets/aizal-resume.pdf` now carries `max-age=3600,must-revalidate` (was `immutable`).
- 11 objects, 1.28 MiB. Pass 1 deleted the four superseded hashed bundles from the 7-card build.

> **Second deploy-script defect, found here.** Passes 2 and 3 originally used `aws s3 sync`, which compares **size and modification time, not metadata** — so it silently skipped all three files whose only change was `Cache-Control`, and the résumé stayed `immutable` until those files were force-copied. `sync` is correct for pass 1 (content-hashed names change with content, and `--delete` is needed); passes 2 and 3 now use `aws s3 cp --recursive`, which always uploads and therefore always applies the headers. TRD §13.3 carries the corrected script.

> **Defect caught here, and fixed.** The original two-pass sync gave `assets/aizal-resume.pdf` `immutable` for a year. The résumé URL carries **no content hash**, so an updated résumé would have been invisible to anyone who had already visited — for up to a year, in both browser and CloudFront caches. That is the one file on a job-search site that must never go stale. The deploy script now separates *hashed* filenames (safe to make immutable) from *stable* filenames whose content changes (short TTL). Found by inspecting object headers with `head-object`; `aws s3 ls` shows nothing about caching.

## Phase 7 — Deploy automation

| Step | Action | Done when |
|------|--------|-----------|
| 7.1 | npm scripts: `build:prod`, `deploy:sync`, `deploy:html`, `deploy:invalidate`, `deploy` | `npm run deploy` publishes and invalidates in one command |
| 7.2 | Configuration in a gitignored `.env.deploy`: `BUCKET_NAME`, `DISTRIBUTION_ID`, `AWS_REGION` | Scripts run from a clean shell without editing files |
| 7.3 | Create the GitHub OIDC provider + deploy role (TRD §13.3 has the exact JSON) | `aws iam get-role --role-name github-actions-portfolio-deploy` shows the repo-scoped trust policy |
| 7.4 | Add `.github/workflows/deploy.yml`; set the three repository **variables** | Push to `main` deploys automatically; no AWS keys stored anywhere |
| 7.5 | Protect `main`: PR required, CI must pass | Branch protection visible in GitHub settings |

## Phase 8 — Verify, monitor, harden

| Step | Action | Done when |
|------|--------|-----------|
| 8.1 | `scripts/verify-deploy.sh` — fetch `/`, `/assets/aizal-resume.pdf`, `robots.txt`, `sitemap.xml`, a hashed asset, and a bad path | All return the expected status and content; the script exits non-zero on any failure |
| 8.2 | Lighthouse + axe against the **live CloudFront URL** | PRD NFR-1 met in production, not just locally |
| 8.3 | AWS Budget ($1–5/mo) + CloudWatch alarm on 5xx rate | Alarm fires on a simulated failure |
| 8.4 | Write `docs/RUNBOOK.md`: deploy, rollback, invalidation, cost, where each resource lives | Someone else could operate the site from that doc alone |
| 8.5 | Rollback drill: re-sync a previous `dist-<sha>` artifact from GitHub Actions | Previous version live in < 10 minutes |

## Phase 9 — Cleanup and next steps

### 9.4 Retire `mdaizal.github.io` — ✅ DONE (executed by the agent, not the operator)

**The URL now serves THIS project.**

| Step | Outcome |
|---|---|
| Backup first | `E:\Go Projects\_retired\mdaizal.github.io\` — `index.html` (42,847 B, matching the live `Content-Length`), `README.md`, `PROVENANCE.md` |
| Unpublish Pages | ❌ the API refused: `422 — Deactivating GitHub Pages for this repository is not allowed`. Deleting the repo removed the Pages site anyway, so the end state is the same |
| Delete the repo | ✅ `gh repo view` fails; API → `Not Found`. Public repos 4 → 3 |
| Keep the URL | The repo was **renamed** `aizal-portfolio` → `mdaizal.github.io`. GitHub serves the root user site `https://mdaizal.github.io` **only** from the repo of exactly that name — a project repo would have been stuck at `/aizal-portfolio/` |
| Republish | `gh-pages` branch (built output) + Pages source set to that branch — see below |

**Checked before deleting:** the new site does not link the old URL, and **the résumé does not cite it** (the CV lists email, phone and LinkedIn only). The one thing not checkable from here is the LinkedIn "Website" field.

### Interim hosting — GitHub Pages at `https://mdaizal.github.io`

The site is **live here now**, while the S3 + CloudFront path waits on AWS account verification (Phase 6.2). The same build artifact serves both targets, so nothing here is throwaway.

| | |
|---|---|
| Live URL | `https://mdaizal.github.io` — verified HTTP 200 |
| Source | the `gh-pages` branch (built output only); Pages source = that branch, path `/` |
| Why a branch, not Actions | the gh token lacks the **`workflow` scope**, which GitHub requires to push anything under `.github/workflows/`. The finished workflow is parked at `.delegation/deploy-pages.yml.pending-workflow-scope`; restore it after `gh auth refresh -s workflow` |
| `404.html` | Pages serves `/404.html` for unknown paths, but the build emits `404/index.html`, so a copy is placed at the root. `custom_404: true` is now set |
| `.nojekyll` | present, so Pages serves files as-is rather than running Jekyll |

**Verified live:** page byte-identical to the local build (75,135 B), one `<h1>`, 6 project cards, no `cloud-lab`, repo link pointing at the new name, every referenced JS/CSS asset returning 200 with the right content type, résumé `200 application/pdf`, and a bogus path returning **404 with our own 404 page**.

**Two gotchas found doing this:**

1. **Changing the Pages *source* does not queue a new build.** The initial build hung on the old `main` commit and sat at `building` indefinitely; the URL 404'd until a build was forced with `POST /repos/{owner}/{repo}/pages/builds`. If Pages stays `building` and the URL 404s, force the build — don't wait.
2. **GitHub auto-enables Pages on any repo named `<user>.github.io`**, defaulting to `build_type: legacy` from the **default branch root**. For an Angular repo that publishes the README, because the repo root has no `index.html`. Check the source immediately after such a rename.

**To republish after a content change:** `npm run build:prod`, then copy `dist/portfolio/browser/` into the `gh-pages` branch and push.

Original plan steps, retained for reference:

It was a test/experiment, and a second live portfolio competes with this one.

| Step | Action | Expected result |
|------|--------|-----------------|
| 9.4a | `curl -sI https://mdaizal.github.io` — record the current status before changing anything | `HTTP/2 200` (site is live now) |
| 9.4b | GitHub → repo `mdaizal.github.io` → **Settings → Pages → Unpublish site** (or set Source to *None*) | The site stops serving |
| 9.4c | GitHub → same repo → **Settings → General → Danger Zone → Delete this repository** | Repo gone; your public repo count drops from 4 to 3 |
| 9.4d | `curl -sI https://mdaizal.github.io` again | **404** — confirms the retirement |
| 9.4e | If you keep the repo but unpublish Pages, note it here — otherwise delete it | One portfolio, one URL, no ambiguity |

Order matters: unpublish first, then verify, then delete. Don't skip 9.4a — you want a before/after for your own confidence.

### 9.1–9.3, 9.5 Optional v2 (each doubles as AWS/Go practice)

| Step | Action | Why it's worth doing |
|------|--------|----------------------|
| 9.1 | **Go contact form**: API Gateway + Lambda (Go) + SES | Becomes the first real Go artifact (PRD §2) |
| 9.2 | Custom domain + Route 53 + ACM + `www` redirect | Professional URL; ~$12/yr domain + $0.50/mo zone |
| 9.3 | Re-implement Phases 5–7 as **AWS CDK or Terraform** | Directly reusable SAA knowledge; strong portfolio material |
| 9.5 | Blog / notes, starting with the SAA study path | Content pipeline that doubles as exam revision |

---

## Human-only steps (cannot be done by an agent)

- AWS console work and accepting the CloudFront-suggested bucket policy.
- Creating the GitHub repo, the OIDC provider, the IAM role and repository variables.
- Retiring `mdaizal.github.io` (Phase 9.4).
- Confirming the employment end date and availability (PRD §11 Q2).
- Approving the tone of the About narrative — especially how the non-development years are framed.

## Execution order

Phases 1–4 are strictly sequential. Then 5 → 6 → 7 → 8 in order. Phase 9.4 is independent and can be done any time. Stop after each phase, report the "Done when" evidence, then continue.

## Definition of done (project level)

- [ ] `https://<d-id>.cloudfront.net/` serves the site over valid HTTPS from CloudFront + a private S3 bucket.
- [ ] `curl -s https://<d-id>.cloudfront.net/ | grep -q "Mohd Aizal"` succeeds (proves prerendered HTML, not an empty shell).
- [ ] All 7 sections present; all 6 experience entries render with date ranges; every nav anchor scrolls and is not hidden behind the sticky header.
- [ ] `https://<d-id>.cloudfront.net/assets/aizal-resume.pdf` downloads.
- [ ] No phone number anywhere in the rendered page.
- [ ] Lighthouse mobile on the live URL: Perf ≥ 95, A11y ≥ 95, Best Practices ≥ 95, SEO 100.
- [ ] `aws s3api get-public-access-block --bucket {{BUCKET_NAME}}` → all four `true`.
- [ ] Bad path returns `HTTP/2 404` and renders the 404 page.
- [ ] Push to `main` auto-deploys with zero static AWS credentials.
- [ ] `npm run deploy` works locally as an escape hatch.
- [ ] No `{{...}}` or `TODO` in the deployed build.
- [x] `https://mdaizal.github.io` serves **this** project (the old site was retired; the URL was kept and repurposed)
- [ ] `RUNBOOK.md` exists and a rollback has been rehearsed once.
