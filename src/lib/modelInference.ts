/**
 * Browser-side XGBoost inference (unused).
 *
 * Predictions are now pre-computed in Python and served as static JSON
 * via getPredictions() in lib/data.ts. This module is kept for reference
 * in case live inference is needed in a future iteration.
 */

export interface PredictionInput {
  skillVector: number[]; // binary vector: 1 if user has skill, 0 if not
  experienceLevel: number; // encoded: 0=entry, 1=mid, 2=senior, 3=executive
  countryCode: number; // encoded country
}

export interface PredictionResult {
  predictedSalary: number;
  shapValues?: Record<string, number>; // skill name → SHAP contribution
}

export async function predict(
  _input: PredictionInput
): Promise<PredictionResult | null> {
  return null;
}
