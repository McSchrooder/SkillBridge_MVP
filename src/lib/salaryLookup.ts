import { ExperienceLevel, SalaryStats } from "@/types";

/**
 * Find salary stats matching an occupation ID or job title.
 */
export function lookupSalary(
  salaries: SalaryStats[],
  occupationId: string,
  experienceLevel?: ExperienceLevel
): SalaryStats[] {
  let results = salaries.filter((s) => s.occupationId === occupationId);

  // If no match by occupation ID, this occupation has no salary data
  if (results.length === 0) return [];

  if (experienceLevel) {
    results = results.filter((s) => s.experienceLevel === experienceLevel);
  }

  return results;
}

/**
 * Get salary stats for a job title across all experience levels (for charts).
 */
export function getSalaryByTitle(
  salaries: SalaryStats[],
  jobTitle: string
): SalaryStats[] {
  return salaries.filter((s) => s.jobTitle === jobTitle);
}
