import map from '../../content-map.json';

export const SITE_TITLE = 'Markets from First Principles';
export const SITE_TAGLINE =
  'Finance and economics for readers who already think like physicists. Every concept named, defined, formalised, bridged to a physics idea, and confronted with real data.';

export const tracks = map.tracks;

const trackBySlug = new Map(tracks.map((track) => [track.slug, track]));
const trackByNumber = new Map(tracks.map((track) => [track.number, track]));

export function getTrack(slugOrNumber) {
  return typeof slugOrNumber === 'number'
    ? trackByNumber.get(slugOrNumber)
    : trackBySlug.get(slugOrNumber);
}

/** Collection ids are `<track-slug>/<page-slug>`; this splits them. */
export function splitId(id) {
  const [track, page] = id.split('/');
  return { track, page };
}

export function pageUrl(id) {
  return `/tracks/${id}/`;
}

/**
 * Reading order across the whole site: tracks in numeric order, pages in the
 * order the content map lists them. Used for the prev/next footer.
 */
export function readingOrder() {
  return tracks.flatMap((track) =>
    track.pages.map((page) => ({
      id: `${track.slug}/${page.slug}`,
      title: page.title,
      track,
    }))
  );
}

export function neighbours(id) {
  const order = readingOrder();
  const i = order.findIndex((entry) => entry.id === id);
  return {
    previous: i > 0 ? order[i - 1] : null,
    next: i >= 0 && i < order.length - 1 ? order[i + 1] : null,
  };
}
