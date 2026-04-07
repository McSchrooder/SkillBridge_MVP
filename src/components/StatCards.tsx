"use client";

interface StatCard {
  label: string;
  value: string;
}

interface StatCardsProps {
  stats: StatCard[];
}

/**
 * Row of summary stat cards at the top of the results page.
 * Matches the mockup: Jobs Available, Top Skill, Courses Recommended, Progress %, Avg. Salary.
 *
 * TODO: Wire up with real computed values from analysis results.
 */
export default function StatCards({ stats }: StatCardsProps) {
  const colsClass =
    stats.length >= 4
      ? "md:grid-cols-4"
      : stats.length === 3
        ? "md:grid-cols-3"
        : "md:grid-cols-2";
  return (
    <div className={`grid grid-cols-2 ${colsClass} gap-4`}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
