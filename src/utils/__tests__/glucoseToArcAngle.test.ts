import { glucoseToArcAngle } from '../glucoseToArcAngle';

describe('glucoseToArcAngle', () => {
  it('returns null for null input', () => {
    expect(glucoseToArcAngle(null)).toBeNull();
  });

  it('returns null for NaN input', () => {
    expect(glucoseToArcAngle(NaN)).toBeNull();
  });

  it('returns -135 for glucose at minimum (2.0)', () => {
    expect(glucoseToArcAngle(2.0)).toBe(-135);
  });

  it('returns 135 for glucose at maximum (20.0)', () => {
    expect(glucoseToArcAngle(20.0)).toBe(135);
  });

  it('returns -135 for glucose below minimum (1.0, clamped)', () => {
    expect(glucoseToArcAngle(1.0)).toBe(-135);
  });

  it('returns 135 for glucose above maximum (25.0, clamped)', () => {
    expect(glucoseToArcAngle(25.0)).toBe(135);
  });

  it('returns a number between -135 and 135 for in-range glucose (11.0)', () => {
    const result = glucoseToArcAngle(11.0);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(-135);
    expect(result!).toBeLessThanOrEqual(135);
  });

  it('matches exact formula for 11.0 mmol/L', () => {
    const expected = Math.round(-135 + ((11.0 - 2.0) / (20.0 - 2.0)) * 270);
    expect(glucoseToArcAngle(11.0)).toBe(expected);
  });
});
