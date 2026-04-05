"use client";

import { GapAnalysisResult, Skill } from "@/types";
import { ShapData } from "@/lib/data";

interface SkillGapDisplayProps {
  result: GapAnalysisResult | null;
  skillMap: Map<string, Skill>;
  shapData?: ShapData | null;
}

export default function SkillGapDisplay({
  result,
  skillMap,
  shapData,
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

  // Sort missing skills by SHAP impact (highest first) if available
  const sortedMissing = [...result.missing];
  if (shapData) {
    sortedMissing.sort((a, b) => {
      const shapA = shapData.skills[a]?.shapMean ?? 0;
      const shapB = shapData.skills[b]?.shapMean ?? 0;
      return shapB - shapA;
    });
  }

  const allSkills = [
    ...result.matched.map((id) => ({ id, status: "matched" as const })),
    ...sortedMissing.map((id) => ({ id, status: "missing" as const })),
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

      {shapData && (
        <p className="text-xs text-slate-400 mb-3">
          Missing skills sorted by SHAP importance — learn the top ones first.
        </p>
      )}

      {/* Skills table */}
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="pb-2 font-medium">Skill</th>
              <th className="pb-2 font-medium">Type</th>
              {shapData && <th className="pb-2 font-medium text-right">Impact</th>}
              <th className="pb-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {allSkills.map(({ id, status }) => {
              const skill = skillMap.get(id);
              const shapVal = shapData?.skills[id];
              return (
                <tr key={id} className="border-b border-slate-50">
                  <td className="py-2">{skill?.name ?? id}</td>
                  <td className="py-2 text-slate-400">
                    {skill?.category === "knowledge" ? "Knowledge" : "Skill"}
                  </td>
                  {shapData && (
                    <td className="py-2 text-right text-xs w-24">
                      {shapVal ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${shapVal.shapDirection > 0 ? "bg-emerald-400" : "bg-red-300"}`}
                              style={{ width: `${Math.min(shapVal.shapMean * 500, 100)}%` }}
                            />
                          </div>
                          <span className={shapVal.shapDirection > 0 ? "text-emerald-600" : "text-red-400"}>
                            {shapVal.shapDirection > 0 ? "+" : "-"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">--</span>
                      )}
                    </td>
                  )}
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
