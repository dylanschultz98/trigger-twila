# TWILA — Trigger Automations

Personal automations built with [Trigger.dev](https://trigger.dev).

---

## Automations

### Weekly Calendar Summary
Runs every **Sunday at 8pm SAST**. Fetches the week's events from Google Calendar, groups them by title, calculates time spent, and emails a markdown summary as an attachment.

**File:** `src/trigger/weekly-calendar-summary/weekly-summary.ts`

---

## Full Setup Guide

### 1. Install dependencies

```bash
npm install
```

---

### 2. Create a Google Cloud project (free)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in
2. Click **Select a project** → **New Project** → name it anything → **Create**
3. Go to **APIs & Services** → **Library**
4. Search **Google Calendar API** → Enable it
5. Search **Gmail API** → Enable it

---

### 3. Create OAuth2 credentials

1. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. If prompted, configure the consent screen:
   - Choose **External**
   - Fill in app name and your email → Save
3. Back at Create Credentials → OAuth client ID:
   - Application type: **Web application**
   - Under **Authorized redirect URIs**, add: `https://developers.google.com/oauthplayground`
   - Click **Create**
4. Copy the **Client ID** and **Client Secret**

> **Note:** Choose **User data** (not Application data) when prompted. Use **Web application** type (not Desktop app) so the OAuth Playground redirect URI can be added.

---

### 4. Get a refresh token via OAuth Playground

1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Click the **gear icon** (top right) → check **Use your own OAuth credentials** → enter your Client ID and Client Secret
3. In the left panel, select these two scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
4. Click **Authorize APIs** → sign in with your Google account → Allow
5. Click **Exchange authorization code for tokens**
6. Copy the **Refresh token** (ignore the access token — it expires)

---

### 5. Fill in your `.env` file

```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
WEEKLY_SUMMARY_EMAIL=your@email.com
```

---

### 6. Set up Trigger.dev

1. Log in:
   ```bash
   npx trigger.dev@latest login
   ```
2. Initialise the project:
   ```bash
   npx trigger.dev@latest init
   ```
   - Select **CLI** (not MCP)
   - Set the task directory to `src/trigger`
   - Choose **None** when asked about example tasks
3. Copy the generated project ref into `trigger.config.ts` if it wasn't updated automatically:
   ```ts
   project: "proj_xxxxxxxxxxxxxxxxx",
   ```

---

### 7. Start the dev server

```bash
npm run dev
```

> **Troubleshooting:** If you see `Yarn Plug'n'Play manifest forbids importing` errors, check for a stray `.pnp.cjs` file in your home directory and delete it:
> ```bash
> rm ~/.pnp.cjs
> ```
> Then run `npm run dev` again.

---

### 8. Test locally

1. Go to [cloud.trigger.dev](https://cloud.trigger.dev) → your project → **Tasks**
2. Find `weekly-calendar-summary` → click **Test** → **Run test**
3. Check your email for the summary

---

### 9. Add env vars to Trigger.dev dashboard (required before deploying)

1. Go to [cloud.trigger.dev](https://cloud.trigger.dev) → your project → **Environment Variables**
2. Add all four variables from your `.env` to **both** staging and production:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`
   - `WEEKLY_SUMMARY_EMAIL`

> This is the #1 cause of production failures — don't skip it.

---

### 10. Deploy

```bash
npm run deploy
```

Or just push to `main` — GitHub Actions auto-deploys via the Trigger.dev GitHub integration.

---

### 11. GitHub setup (first time only)

If you haven't authenticated with GitHub from the terminal:

```bash
brew install gh
gh auth login
```

Choose **GitHub.com** → **HTTPS** → **Login with a web browser**.

---

## Environment Variables Reference

| Variable | Where to get it |
|----------|----------------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `GOOGLE_REFRESH_TOKEN` | OAuth Playground (see Step 4) |
| `WEEKLY_SUMMARY_EMAIL` | The email address to receive the weekly summary |
