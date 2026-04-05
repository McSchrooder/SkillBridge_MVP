import { Course } from "@/types";

/**
 * Find courses that teach the given missing skills.
 * Sorted by number of matching skills, then by rating.
 */
export function matchCourses(
  courses: Course[],
  missingSkillIds: string[]
): Course[] {
  const missingSet = new Set(missingSkillIds);

  const scored = courses
    .map((course) => {
      const overlap = course.skillIds.filter((id) => missingSet.has(id));
      return { course, overlapCount: overlap.length };
    })
    .filter((x) => x.overlapCount > 0);

  scored.sort(
    (a, b) =>
      b.overlapCount - a.overlapCount || b.course.rating - a.course.rating
  );

  return scored.map((x) => x.course);
}
