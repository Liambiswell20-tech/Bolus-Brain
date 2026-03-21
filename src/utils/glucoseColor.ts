/**
 * Returns a colour string for a glucose value in mmol/L.
 * Red: below 3.9 (hypo), Orange: above 10.0 (high), Green: in range.
 */
export function glucoseColor(mmol: number): string {
  if (mmol < 3.9) return '#FF3B30';
  if (mmol > 10.0) return '#FF9500';
  return '#30D158';
}
