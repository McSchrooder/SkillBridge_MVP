"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import Logo from "@/components/Logo";

interface AnalysisRun {
  occupationTitle: string;
  matchPercentage: number;
  skillsMatched: number;
  skillsMissing: number;
  timestamp: string;
  url: string;
}

function loadHistory(): AnalysisRun[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("skillbridge_history") || "[]");
  } catch {
    return [];
  }
}

export default function LandingPage() {
  const [history, setHistory] = useState<AnalysisRun[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const deleteRun = useCallback((index: number) => {
    const updated = history.filter((_, i) => i !== index);
    setHistory(updated);
    localStorage.setItem("skillbridge_history", JSON.stringify(updated));
  }, [history]);

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center py-10 sm:py-16">
        <div className="flex items-center justify-center mb-4">
          <Logo size="lg" />
        </div>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto">
          Find out what skills you need for the career you want, what
          they&apos;re worth in salary, and where to learn them — powered by EU
          labor market data.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6">
          <Link
            href="/input"
            className="px-6 py-3 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/results"
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            View Demo Results
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          {
            title: "Skill Gap Analysis",
            desc: "See which skills you have vs. what employers need",
            icon: (
              <svg className="w-8 h-8 text-sky-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
            ),
          },
          {
            title: "Salary Insights",
            desc: "Real salary data by role, experience, and country",
            icon: (
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            ),
          },
          {
            title: "Course Recommendations",
            desc: "Targeted courses to close your skill gaps",
            icon: (
              <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
              </svg>
            ),
          },
          {
            title: "Demand Trends",
            desc: "Is your target career growing or shrinking?",
            icon: (
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
            ),
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
          >
            {feature.icon}
            <h3 className="font-semibold text-slate-900">{feature.title}</h3>
            <p className="text-sm text-slate-500">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Previous analysis runs */}
      {history.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Your Previous Analyses
          </h2>
          <div className="space-y-3">
            {history.map((run, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm transition-all"
              >
                <Link
                  href={run.url}
                  className="flex-1 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {run.occupationTitle}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {run.skillsMatched} matched, {run.skillsMissing} missing
                        &middot;{" "}
                        {new Date(run.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-sky-600">
                        {run.matchPercentage}%
                      </span>
                      <p className="text-xs text-slate-400">match</p>
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => deleteRun(i)}
                  className="p-3 mr-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Delete this analysis"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data sources */}
      <div className="mt-12 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Data Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600">
          <div>
            <span className="font-medium">ESCO v1.2.1</span> — EU taxonomy of
            occupations &amp; skills
          </div>
          <div>
            <span className="font-medium">ai-jobs.net</span> — Salary survey
            data (CC0, weekly updated)
          </div>
          <div>
            <span className="font-medium">Coursera 2024</span> — 6,600+ courses
            with skill tags
          </div>
          <div>
            <span className="font-medium">Demand proxy</span> — Derived from
            job posting volume
          </div>
        </div>
      </div>
    </div>
  );
}
