/**
 * Builds a Google Maps directions link for a listing, sight or service provider.
 *
 * Firestore `accommodations`, `service_providers` and `attractions` all store the
 * address as `physicalAddress` and carry no coordinates today; the other field
 * names are accepted so the link keeps working if coordinates are added later.
 * Returns null when there is nothing to build a destination from.
 */
export function getDirectionsUrl(item: any): string | null {
  if (!item) return null;

  const base = 'https://www.google.com/maps/dir/?api=1&destination=';
  const coords = getCoordinates(item);
  if (coords) return `${base}${coords.lat},${coords.lng}`;

  const destination = getAddress(item) || getNameFallback(item);
  return destination ? `${base}${encodeURIComponent(destination)}` : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function getCoordinates(item: any): { lat: number; lng: number } | null {
  // Firestore GeoPoint ({ latitude, longitude }) or a plain object under a common key.
  const point = item.geopoint ?? item.geoPoint ?? item.coordinates ?? item.location;
  const candidates = [
    [item.lat, item.lng],
    [item.latitude, item.longitude],
    point && typeof point === 'object' ? [point.latitude ?? point.lat, point.longitude ?? point.lng] : null,
  ];
  for (const pair of candidates) {
    if (!pair) continue;
    const lat = toNumber(pair[0]);
    const lng = toNumber(pair[1]);
    if (lat !== null && lng !== null && !(lat === 0 && lng === 0)) return { lat, lng };
  }
  return null;
}

function getAddress(item: any): string {
  const raw = item.physicalAddress ?? item.address ?? item.mapLocation;
  if (typeof raw !== 'string') return '';
  // Stored addresses are often multi-line; Maps reads comma-separated parts best.
  return raw
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

function getNameFallback(item: any): string {
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) return '';
  const town = item.townSlug
    ? String(item.townSlug).replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    : typeof item.location === 'string'
      ? item.location
      : '';
  return [name, town, 'South Africa'].filter(Boolean).join(', ');
}
