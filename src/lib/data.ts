import { Occupation, Skill, Course, SalaryStats, DemandTrend } from "@/types";

export interface ShapData {
  modelType?: string; // "classifier" or "regressor"
  brackets?: { label: string; range: string; min: number; max: number }[];
  baseValues?: number[];
  baseValue?: number;
  accuracy?: number;
  f1?: number;
  modelR2?: number;
  experienceShap: number;
  countryShap: number;
  skills: Record<string, { name: string; shapMean: number; shapDirection: number }>;
}

export interface PredictionEntry {
  // Classifier fields
  predictedBracket?: number;
  bracketLabel?: string;
  bracketRange?: string;
  probabilities?: number[];
  // Regressor fields
  predicted?: number;
  // Shared
  experienceEffect: number;
  countryEffect: number;
  topSkillContributions: { skillId: string; name: string; contribution: number }[];
}

// Cache fetched data in memory
let cache: {
  occupations?: Occupation[];
  skills?: Skill[];
  courses?: Course[];
  salaries?: SalaryStats[];
  demand?: DemandTrend[];
  countries?: string[];
  shap?: ShapData;
  predictions?: Record<string, Record<string, PredictionEntry>>;
  skillHierarchy?: Record<string, { parent: string; depth: number; isKnowledge: boolean }>;
  skillMap?: Map<string, Skill>;
  occupationMap?: Map<string, Occupation>;
  salaryOccIds?: Set<string>;
} = {};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  return res.json();
}

export async function getOccupations(): Promise<Occupation[]> {
  if (!cache.occupations) {
    cache.occupations = await fetchJson<Occupation[]>("/data/occupations.json");
  }
  return cache.occupations;
}

export async function getSkills(): Promise<Skill[]> {
  if (!cache.skills) {
    cache.skills = await fetchJson<Skill[]>("/data/skills.json");
  }
  return cache.skills;
}

export async function getCourses(): Promise<Course[]> {
  if (!cache.courses) {
    cache.courses = await fetchJson<Course[]>("/data/courses.json");
  }
  return cache.courses;
}

export async function getSalaries(): Promise<SalaryStats[]> {
  if (!cache.salaries) {
    cache.salaries = await fetchJson<SalaryStats[]>("/data/salaries.json");
  }
  return cache.salaries;
}

export async function getDemand(): Promise<DemandTrend[]> {
  if (!cache.demand) {
    cache.demand = await fetchJson<DemandTrend[]>("/data/demand.json");
  }
  return cache.demand;
}

export async function getCountries(): Promise<string[]> {
  if (!cache.countries) {
    cache.countries = await fetchJson<string[]>("/data/countries.json");
  }
  return cache.countries;
}

export async function getSkillHierarchy(): Promise<Record<string, { parent: string; depth: number; isKnowledge: boolean }>> {
  if (!cache.skillHierarchy) {
    cache.skillHierarchy = await fetchJson<Record<string, { parent: string; depth: number; isKnowledge: boolean }>>("/data/skill_hierarchy.json");
  }
  return cache.skillHierarchy!;
}

export async function getShapData(): Promise<ShapData> {
  if (!cache.shap) {
    cache.shap = await fetchJson<ShapData>("/data/shap.json");
  }
  return cache.shap;
}

export async function getPredictions(): Promise<Record<string, Record<string, PredictionEntry>>> {
  if (!cache.predictions) {
    cache.predictions = await fetchJson<Record<string, Record<string, PredictionEntry>>>("/data/predictions.json");
  }
  return cache.predictions;
}

export async function getSkillMap(): Promise<Map<string, Skill>> {
  if (!cache.skillMap) {
    const skills = await getSkills();
    cache.skillMap = new Map(skills.map((s) => [s.id, s]));
  }
  return cache.skillMap;
}

export async function getOccupationMap(): Promise<Map<string, Occupation>> {
  if (!cache.occupationMap) {
    const occupations = await getOccupations();
    cache.occupationMap = new Map(occupations.map((o) => [o.id, o]));
  }
  return cache.occupationMap;
}

export async function getOccupationIdsWithSalary(): Promise<Set<string>> {
  if (!cache.salaryOccIds) {
    const salaries = await getSalaries();
    cache.salaryOccIds = new Set(
      salaries
        .map((s) => s.occupationId)
        .filter((id): id is string => !!id)
    );
  }
  return cache.salaryOccIds;
}
