// Category metadata for the UI. Codes and colours mirror the `categories` table
// seeded in backend migration 002_reporters_and_categories.sql, so the map
// legend matches what the database knows about.

export const CATEGORIES = [
  { code: 'power_outage', label: 'Power', emoji: '⚡', color: '#F59E0B' },
  { code: 'flood', label: 'Flood', emoji: '🌊', color: '#3B82F6' },
  { code: 'kidnapping_security', label: 'Security', emoji: '🚨', color: '#EF4444' },
  { code: 'road_condition', label: 'Road', emoji: '🚧', color: '#F97316' },
  { code: 'disaster_fire', label: 'Fire', emoji: '🔥', color: '#DC2626' },
  { code: 'other', label: 'Other', emoji: 'ℹ️', color: '#6B7280' },
]

const BY_CODE = Object.fromEntries(CATEGORIES.map((c) => [c.code, c]))

export function getCategory(code) {
  return BY_CODE[code] || BY_CODE.other
}
