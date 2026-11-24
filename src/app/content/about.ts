/**
 * Narrative content for the About section (PRD §6.3).
 *
 * Kept in the content layer rather than the template so the content gate can
 * enforce the length limits the PRD sets, and so the wording is reviewable in
 * one place. Voice rules (PRD NFR-8): first person, specific, no apologising for
 * the non-development years.
 */

/** 150–250 words, first person (PRD FR-3.1). Enforced by the content gate. */
export const ABOUT_PARAGRAPHS: readonly string[] = [
  'I am a software engineer based in Salak Tinggi, Selangor. Since June 2022 I have been building and supporting enterprise systems at Panasonic AVC Networks in Shah Alam — inventory transfer ticketing with workflow approval that cut a two-day manual cycle to about twenty minutes, a real-time bidding application built on Entity Framework Core and SignalR, a visitor management system handling over a hundred people a day, and a weighbridge system whose weight records satisfy Customs compliance.',
  'Before that my career ran through IT operations, application support and programme management across government and private sectors, including the Prime Minister\u2019s Department and the Ministry of Youth & Sports. Those years taught me what it costs when a system fails the people who depend on it.',
  'I am now moving that same engineering onto AWS: treating least-privilege IAM as the default rather than an afterthought, choosing deliberately between managed services instead of reaching for a server, and being explicit about the parts I am still learning. This site is the first artifact — a prerendered Angular application published to AWS Amplify Hosting from the AWS CLI. Go is next.',
];

/** PRD FR-3.4 — reinforces technical credibility and links the public repo. */
export const HOW_THIS_SITE_IS_BUILT = [
  'Angular 22 with prerendered static output, so every route ships real HTML and there is no server to run or patch.',
  'AWS Amplify Hosting in ap-southeast-2 serves the static build over HTTPS from a managed CDN, with custom headers that set HSTS and a strict CSP. The planned S3 + CloudFront design waits on CloudFront account verification.',
  'Each release is a manual Amplify deployment: the build output is zipped, uploaded to a pre-signed URL and released with the AWS CLI, using short-lived credentials from aws login — no AWS access keys are stored anywhere.',
  'Lint, unit tests, a content gate and bundle budgets run before anything is published. If a check fails, the release does not happen.',
] as const;
