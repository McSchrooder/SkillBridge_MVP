"use client";

import { useState, useMemo } from "react";
import { Skill } from "@/types";

interface SkillSelectorProps {
  availableSkills: Skill[];
  selectedSkillIds: string[];
  onSelectionChange: (skillIds: string[]) => void;
}

export default function SkillSelector({
  availableSkills,
  selectedSkillIds,
  onSelectionChange,
}: SkillSelectorProps) {
  const [search, setSearch] = useState("");

  const selectedSet = new Set(selectedSkillIds);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return availableSkills
      .filter(
        (s) =>
          !selectedSet.has(s.id) &&
          s.name.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [search, availableSkills, selectedSet]);

  const selectedSkills = useMemo(
    () => availableSkills.filter((s) => selectedSet.has(s.id)),
    [availableSkills, selectedSet]
  );

  function addSkill(id: string) {
    onSelectionChange([...selectedSkillIds, id]);
    setSearch("");
  }

  function removeSkill(id: string) {
    onSelectionChange(selectedSkillIds.filter((s) => s !== id));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        Select Your Current Skills
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Search the ESCO taxonomy and pick skills you already have.
      </p>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills (e.g. Python, data analysis, marketing)..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        {filtered.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filtered.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  onClick={() => addSkill(skill.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-sky-50 flex justify-between items-center"
                >
                  <span>{skill.name}</span>
                  <span className="text-xs text-slate-400">
                    {skill.category === "knowledge" ? "Knowledge" : "Skill"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Selected skills tags */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {selectedSkills.map((skill) => (
            <span
              key={skill.id}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-sm"
            >
              {skill.name}
              <button
                type="button"
                onClick={() => removeSkill(skill.id)}
                className="ml-1 text-sky-600 hover:text-sky-900"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        {selectedSkillIds.length} skill{selectedSkillIds.length !== 1 ? "s" : ""} selected
      </p>
    </div>
  );
}
