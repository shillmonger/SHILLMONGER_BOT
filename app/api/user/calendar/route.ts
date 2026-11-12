import { NextResponse } from 'next/server';

const XOOMAR_URL = 'https://xoomar.com/api/markets/calendar';
const CALENDAR_LIMIT = 4;
const WINDOW_DAYS = 14;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface XoomarEvent {
  source?: string;
  eventName?: string;
  importance?: string;
  scheduledAt?: string;
  periodLabel?: string;
}

interface CalendarItem {
  id: string;
  country: string;
  title: string;
  time: string;
  impact: 'High' | 'Medium' | 'Low';
}

interface CachedCalendar {
  items: CalendarItem[];
  attribution: string;
  fetchedAt: number;
}

let cache: CachedCalendar | null = null;

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

const IMPACT_MAP: Record<string, CalendarItem['impact']> = {
  high: 'High',
  med: 'Medium',
  medium: 'Medium',
  low: 'Low',
};

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const apiKey = process.env.XOOMAR_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Calendar API is not configured' },
      { status: 503 }
    );
  }

  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        calendar: cache.items,
        attribution: cache.attribution,
      });
    }

    const now = new Date();
    const params = new URLSearchParams({
      from: toISODate(now),
      to: toISODate(new Date(now.getTime() + WINDOW_DAYS * 864e5)),
    });

    const response = await fetch(`${XOOMAR_URL}?${params}`, {
      headers: { 'X-API-Key': apiKey },
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      throw new Error(`Xoomar responded with ${response.status}`);
    }

    const payload = await response.json();
    const events: XoomarEvent[] = Array.isArray(payload?.data)
      ? payload.data
      : [];

    const nowMs = Date.now();
    const items = events
      .filter(
        (event) =>
          event.eventName &&
          event.scheduledAt &&
          new Date(event.scheduledAt).getTime() >= nowMs
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt as string).getTime() -
          new Date(b.scheduledAt as string).getTime()
      )
      .slice(0, CALENDAR_LIMIT)
      .map((event, index) => ({
        id: `${event.source ?? 'event'}-${event.scheduledAt}-${index}`,
        country: 'US',
        title: event.eventName as string,
        time: timeFormat.format(new Date(event.scheduledAt as string)),
        impact: IMPACT_MAP[(event.importance || '').toLowerCase()] ?? 'Low',
      }));

    const attribution =
      payload?.meta?.sourceAttribution || payload?.attribution || 'Data: XOOMAR';

    cache = { items, attribution, fetchedAt: Date.now() };

    return NextResponse.json({
      success: true,
      calendar: items,
      attribution,
    });
  } catch (error) {
    console.error('Error fetching economic calendar:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load calendar' },
      { status: 502 }
    );
  }
}
