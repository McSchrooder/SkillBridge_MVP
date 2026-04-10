// ESCO-based occupation
export interface Occupation {
  id: string;
  uri: string;
  title: string;
  description: string;
  iscoGroup: string;
  altLabels: string[];
  requiredSkills: string[]; // skill IDs (essential)
  optionalSkills: string[]; // skill IDs (optional)
}

// ESCO-based skill
export interface Skill {
  id: string;
  uri: string;
  name: string;
  category: string; // "skill/competence" or "knowledge"
  reuseLevel: string; // "cross-sector", "sector-specific", etc.
  occupationCount: number;
}

// Coursera-sourced course mapped to ESCO skills
export interface Course {
  id: string;
  title: string;
  platform: string;
  organization: string;
  url: string;
  duration: string;
  rating: number;
  level: string;
  skillIds: string[];
  skillNames: string[];
}

// Salary statistics for a job title + experience level + country
export interface SalaryStats {
  jobTitle: string;
  experienceLevel: ExperienceLevel;
  country: string; // ISO 2-letter code, or "ALL" for global
  median: number;
  p25: number;
  p75: number;
  currency: string;
  sampleSize: number;
  occupationId: string;
}

export type ExperienceLevel = "entry" | "mid" | "senior" | "executive";

export interface DemandTrend {
  jobTitle: string;
  year: number;
  postings: number;
}

export interface UserProfile {
  currentSkills: string[];
  targetOccupation: string;
  experienceLevel: ExperienceLevel;
  country: string;
}

export interface GapAnalysisResult {
  matched: string[];
  missing: string[];
  matchPercentage: number;
}
