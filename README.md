# TWILA — Trigger Automations

Personal automations built with [Trigger.dev](https://trigger.dev).

## Automations

### Weekly Calendar Summary
Runs every **Sunday at 8pm SAST**. Fetches the week's events from Google Calendar, groups them by title, calculates time spent, and emails a markdown summary to the configured recipient.

**File:** `src/trigger/weekly-calendar-summary/weekly-summary.ts`

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env` and fill in your credentials:
   ```
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REFRESH_TOKEN=
   WEEKLY_SUMMARY_EMAIL=
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Deploy

Push to `main` — GitHub Actions auto-deploys to Trigger.dev.
