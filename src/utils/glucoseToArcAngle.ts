const ARC_MIN_DEG = -135;
const ARC_MAX_DEG = 135;
const GLUCOSE_MIN = 2.0;  // mmol/L — lower clamp
const GLUCOSE_MAX = 20.0; // mmol/L — upper clamp

export function glucoseToArcAngle(mmol: number | null): number | null {
  if (mmol === null || isNaN(mmol)) return null;
  const clamped = Math.max(GLUCOSE_MIN, Math.min(GLUCOSE_MAX, mmol));
  const ratio = (clamped - GLUCOSE_MIN) / (GLUCOSE_MAX - GLUCOSE_MIN);
  return Math.round(ARC_MIN_DEG + ratio * (ARC_MAX_DEG - ARC_MIN_DEG));
}
