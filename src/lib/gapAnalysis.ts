import { GapAnalysisResult, Occupation } from "@/types";

/**
 * Compare user's current skills against target occupation's required skills.
 */
export function analyzeGap(
  userSkillIds: string[],
  occupation: Occupation
): GapAnalysisResult {
  const userSet = new Set(userSkillIds);
  const required = occupation.requiredSkills;

  const matched = required.filter((id) => userSet.has(id));
  const missing = required.filter((id) => !userSet.has(id));
  const matchPercentage =
    required.length > 0 ? Math.round((matched.length / required.length) * 100) : 0;

  return { matched, missing, matchPercentage };
}
