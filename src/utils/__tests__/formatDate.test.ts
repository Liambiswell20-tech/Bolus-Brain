import { formatDate } from '../formatDate';

describe('formatDate', () => {
  it('returns a string from an ISO timestamp', () => {
    const result = formatDate('2024-03-15T14:30:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('uses en-GB locale options (weekday short, day numeric, month short, hour/minute)', () => {
    // en-GB locale with these options produces something like "Fri, 15 Mar, 14:30"
    const result = formatDate('2024-03-15T14:30:00.000Z');
    // Should contain a weekday abbreviation (3 chars)
    expect(result).toMatch(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/);
    // Should contain a month abbreviation
    expect(result).toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
    // Should contain hour:minute pattern
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});
