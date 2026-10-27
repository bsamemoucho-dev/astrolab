import { buildIndependentReading } from './build.mjs';
import { calculateChineseAnnual } from './chineseAnnual.mjs';

export function buildComplementPreview(input) {
  const report = buildIndependentReading(input);
  return { ...report, chineseAnnual: calculateChineseAnnual({ utcRange: report.tropical.frame.utcRange }) };
}
