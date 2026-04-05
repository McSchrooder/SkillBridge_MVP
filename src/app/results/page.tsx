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
  getShapData,
  getPredictions,
  ShapData,
  PredictionEntry,
} from "@/lib/data";
import { analyzeGap } from "@/lib/gapAnalysis";
import { matchCourses } from "@/lib/courseMatching";
import { getDemandTrend, getJobTitlesForOccupation } from "@/lib/demandLookup";
import { countryName } from "@/lib/countries";
import StatCards from "@/components/StatCards";
import SkillGapDisplay from "@/components/SkillGapDisplay";
import SalaryChart from "@/components/SalaryChart";
import SalaryPrediction from "@/components/SalaryPrediction";
import CourseCards from "@/components/CourseCards";
import DemandTrendChart from "@/components/DemandTrendChart";
import { ResultsPageSkeleton } from "@/components/Skeleton";

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
  const [shapData, setShapData] = useState<ShapData | null>(null);
  const [prediction, setPrediction] = useState<PredictionEntry | null>(null);
  const [allPredictions, setAllPredictions] = useState<Record<string, Record<string, PredictionEntry>>>({});

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
      getShapData(),
      getPredictions(),
    ]).then(([occupations, _skills, salaries, courses, demand, sMap, countries, shap, preds]) => {
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

      // ML prediction + SHAP
      setShapData(shap);
      setAllPredictions(preds);
      const predKey = `${(searchParams.get("exp") || "mid")}_${countryCode === "ALL" ? "US" : countryCode}`;
      const occPreds = preds[occId];
      if (occPreds && occPreds[predKey]) {
        setPrediction(occPreds[predKey]);
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
    // Update ML prediction for new country
    const expLevel = searchParams.get("exp") || "mid";
    const occId = searchParams.get("occ") || "";
    const predCountry = code === "ALL" ? "US" : code;
    const predKey = `${expLevel}_${predCountry}`;
    const occPreds = allPredictions[occId];
    setPrediction(occPreds?.[predKey] ?? null);
  }, [searchParams, allPredictions]);

  if (loading) {
    return <ResultsPageSkeleton />;
  }

  if (!occupation) {
    return <EmptyResultsState />;
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
        <SkillGapDisplay result={gapResult} skillMap={skillMap} shapData={shapData} />
        <SalaryChart data={filteredSalary} />
      </div>

      {/* ML Salary Prediction with SHAP explanations */}
      <SalaryPrediction
        prediction={prediction}
        shapData={shapData}
        occupationTitle={occupation.title}
        experienceLevel={searchParams.get("exp") || "mid"}
        country={selectedCountry === "ALL" ? "US (default)" : countryName(selectedCountry)}
      />

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

function EmptyResultsState() {
  const [history, setHistory] = useState<
    { occupationTitle: string; matchPercentage: number; skillsMatched: number; skillsMissing: number; timestamp: string; url: string }[]
  >([]);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("skillbridge_history") || "[]"));
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
        </svg>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">No Analysis Yet</h2>
        <p className="text-slate-500 mb-6">
          Set up your profile to see skill gaps, salary insights, and course recommendations.
        </p>
        <a
          href="/input"
          className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
          Go to My Skills
        </a>
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Or revisit a previous analysis
          </h3>
          <div className="space-y-3">
            {history.map((run, i) => (
              <a
                key={i}
                href={run.url}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-300 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="font-medium text-slate-900">{run.occupationTitle}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {run.skillsMatched} matched, {run.skillsMissing} missing &middot;{" "}
                    {new Date(run.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-lg font-bold text-sky-600">
                  {run.matchPercentage}%
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<ResultsPageSkeleton />}>
      <ResultsContent />
    </Suspense>
  );
}
