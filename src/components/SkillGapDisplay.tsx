"use client";

import { GapAnalysisResult, Skill } from "@/types";

interface SkillGapDisplayProps {
  result: GapAnalysisResult | null;
  skillMap: Map<string, Skill>;
}

export default function SkillGapDisplay({
  result,
  skillMap,
}: SkillGapDisplayProps) {
  if (!result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Your Skill Gap
        </h3>
        <p className="text-sm text-slate-500">
          Select an occupation and your skills to see the analysis.
        </p>
      </div>
    );
  }

  const allSkills = [
    ...result.matched.map((id) => ({ id, status: "matched" as const })),
    ...result.missing.map((id) => ({ id, status: "missing" as const })),
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Your Skill Gap</h3>
        <span className="text-sm font-medium text-slate-600">
          {result.matchPercentage}% match
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
        <div
          className="bg-emerald-500 h-2.5 rounded-full transition-all"
          style={{ width: `${result.matchPercentage}%` }}
        />
      </div>

      {/* Skills table */}
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="pb-2 font-medium">Skill</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {allSkills.map(({ id, status }) => {
              const skill = skillMap.get(id);
              return (
                <tr key={id} className="border-b border-slate-50">
                  <td className="py-2">{skill?.name ?? id}</td>
                  <td className="py-2 text-slate-400">
                    {skill?.category === "knowledge" ? "Knowledge" : "Skill"}
                  </td>
                  <td className="py-2 text-right">
                    {status === "matched" ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                        Have
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                        Missing
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
