"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Occupation, Skill, ExperienceLevel } from "@/types";
import { getOccupations, getSkills, getCountries, getSkillMap } from "@/lib/data";
import { countryName } from "@/lib/countries";
import SkillSelector from "@/components/SkillSelector";

export default function InputPage() {
  const router = useRouter();
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillMap, setSkillMap] = useState<Map<string, Skill>>(new Map());
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOccupation, setSelectedOccupation] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("mid");
  const [country, setCountry] = useState("ALL");
  const [occSearch, setOccSearch] = useState("");

  useEffect(() => {
    Promise.all([getOccupations(), getSkills(), getCountries(), getSkillMap()]).then(
      ([occs, sk, ctrs, sMap]) => {
        occs.sort((a, b) => a.title.localeCompare(b.title));
        setOccupations(occs);
        setSkills(sk);
        setCountries(ctrs);
        setSkillMap(sMap);
        setLoading(false);
      }
    );
  }, []);

  const filteredOccupations = occSearch.trim()
    ? occupations
        .filter(
          (o) =>
            o.title.toLowerCase().includes(occSearch.toLowerCase()) ||
            o.altLabels.some((l) =>
              l.toLowerCase().includes(occSearch.toLowerCase())
            )
        )
        .slice(0, 20)
    : [];

  const selectedOcc = occupations.find((o) => o.id === selectedOccupation);

  // Required skills for the selected occupation
  const requiredSkillDetails = useMemo(() => {
    if (!selectedOcc) return [];
    return selectedOcc.requiredSkills
      .map((id) => skillMap.get(id))
      .filter((s): s is Skill => !!s);
  }, [selectedOcc, skillMap]);

  const selectedSet = new Set(selectedSkillIds);

  function handleQuickAdd(skillId: string) {
    if (!selectedSet.has(skillId)) {
      setSelectedSkillIds([...selectedSkillIds, skillId]);
    }
  }

  function handleQuickAddAll() {
    const newIds = requiredSkillDetails
      .map((s) => s.id)
      .filter((id) => !selectedSet.has(id));
    setSelectedSkillIds([...selectedSkillIds, ...newIds]);
  }

  function handleAnalyze() {
    if (!selectedOccupation) return;
    const params = new URLSearchParams({
      occ: selectedOccupation,
      exp: experienceLevel,
      country,
      skills: selectedSkillIds.join(","),
    });
    router.push(`/results?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">Loading ESCO data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your Profile</h2>
        <p className="text-slate-500 mt-1">
          Tell us about your skills and career goals.
        </p>
      </div>

      {/* Target occupation */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Target Occupation
        </h3>
        <div className="relative">
          <input
            type="text"
            value={selectedOcc ? selectedOcc.title : occSearch}
            onChange={(e) => {
              setOccSearch(e.target.value);
              setSelectedOccupation("");
            }}
            placeholder="Search occupations (e.g. data analyst, software developer)..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {filteredOccupations.length > 0 && !selectedOcc && (
            <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredOccupations.map((occ) => (
                <li key={occ.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOccupation(occ.id);
                      setOccSearch("");
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-sky-50"
                  >
                    <span className="font-medium">{occ.title}</span>
                    {occ.description && (
                      <span className="block text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {occ.description}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedOcc && (
          <div className="text-sm text-slate-600 bg-sky-50 p-3 rounded-lg">
            <span className="font-medium">{selectedOcc.title}</span>
            <span className="text-slate-400 ml-2">
              &middot; {selectedOcc.requiredSkills.length} required skills
            </span>
          </div>
        )}
      </div>

      {/* Required skills for this occupation — quick select */}
      {selectedOcc && requiredSkillDetails.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Skills required for {selectedOcc.title}
            </h3>
            <button
              type="button"
              onClick={handleQuickAddAll}
              className="text-xs text-sky-600 hover:text-sky-800 font-medium"
            >
              Select all I have
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Click skills you already have to add them to your profile.
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {requiredSkillDetails.map((skill) => {
              const isSelected = selectedSet.has(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => handleQuickAdd(skill.id)}
                  disabled={isSelected}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-emerald-100 text-emerald-700 cursor-default"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700 cursor-pointer"
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                  {skill.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Skill selector (search all skills) */}
      <SkillSelector
        availableSkills={skills}
        selectedSkillIds={selectedSkillIds}
        onSelectionChange={setSelectedSkillIds}
      />

      {/* Country & experience */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Country</h3>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Countries (global average)</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">
            Filters salary data by company location.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Experience Level
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(["entry", "mid", "senior", "executive"] as ExperienceLevel[]).map(
              (level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setExperienceLevel(level)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    experienceLevel === level
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              )
            )}
          </div>
          <p className="text-xs text-slate-400">
            From ai-jobs.net survey: Entry, Mid, Senior, Executive.
          </p>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleAnalyze}
        disabled={!selectedOccupation}
        className="w-full py-3 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Analyze My Skills
      </button>
    </div>
  );
}
