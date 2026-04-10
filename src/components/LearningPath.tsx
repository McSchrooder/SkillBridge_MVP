"use client";

import { useState } from "react";
import { LearningStep } from "@/lib/learningPath";

interface LearningPathProps {
  steps: LearningStep[];
  matchPercentage: number;
  occupationTitle: string;
}

const TIER_CONFIG = {
  foundation: {
    label: "Foundation",
    color: "bg-sky-500",
    lightColor: "bg-sky-50 border-sky-200",
    textColor: "text-sky-700",
    desc: "Theory and broad concepts — start here",
  },
  core: {
    label: "Core",
    color: "bg-violet-500",
    lightColor: "bg-violet-50 border-violet-200",
    textColor: "text-violet-700",
    desc: "Essential competencies for the role",
  },
  advanced: {
    label: "Advanced",
    color: "bg-amber-500",
    lightColor: "bg-amber-50 border-amber-200",
    textColor: "text-amber-700",
    desc: "Specialized skills to stand out",
  },
};

export default function LearningPath({
  steps,
  matchPercentage,
  occupationTitle,
}: LearningPathProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (steps.length === 0) return null;

  const tiers = ["foundation", "core", "advanced"] as const;
  const grouped = tiers.map((tier) => ({
    tier,
    ...TIER_CONFIG[tier],
    steps: steps.filter((s) => s.tier === tier),
  }));

  const totalSteps = steps.length;
  const completionTarget = Math.min(matchPercentage + (100 - matchPercentage), 100);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Your Learning Path
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {totalSteps} skills to learn for {occupationTitle}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-600">
            You are <span className="font-semibold text-sky-600">{matchPercentage}%</span> ready
          </span>
          <span className="text-slate-400">Target: {completionTarget}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${matchPercentage}%` }}
            />
            <div
              className="bg-emerald-200 transition-all"
              style={{ width: `${completionTarget - matchPercentage}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>Current skills</span>
          <span>After completing path</span>
        </div>
      </div>

      <div className="space-y-6">
        {grouped.map(
          ({ tier, label, color, lightColor, textColor, desc, steps: tierSteps }) => {
            if (tierSteps.length === 0) return null;
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <h4 className="text-sm font-semibold text-slate-700">
                    {label}
                  </h4>
                  <span className="text-xs text-slate-400">
                    {tierSteps.length} skill{tierSteps.length !== 1 ? "s" : ""} &middot; {desc}
                  </span>
                </div>

                <div className="ml-1.5 border-l-2 border-slate-200 pl-5 space-y-3">
                  {tierSteps.map((step, idx) => {
                    const isExpanded = expandedStep === step.skillId;
                    return (
                      <div key={step.skillId} className="relative">
                        <div
                          className={`absolute -left-[25px] top-2.5 w-2.5 h-2.5 rounded-full border-2 border-white ${color}`}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedStep(isExpanded ? null : step.skillId)
                          }
                          className={`w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm ${
                            isExpanded ? lightColor : "border-slate-100 hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 font-mono w-5">
                                {idx + 1}.
                              </span>
                              <span className="text-sm font-medium text-slate-900">
                                {step.skillName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.courses.length > 0 && (
                                <span className="text-xs text-slate-400">
                                  {step.courses.length} course{step.courses.length !== 1 ? "s" : ""}
                                </span>
                              )}
                              <svg
                                className={`w-4 h-4 text-slate-400 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                                />
                              </svg>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 ml-7">
                            {step.reason}
                          </p>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 ml-7 text-xs text-slate-500">
                            {step.courses.length > 0 ? (
                              <p>
                                {step.courses.length} course{step.courses.length !== 1 ? "s" : ""} available
                                — see <a href="#courses" className="text-sky-600 underline">Recommended Courses</a> below
                                and filter by this skill.
                              </p>
                            ) : (
                              <p>No Coursera courses mapped to this skill yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
