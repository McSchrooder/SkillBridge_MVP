"use client";

import { DemandTrend } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DemandTrendChartProps {
  data: DemandTrend[];
  title?: string;
}

export default function DemandTrendChart({
  data,
  title,
}: DemandTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Demand Trends
        </h3>
        <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-400">
            No demand data available for this occupation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        Demand Trends
      </h3>
      {title && (
        <p className="text-xs text-slate-400 mb-4">
          Job postings per year &middot; {title} &middot; Global (all countries)
        </p>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="postings"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
