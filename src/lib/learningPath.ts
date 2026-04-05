import { Skill, Course } from "@/types";
import { ShapData } from "./data";

export interface LearningStep {
  skillId: string;
  skillName: string;
  tier: "foundation" | "core" | "advanced";
  reason: string;
  courses: Course[];
  shapImpact: number;
}

interface HierarchyEntry {
  parent: string;
  depth: number;
  isKnowledge: boolean;
}

/**
 * Build an ordered learning path from missing skills.
 *
 * Ordering logic:
 * 1. Knowledge skills before skill/competence (theory before practice)
 * 2. Shallower hierarchy depth first (broader concepts before specialized)
 * 3. Within each tier, higher SHAP impact first (most salary-relevant)
 *
 * Groups into 3 tiers:
 * - Foundation: knowledge type OR depth <= 3
 * - Core: skill/competence with depth 4-5
 * - Advanced: depth >= 6
 */
export function buildLearningPath(
  missingSkillIds: string[],
  skillMap: Map<string, Skill>,
  hierarchy: Record<string, HierarchyEntry>,
  shapData: ShapData | null,
  courses: Course[]
): LearningStep[] {
  const coursesBySkill = new Map<string, Course[]>();
  for (const course of courses) {
    for (const sid of course.skillIds) {
      if (!coursesBySkill.has(sid)) coursesBySkill.set(sid, []);
      coursesBySkill.get(sid)!.push(course);
    }
  }

  const steps: LearningStep[] = missingSkillIds.map((sid) => {
    const skill = skillMap.get(sid);
    const h = hierarchy[sid];
    const shapVal = shapData?.skills[sid]?.shapMean ?? 0;

    let tier: LearningStep["tier"] = "core";
    let reason = "";

    if (h) {
      if (h.isKnowledge || h.depth <= 3) {
        tier = "foundation";
        reason = h.isKnowledge
          ? "Foundational knowledge — learn the theory first"
          : "Broad skill — builds base for specialized skills";
      } else if (h.depth >= 6) {
        tier = "advanced";
        reason = "Specialized skill — learn after building your foundation";
      } else {
        tier = "core";
        reason = "Core competency for this role";
      }
    }

    const skillCourses = (coursesBySkill.get(sid) || [])
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    return {
      skillId: sid,
      skillName: skill?.name ?? sid,
      tier,
      reason,
      courses: skillCourses,
      shapImpact: shapVal,
    };
  });

  // Sort: foundation first, then core, then advanced
  // Within each tier, higher SHAP first
  const tierOrder = { foundation: 0, core: 1, advanced: 2 };
  steps.sort(
    (a, b) =>
      tierOrder[a.tier] - tierOrder[b.tier] || b.shapImpact - a.shapImpact
  );

  return steps;
}
