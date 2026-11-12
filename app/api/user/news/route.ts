import { NextResponse } from 'next/server';

const NEWSDATA_URL = 'https://newsdata.io/api/1/news';
const NEWS_LIMIT = 4;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface NewsDataArticle {
  article_id?: string;
  title?: string;
  link?: string;
  source_name?: string;
  image_url?: string | null;
}

interface CachedNews {
  items: {
    id: string;
    title: string;
    source: string;
    image: string;
    url: string;
  }[];
  fetchedAt: number;
}

let cache: CachedNews | null = null;

export async function GET() {
  const apiKey = process.env.NEWSDATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'News API is not configured' },
      { status: 503 }
    );
  }

  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({ success: true, news: cache.items });
    }

    const params = new URLSearchParams({
      apikey: apiKey,
      language: 'en',
      category: 'business',
    });

    const response = await fetch(`${NEWSDATA_URL}?${params}`, {
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      throw new Error(`NewsData responded with ${response.status}`);
    }

    const payload = await response.json();

    if (payload?.status !== 'success') {
      throw new Error(payload?.message || 'NewsData request failed');
    }

    const articles: NewsDataArticle[] = Array.isArray(payload?.results)
      ? payload.results
      : [];

    const items = articles
      .filter((article) => article.title && article.link)
      .slice(0, NEWS_LIMIT)
      .map((article, index) => ({
        id: article.article_id || article.link || `news-${index}`,
        title: article.title as string,
        source: article.source_name || 'NewsData',
        image: article.image_url || '',
        url: article.link as string,
      }));

    cache = { items, fetchedAt: Date.now() };

    return NextResponse.json({ success: true, news: items });
  } catch (error) {
    console.error('Error fetching market news:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load news' },
      { status: 502 }
    );
  }
}
