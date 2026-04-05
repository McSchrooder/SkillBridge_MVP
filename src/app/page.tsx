"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

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

  const deleteRun = useCallback(
    (index: number) => {
      const updated = history.filter((_, i) => i !== index);
      setHistory(updated);
      localStorage.setItem("skillbridge_history", JSON.stringify(updated));
    },
    [history]
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero section with gradient */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 text-white">
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sky-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-30%] right-[-10%] w-[400px] h-[400px] bg-violet-500/15 rounded-full blur-[100px]" />

        <div className="relative max-w-5xl mx-auto px-6 sm:px-8 py-20 sm:py-28">
          <div className="text-center space-y-6">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <Image
                src="/skillbridge_icon.png"
                alt="SkillBridge"
                width={52}
                height={52}
                className="drop-shadow-lg"
              />
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                <span className="text-sky-400">Skill</span>
                <span className="text-white">Bridge</span>
              </h1>
            </div>

            {/* SDG badges */}
            <div className="flex items-center justify-center gap-3 text-xs font-medium">
              <a
                href="https://sdgs.un.org/goals/goal4"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors"
              >
                SDG 4 — Quality Education
              </a>
              <a
                href="https://sdgs.un.org/goals/goal8"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors"
              >
                SDG 8 — Decent Work
              </a>
            </div>

            {/* Tagline */}
            <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Discover the skills you need, what they&apos;re worth, and where
              to learn them — powered by{" "}
              <span className="text-sky-400 font-medium">
                EU labor market data
              </span>
              .
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/input"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-400 transition-all shadow-lg shadow-sky-500/25 hover:shadow-sky-400/30"
              >
                Analyze My Skills
                <svg
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
              <Link
                href="/results"
                className="inline-flex items-center justify-center px-8 py-3.5 border border-white/20 text-white rounded-xl font-semibold hover:bg-white/10 transition-all backdrop-blur-sm"
              >
                View Demo
              </Link>
            </div>
          </div>

          {/* Data stats bar */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: "725", label: "Occupations", sub: "ESCO taxonomy" },
              { value: "13.4k", label: "Skills mapped", sub: "EU standard" },
              { value: "5,700+", label: "Courses", sub: "Coursera catalog" },
              { value: "79", label: "Countries", sub: "Salary data" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
              >
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-300 mt-1">{stat.label}</p>
                <p className="text-xs text-slate-500">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20 px-6 sm:px-8 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Tell us your skills",
              desc: "Select your target occupation and the skills you already have from the ESCO taxonomy.",
              color: "bg-sky-500",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              ),
            },
            {
              step: "2",
              title: "Get your analysis",
              desc: "See your skill gaps, salary insights by country, and demand trends for your target role.",
              color: "bg-violet-500",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                </svg>
              ),
            },
            {
              step: "3",
              title: "Bridge the gap",
              desc: "Follow personalized course recommendations mapped to each missing skill.",
              color: "bg-emerald-500",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              ),
            },
          ].map((item) => (
            <div key={item.step} className="text-center space-y-4">
              <div
                className={`${item.color} w-14 h-14 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg`}
              >
                {item.icon}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Step {item.step}
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="py-16 px-6 sm:px-8 bg-slate-50/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
            What you get
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: "Skill Gap Analysis",
                desc: "Compare your skills against occupation requirements from the EU's ESCO taxonomy. See exactly which skills you have and which you need — color-coded and ranked.",
                icon: (
                  <svg className="w-6 h-6 text-sky-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                  </svg>
                ),
              },
              {
                title: "Salary Insights",
                desc: "Real salary data across 79 countries and 4 experience levels. See median, 25th and 75th percentile ranges for your target role.",
                icon: (
                  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                ),
              },
              {
                title: "Course Recommendations",
                desc: "4,800+ Coursera courses mapped to ESCO skills. Browse by missing skill, filter by rating, and link directly to the course page.",
                icon: (
                  <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                  </svg>
                ),
              },
              {
                title: "Demand Trends",
                desc: "Track how job demand is shifting year-over-year. See if your target career is growing before you invest time in reskilling.",
                icon: (
                  <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-200 bg-white p-6 flex gap-4 hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Previous runs + data sources */}
      <section className="py-16 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Previous analysis runs */}
          {history.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Your Previous Analyses
              </h2>
              <div className="space-y-3">
                {history.map((run, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm transition-all"
                  >
                    <Link href={run.url} className="flex-1 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {run.occupationTitle}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {run.skillsMatched} matched, {run.skillsMissing}{" "}
                            missing &middot;{" "}
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
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Built on open data
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  name: "ESCO v1.2.1",
                  desc: "EU taxonomy of occupations & skills",
                  tag: "European Commission",
                  url: "https://esco.ec.europa.eu/en/use-esco/download",
                },
                {
                  name: "ai-jobs.net",
                  desc: "150k+ salary records, weekly updated",
                  tag: "CC0 License",
                  url: "https://github.com/foorilla/ai-jobs-net-salaries",
                },
                {
                  name: "Coursera Dataset",
                  desc: "8,300+ courses with skill tags",
                  tag: "CC0 Public Domain",
                  url: "https://www.kaggle.com/datasets/elvinrustam/coursera-dataset",
                },
                {
                  name: "Demand Proxy",
                  desc: "Job posting volume trends 2021-2025",
                  tag: "Derived from ai-jobs.net",
                  url: "https://github.com/foorilla/ai-jobs-net-salaries",
                },
              ].map((source) => (
                <a
                  key={source.name}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-sky-50 transition-colors group"
                >
                  <div className="w-2 h-2 rounded-full bg-sky-500 mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 group-hover:text-sky-700">
                      {source.name}
                      <svg className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </p>
                    <p className="text-xs text-slate-500">{source.desc}</p>
                    <span className="inline-block mt-1 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {source.tag}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 sm:px-8 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <p>SkillBridge MVP — Tomorrow University 2026</p>
          <p>
            Supporting{" "}
            <a href="https://sdgs.un.org/goals/goal4" target="_blank" rel="noopener noreferrer" className="hover:text-sky-400 transition-colors">SDG 4 (Quality Education)</a>
            {" "}&amp;{" "}
            <a href="https://sdgs.un.org/goals/goal8" target="_blank" rel="noopener noreferrer" className="hover:text-sky-400 transition-colors">SDG 8 (Decent Work)</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
