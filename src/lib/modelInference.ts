/**
 * Browser-side XGBoost inference.
 *
 * When the model JSON is available at /public/data/model.json,
 * this module will:
 * 1. Load the model tree structure
 * 2. Walk the trees with user features (skills + experience + country)
 * 3. Return a predicted salary
 *
 * For now this is a placeholder. The model JSON will be added after
 * training in Python and exporting via xgboost's dump_model or save_model.
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
  // Placeholder — will implement tree walker when model JSON is available
  return null;
}
