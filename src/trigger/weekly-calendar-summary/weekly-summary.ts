import { schedules } from "@trigger.dev/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarEvent {
  summary?: string;
  status?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface EventGroup {
  title: string;
  count: number;
  totalMinutes: number;
  allDayDays: number;
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// ---------------------------------------------------------------------------
// Google OAuth — exchange refresh token for a short-lived access token
// ---------------------------------------------------------------------------

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh access token: ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Google Calendar — fetch events for the given window
// ---------------------------------------------------------------------------

async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Error(`Calendar API error: ${await response.text()}`);
  }

  const data = (await response.json()) as { items?: CalendarEvent[] };
  // Filter out cancelled/declined events
  return (data.items ?? []).filter((e) => e.status !== "cancelled");
}

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

function getTimedMinutes(event: CalendarEvent): number {
  if (!event.start.dateTime || !event.end.dateTime) return 0;
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  return Math.max(0, (end.getTime() - start.getTime()) / 60_000);
}

function getAllDayDays(event: CalendarEvent): number {
  if (!event.start.date || !event.end.date) return 0;
  const start = new Date(event.start.date);
  const end = new Date(event.end.date);
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
}

function formatDuration(group: EventGroup): string {
  if (group.allDayDays > 0 && group.totalMinutes === 0) {
    return `${group.allDayDays} all-day day(s)`;
  }
  const hours = group.totalMinutes / 60;
  return `${hours.toFixed(1)} hrs`;
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function buildMarkdown(
  events: CalendarEvent[],
  weekStart: Date,
  weekEnd: Date,
): string {
  const groupMap = new Map<string, EventGroup>();

  for (const event of events) {
    const title = event.summary?.trim() || "(No title)";
    const isAllDay = !event.start.dateTime;
    const existing = groupMap.get(title) ?? {
      title,
      count: 0,
      totalMinutes: 0,
      allDayDays: 0,
    };

    groupMap.set(title, {
      ...existing,
      count: existing.count + 1,
      totalMinutes:
        existing.totalMinutes + (isAllDay ? 0 : getTimedMinutes(event)),
      allDayDays: existing.allDayDays + (isAllDay ? getAllDayDays(event) : 0),
    });
  }

  // Sort by total minutes descending (most time-consuming first)
  const groups = [...groupMap.values()].sort(
    (a, b) => b.totalMinutes - a.totalMinutes,
  );

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const totalHours = (
    groups.reduce((sum, g) => sum + g.totalMinutes, 0) / 60
  ).toFixed(1);

  let md = `# Weekly Calendar Summary\n\n`;
  md += `**Week:** ${fmt(weekStart)} → ${fmt(weekEnd)}\n`;
  md += `**Total events:** ${events.length}\n`;
  md += `**Total scheduled time:** ${totalHours} hrs\n\n`;
  md += `---\n\n`;
  md += `## Event Breakdown\n\n`;
  md += `| Event | Occurrences | Time Spent |\n`;
  md += `|-------|:-----------:|:----------:|\n`;

  for (const group of groups) {
    md += `| ${group.title} | ${group.count} | ${formatDuration(group)} |\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Gmail sender — sends the .md file as an email attachment
// ---------------------------------------------------------------------------

async function sendEmailWithAttachment(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  filename: string,
  attachment: string,
): Promise<void> {
  const boundary = "twila_weekly_boundary";

  const encodedAttachment = Buffer.from(attachment)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const mime = [
    `MIME-Version: 1.0`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: text/markdown; charset="UTF-8"; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    encodedAttachment,
    `--${boundary}--`,
  ].join("\r\n");

  const raw = Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gmail send failed: ${await response.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Task — runs Sunday 8pm SAST (18:00 UTC, UTC+2)
// ---------------------------------------------------------------------------

export const weeklyCalendarSummary = schedules.task({
  id: "weekly-calendar-summary",
  cron: "0 18 * * 0", // Sunday 18:00 UTC = 20:00 SAST

  run: async () => {
    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
    const refreshToken = requireEnv("GOOGLE_REFRESH_TOKEN");
    const toEmail = requireEnv("WEEKLY_SUMMARY_EMAIL");

    // Prior week: last Monday (6 days ago) through today (Sunday, inclusive)
    const now = new Date();

    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6); // 6 days back lands on Monday
    weekStart.setHours(0, 0, 0, 0);

    console.log(
      `Fetching events: ${weekStart.toISOString()} → ${weekEnd.toISOString()}`,
    );

    const accessToken = await getAccessToken(
      clientId,
      clientSecret,
      refreshToken,
    );
    const events = await fetchCalendarEvents(accessToken, weekStart, weekEnd);

    console.log(`Found ${events.length} calendar events`);

    // Filename: YYYY-MM-D_TWILA.md (D = day with no leading zero)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = now.getDate();
    const filename = `${year}-${month}-${day}_TWILA.md`;

    const markdown = buildMarkdown(events, weekStart, weekEnd);

    const subject = `Weekly Summary — ${filename.replace(".md", "")}`;
    const emailBody = [
      `Hi,`,
      ``,
      `Your weekly calendar summary is attached.`,
      ``,
      `Week: ${weekStart.toDateString()} → ${weekEnd.toDateString()}`,
      `Events: ${events.length}`,
      ``,
      `— TWILA`,
    ].join("\n");

    await sendEmailWithAttachment(
      accessToken,
      toEmail,
      subject,
      emailBody,
      filename,
      markdown,
    );

    console.log(`Sent ${filename} to ${toEmail}`);
    return { filename, eventCount: events.length };
  },
});
