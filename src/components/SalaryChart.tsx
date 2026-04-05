"use client";

import { SalaryStats } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ErrorBar,
} from "recharts";

interface SalaryChartProps {
  data: SalaryStats[];
}

const EXP_ORDER = { entry: 0, mid: 1, senior: 2, executive: 3 };
const EXP_LABELS: Record<string, string> = {
  entry: "Entry",
  mid: "Mid",
  senior: "Senior",
  executive: "Executive",
};

export default function SalaryChart({ data }: SalaryChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Salary Insights
        </h3>
        <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-400">
            No salary data available for this occupation.
          </p>
        </div>
      </div>
    );
  }

  const chartData = data
    .sort(
      (a, b) =>
        EXP_ORDER[a.experienceLevel] - EXP_ORDER[b.experienceLevel]
    )
    .map((s) => ({
      level: EXP_LABELS[s.experienceLevel] || s.experienceLevel,
      median: s.median,
      p25: s.p25,
      p75: s.p75,
      range: [s.median - s.p25, s.p75 - s.median],
      samples: s.sampleSize,
    }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        Salary Insights
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        USD per year &middot; {data[0]?.jobTitle}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="level" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) =>
              `$${Number(value).toLocaleString()}`
            }
          />
          <Bar dataKey="median" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
            <ErrorBar
              dataKey="range"
              width={8}
              strokeWidth={1.5}
              stroke="#64748b"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
