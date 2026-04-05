"use client";

import { PredictionEntry, ShapData } from "@/lib/data";

interface SalaryPredictionProps {
  prediction: PredictionEntry | null;
  shapData: ShapData | null;
  occupationTitle: string;
  experienceLevel: string;
  country: string;
}

export default function SalaryPrediction({
  prediction,
  shapData,
  occupationTitle,
  experienceLevel,
  country,
}: SalaryPredictionProps) {
  if (!prediction || !shapData) {
    return null;
  }

  const contribs = prediction.topSkillContributions;
  const maxAbsContrib = Math.max(
    ...contribs.map((c) => Math.abs(c.contribution)),
    Math.abs(prediction.experienceEffect),
    Math.abs(prediction.countryEffect),
    1
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-semibold text-slate-900">
            ML Salary Prediction
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
            XGBoost
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {occupationTitle} &middot; {experienceLevel} &middot; {country}
          &middot; Model R2: {shapData.modelR2.toFixed(2)}
        </p>
      </div>

      {/* Predicted salary */}
      <div className="text-center py-4 rounded-xl bg-gradient-to-r from-violet-50 to-sky-50">
        <p className="text-sm text-slate-500">Predicted Annual Salary</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">
          ${prediction.predicted.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* Why this number? - SHAP waterfall */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          Why this prediction?
        </h4>
        <p className="text-xs text-slate-400 mb-4">
          Starting from a base salary of ${shapData.baseValue.toLocaleString()},
          each factor shifts the prediction up or down.
        </p>

        <div className="space-y-2">
          {/* Experience effect */}
          <WaterfallRow
            label={`Experience: ${experienceLevel}`}
            value={prediction.experienceEffect}
            maxAbsValue={maxAbsContrib}
            color="sky"
          />

          {/* Country effect */}
          <WaterfallRow
            label={`Country: ${country}`}
            value={prediction.countryEffect}
            maxAbsValue={maxAbsContrib}
            color="sky"
          />

          {/* Top skill contributions */}
          {contribs.map((c) => (
            <WaterfallRow
              key={c.skillId}
              label={c.name}
              value={c.contribution}
              maxAbsValue={maxAbsContrib}
              color="violet"
            />
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
        This prediction is from an XGBoost model trained on 130k salary records
        mapped to ESCO skill profiles. R2 = {shapData.modelR2.toFixed(2)} indicates
        the model explains {(shapData.modelR2 * 100).toFixed(0)}% of salary variance.
        Use as directional guidance, not a precise estimate. SHAP values show how
        each factor shifts the prediction relative to the average.
      </p>
    </div>
  );
}

function WaterfallRow({
  label,
  value,
  maxAbsValue,
  color,
}: {
  label: string;
  value: number;
  maxAbsValue: number;
  color: "sky" | "violet";
}) {
  const isPositive = value >= 0;
  const barWidth = Math.max((Math.abs(value) / maxAbsValue) * 100, 2);

  const bgColor = isPositive
    ? color === "sky"
      ? "bg-emerald-400"
      : "bg-emerald-400"
    : "bg-red-400";

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-48 sm:w-56 text-slate-600 truncate shrink-0 text-xs">
        {label}
      </span>
      <div className="flex-1 flex items-center h-5">
        <div className="relative w-full h-full flex items-center">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200" />

          {isPositive ? (
            <div className="absolute left-1/2 h-3 flex items-center">
              <div
                className={`${bgColor} h-full rounded-r`}
                style={{ width: `${barWidth / 2}%` }}
              />
            </div>
          ) : (
            <div
              className="absolute h-3 flex items-center justify-end"
              style={{
                right: "50%",
                width: `${barWidth / 2}%`,
              }}
            >
              <div className={`${bgColor} h-full w-full rounded-l`} />
            </div>
          )}
        </div>
      </div>
      <span
        className={`w-20 text-right text-xs font-medium shrink-0 ${
          isPositive ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {isPositive ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}
