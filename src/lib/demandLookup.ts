import { DemandTrend } from "@/types";

/**
 * Get demand trend data for a job title (posting counts over years).
 */
export function getDemandTrend(
  demand: DemandTrend[],
  jobTitle: string
): DemandTrend[] {
  return demand
    .filter((d) => d.jobTitle === jobTitle)
    .sort((a, b) => a.year - b.year);
}

/**
 * Find job titles with salary data that map to a given occupation.
 */
export function getJobTitlesForOccupation(
  salaries: { jobTitle: string; occupationId: string }[],
  occupationId: string
): string[] {
  const titles = new Set<string>();
  for (const s of salaries) {
    if (s.occupationId === occupationId) {
      titles.add(s.jobTitle);
    }
  }
  return Array.from(titles);
}
