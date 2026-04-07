"use client";

import { ShapData, PredictionEntry } from "@/lib/data";

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
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">
              ML Salary Prediction
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
              XGBoost
            </span>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Not available for this role
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {occupationTitle} &middot; {experienceLevel} &middot; {country}
        </p>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-5">
          <p className="text-sm text-slate-700 font-medium mb-2">
            We can not run the salary prediction for this role.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            The XGBoost model is trained on the same ai-jobs.net survey as the salary chart above, which only covers AI, data, and software occupations. We pre-computed predictions for the roles where the training data is reliable, and we deliberately do not show predictions for roles where it is not, because a confident-looking number on top of empty data would be misleading.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mt-2">
            To see the prediction in action, try a role like data scientist, machine learning engineer, or data analyst.
          </p>
        </div>
      </div>
    );
  }

  const brackets = shapData.brackets || [];
  const isClassifier = shapData.modelType === "classifier";
  const accuracy = shapData.accuracy || 0;
  const f1 = shapData.f1 || 0;

  const contribs = prediction.topSkillContributions || [];
  const probs = prediction.probabilities || [];

  // For waterfall bars, find max absolute contribution for scaling
  const allValues = [
    ...contribs.map((c) => Math.abs(c.contribution)),
    Math.abs(prediction.experienceEffect),
    Math.abs(prediction.countryEffect),
  ];
  const maxAbsContrib = Math.max(...allValues, 0.001);

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
        </p>
      </div>

      {/* Predicted bracket */}
      {isClassifier && prediction.bracketLabel && (
        <div className="text-center py-5 rounded-xl bg-gradient-to-r from-violet-50 to-sky-50">
          <p className="text-sm text-slate-500">Predicted Salary Bracket</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {prediction.bracketRange}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {prediction.bracketLabel} tier
          </p>
        </div>
      )}

      {/* Bracket probabilities */}
      {isClassifier && probs.length > 0 && brackets.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">
            Confidence by bracket
          </h4>
          <div className="space-y-2">
            {brackets.map((bracket: { label: string; range: string }, i: number) => {
              const prob = probs[i] || 0;
              const isSelected = i === prediction.predictedBracket;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-28 text-xs shrink-0 ${isSelected ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                    {bracket.range}
                  </span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isSelected ? "bg-sky-500" : "bg-slate-300"
                      }`}
                      style={{ width: `${Math.max(prob * 100, 2)}%` }}
                    />
                  </div>
                  <span className={`w-12 text-right text-xs ${isSelected ? "font-semibold text-slate-900" : "text-slate-400"}`}>
                    {(prob * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Why this prediction? */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          What drives this prediction?
        </h4>
        <p className="text-xs text-slate-400 mb-4">
          Each factor pushes the prediction toward a higher or lower bracket.
          Positive = pushes up, negative = pushes down.
        </p>

        <div className="space-y-2">
          <WaterfallRow
            label={`Experience: ${experienceLevel}`}
            value={prediction.experienceEffect}
            maxAbsValue={maxAbsContrib}
          />
          <WaterfallRow
            label={`Country: ${country}`}
            value={prediction.countryEffect}
            maxAbsValue={maxAbsContrib}
          />
          {contribs.map((c) => (
            <WaterfallRow
              key={c.skillId}
              label={c.name}
              value={c.contribution}
              maxAbsValue={maxAbsContrib}
            />
          ))}
        </div>
      </div>

      {/* Model performance + disclaimer */}
      <div className="border-t border-slate-100 pt-3 space-y-2">
        <div className="flex gap-4 text-xs">
          <span className="text-slate-500">
            Accuracy: <span className="font-semibold text-slate-700">{(accuracy * 100).toFixed(1)}%</span>
          </span>
          <span className="text-slate-500">
            F1 Score: <span className="font-semibold text-slate-700">{(f1 * 100).toFixed(1)}%</span>
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          XGBoost classifier trained on 130k salary records mapped to ESCO skill profiles.
          Predicts salary bracket based on occupation skills, experience, and location.
          SHAP values show which factors push toward higher or lower brackets.
          Use as directional guidance for skill prioritization.
        </p>
      </div>
    </div>
  );
}

function WaterfallRow({
  label,
  value,
  maxAbsValue,
}: {
  label: string;
  value: number;
  maxAbsValue: number;
}) {
  const isPositive = value >= 0;
  // Scale to percentage of the half-bar (each side is 50% of container)
  const pct = Math.max((Math.abs(value) / maxAbsValue) * 45, 1);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-40 sm:w-48 text-slate-600 truncate shrink-0 text-xs">
        {label}
      </span>
      {/* Bar area: left half = negative, right half = positive */}
      <div className="flex-1 h-5 flex items-center">
        {/* Negative side */}
        <div className="w-1/2 flex justify-end">
          {!isPositive && (
            <div
              className="h-3 bg-red-400 rounded-l"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        {/* Center line */}
        <div className="w-px h-4 bg-slate-300 shrink-0" />
        {/* Positive side */}
        <div className="w-1/2">
          {isPositive && (
            <div
              className="h-3 bg-emerald-400 rounded-r"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </div>
      <span
        className={`w-16 text-right text-xs font-medium shrink-0 ${
          isPositive ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {isPositive ? "+" : ""}{value.toFixed(3)}
      </span>
    </div>
  );
}
