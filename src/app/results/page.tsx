"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Occupation,
  Skill,
  SalaryStats,
  Course,
  DemandTrend,
  GapAnalysisResult,
  ExperienceLevel,
} from "@/types";
import {
  getOccupations,
  getSkills,
  getSalaries,
  getCourses,
  getDemand,
  getSkillMap,
  getCountries,
} from "@/lib/data";
import { analyzeGap } from "@/lib/gapAnalysis";
import { matchCourses } from "@/lib/courseMatching";
import { getDemandTrend, getJobTitlesForOccupation } from "@/lib/demandLookup";
import { countryName } from "@/lib/countries";
import StatCards from "@/components/StatCards";
import SkillGapDisplay from "@/components/SkillGapDisplay";
import SalaryChart from "@/components/SalaryChart";
import CourseCards from "@/components/CourseCards";
import DemandTrendChart from "@/components/DemandTrendChart";

function saveHistory(
  occ: Occupation,
  gap: GapAnalysisResult,
  url: string
) {
  if (typeof window === "undefined") return;
  try {
    const history = JSON.parse(
      localStorage.getItem("skillbridge_history") || "[]"
    );
    const filtered = history.filter(
      (h: { url: string }) => h.url !== url
    );
    filtered.unshift({
      occupationTitle: occ.title,
      matchPercentage: gap.matchPercentage,
      skillsMatched: gap.matched.length,
      skillsMissing: gap.missing.length,
      timestamp: new Date().toISOString(),
      url,
    });
    localStorage.setItem(
      "skillbridge_history",
      JSON.stringify(filtered.slice(0, 10))
    );
  } catch {
    // ignore
  }
}

function ResultsContent() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [occupation, setOccupation] = useState<Occupation | null>(null);
  const [skillMap, setSkillMap] = useState<Map<string, Skill>>(new Map());
  const [gapResult, setGapResult] = useState<GapAnalysisResult | null>(null);
  const [allSalaryData, setAllSalaryData] = useState<SalaryStats[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [matchedCourses, setMatchedCourses] = useState<Course[]>([]);
  const [demandData, setDemandData] = useState<DemandTrend[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("ALL");
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);

  useEffect(() => {
    const occId = searchParams.get("occ") || "";
    const countryCode = searchParams.get("country") || "ALL";
    const userSkills = (searchParams.get("skills") || "")
      .split(",")
      .filter(Boolean);

    setSelectedCountry(countryCode);

    if (!occId) {
      setLoading(false);
      return;
    }

    Promise.all([
      getOccupations(),
      getSkills(),
      getSalaries(),
      getCourses(),
      getDemand(),
      getSkillMap(),
      getCountries(),
    ]).then(([occupations, _skills, salaries, courses, demand, sMap, countries]) => {
      const occ = occupations.find((o) => o.id === occId);
      if (!occ) {
        setLoading(false);
        return;
      }

      setOccupation(occ);
      setSkillMap(sMap);
      setAllCourses(courses);

      // Gap analysis
      const gap = analyzeGap(userSkills, occ);
      setGapResult(gap);

      // All salary data for this occupation's job title
      const titles = getJobTitlesForOccupation(salaries, occId);
      const primaryTitle = titles[0] || "";
      setJobTitle(primaryTitle);

      if (primaryTitle) {
        const allForTitle = salaries.filter((s) => s.jobTitle === primaryTitle);
        setAllSalaryData(allForTitle);

        // Which countries have data for this title?
        const titleCountries = new Set(
          allForTitle.map((s) => s.country).filter((c) => c !== "ALL")
        );
        setAvailableCountries(
          countries.filter((c) => titleCountries.has(c))
        );
      }

      // Course recommendations
      const matched = matchCourses(courses, gap.missing);
      setMatchedCourses(matched);

      // Demand trends
      if (primaryTitle) {
        setDemandData(getDemandTrend(demand, primaryTitle));
      }

      // Save to history
      saveHistory(occ, gap, `/results?${searchParams.toString()}`);

      setLoading(false);
    });
  }, [searchParams]);

  // Filter salary by selected country (client-side, instant)
  const filteredSalary = useMemo(() => {
    if (selectedCountry !== "ALL") {
      const countryFiltered = allSalaryData.filter(
        (s) => s.country === selectedCountry
      );
      if (countryFiltered.length > 0) return countryFiltered;
    }
    // Fall back to global
    return allSalaryData.filter((s) => s.country === "ALL");
  }, [allSalaryData, selectedCountry]);

  // Filter courses by a specific skill
  const displayedCourses = useMemo(() => {
    if (!selectedSkillFilter) return matchedCourses;
    return allCourses.filter((c) =>
      c.skillIds.includes(selectedSkillFilter)
    );
  }, [matchedCourses, allCourses, selectedSkillFilter]);

  const handleCountryChange = useCallback((code: string) => {
    setSelectedCountry(code);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">Analyzing your profile...</p>
      </div>
    );
  }

  if (!occupation) {
    return (
      <div className="p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Results</h2>
        <p className="text-slate-500">
          No occupation selected. Go to{" "}
          <a href="/input" className="text-sky-600 underline">
            My Skills
          </a>{" "}
          to set up your profile.
        </p>
      </div>
    );
  }

  const stats = [
    {
      label: "Skills Matched",
      value: gapResult ? `${gapResult.matched.length}` : "--",
    },
    {
      label: "Skills Missing",
      value: gapResult ? `${gapResult.missing.length}` : "--",
    },
    {
      label: "Courses Found",
      value: `${matchedCourses.length}`,
    },
    {
      label: "Avg. Salary",
      value:
        filteredSalary.length > 0
          ? `$${Math.round(filteredSalary.reduce((s, d) => s + d.median, 0) / filteredSalary.length / 1000)}k`
          : "N/A",
    },
  ];

  const missingSkillDetails = gapResult
    ? gapResult.missing
        .map((id) => skillMap.get(id))
        .filter((s): s is Skill => !!s)
    : [];

  return (
    <div className="p-6 sm:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Results: {occupation.title}
          </h2>
          <p className="text-slate-500 mt-1">
            {gapResult
              ? `You are ${gapResult.matchPercentage}% ready for this role.`
              : "Skill gap analysis, salary insights, and recommended learning path."}
          </p>
        </div>

        {/* Country selector on results page */}
        <div className="shrink-0">
          <label className="block text-xs text-slate-500 mb-1">
            Salary &amp; data region
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[180px]"
          >
            <option value="ALL">All Countries (global)</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <StatCards stats={stats} />

      <div id="gap" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SkillGapDisplay result={gapResult} skillMap={skillMap} />
        <SalaryChart data={filteredSalary} />
      </div>

      <DemandTrendChart data={demandData} title={jobTitle} />

      {/* Per-skill course browser */}
      <div id="courses" className="space-y-4 min-h-[400px]">
        {missingSkillDetails.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Browse courses by missing skill
            </h3>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelectedSkillFilter(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedSkillFilter
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({matchedCourses.length})
              </button>
              {missingSkillDetails.map((skill) => {
                const count = allCourses.filter((c) =>
                  c.skillIds.includes(skill.id)
                ).length;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => count > 0 ? setSelectedSkillFilter(skill.id) : undefined}
                    disabled={count === 0}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedSkillFilter === skill.id
                        ? "bg-sky-600 text-white"
                        : count === 0
                          ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {skill.name} {count > 0 ? `(${count})` : "(no courses)"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <CourseCards courses={displayedCourses} />
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-slate-500">Loading...</p>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
