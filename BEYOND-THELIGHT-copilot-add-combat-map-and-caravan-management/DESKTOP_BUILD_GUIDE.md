# Desktop Build Guide

This repo can now ship desktop versions of BEYOND The Light.

## What gets produced

- Windows: `.exe` installer + portable `.exe`
- macOS: `.dmg` + `.zip`
- Linux: `.AppImage` + `.tar.gz`

Build output goes to `release/`.

## Local build commands

Install dependencies:

```bash
npm install
```

Run in desktop mode locally:

```bash
npm run desktop:dev
```

Build per platform:

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

## Important platform rule

You must build macOS artifacts on macOS. Building `.dmg` on Linux or Windows is not supported.

## GitHub-hosted builds

This repo includes `.github/workflows/desktop-build.yml`.

- Trigger manually in Actions with `workflow_dispatch`, or
- Push a tag like `v1.0.0`

The workflow uploads platform artifacts from `release/`, which you can attach to a product download page or private store delivery.

## Buyer delivery flow

1. Run a release build.
2. Download the generated artifact from GitHub Actions or Releases.
3. Upload that file to your storefront (or private delivery link).
4. Buyers download and run the package without needing Node or terminal setup.