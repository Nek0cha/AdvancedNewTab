/** RSS 2.0 と Atom の両方を素朴にパースする。フィードの生成元によって細部の差が大きいため、必要最小限の情報だけを拾う。 */

export interface FeedItem {
  title: string;
  link: string;
  publishedAt: number | null;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

function text(node: Element | null | undefined): string {
  return node?.textContent?.trim() ?? '';
}

function parseDate(value: string): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function parseFeed(xmlText: string): ParsedFeed {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('フィードの形式を解析できませんでした');
  }

  // Atom
  const feedEl = doc.querySelector('feed');
  if (feedEl) {
    const items: FeedItem[] = [...feedEl.querySelectorAll('entry')].map((entry) => {
      const linkEl =
        entry.querySelector('link[rel="alternate"]') ?? entry.querySelector('link');
      return {
        title: text(entry.querySelector('title')),
        link: linkEl?.getAttribute('href') ?? '',
        publishedAt: parseDate(text(entry.querySelector('updated, published'))),
      };
    });
    return { title: text(feedEl.querySelector('title')), items };
  }

  // RSS 2.0 / RDF
  const channel = doc.querySelector('channel');
  const items: FeedItem[] = [...doc.querySelectorAll('item')].map((item) => ({
    title: text(item.querySelector('title')),
    link: text(item.querySelector('link')),
    publishedAt: parseDate(text(item.querySelector('pubDate'))),
  }));

  return { title: text(channel?.querySelector('title')) || text(doc.querySelector('title')), items };
}
