"""
SkillBridge MVP — XGBoost Salary Bracket Classifier

Predicts salary bracket (not exact salary) from skill profile.
Classification is more achievable than regression for this data.

Brackets:
  0: < $80k  (Entry-level / developing markets)
  1: $80-130k (Mid-range)
  2: $130-200k (Senior / competitive markets)
  3: > $200k  (Executive / top-tier)
"""

import json
import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, f1_score
import xgboost as xgb
import shap

RAW = os.path.join(os.path.dirname(__file__), "raw")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data")

BRACKETS = [
    {"label": "Below Median", "range": "Under $145k", "min": 0, "max": 145_000},
    {"label": "Above Median", "range": "Over $145k", "min": 145_000, "max": 999_999},
]


def salary_to_bracket(salary):
    for i, b in enumerate(BRACKETS):
        if salary < b["max"]:
            return i
    return len(BRACKETS) - 1


def main():
    print("=== XGBoost Salary Bracket Classifier ===\n")

    # --- Load ---
    salaries = pd.read_csv(os.path.join(RAW, "salaries.csv"))
    with open(os.path.join(OUT, "occupations.json"), encoding="utf-8") as f:
        occupations = json.load(f)
    with open(os.path.join(OUT, "skills.json"), encoding="utf-8") as f:
        skills_list = json.load(f)
    with open(os.path.join(OUT, "salaries.json"), encoding="utf-8") as f:
        salary_json = json.load(f)

    title_to_occ = {s["jobTitle"]: s["occupationId"] for s in salary_json if s.get("occupationId")}
    occ_map = {o["id"]: o for o in occupations}
    skill_name_map = {s["id"]: s["name"] for s in skills_list}

    # --- Skill vocabulary ---
    relevant_skill_ids = set()
    for occ_id in set(title_to_occ.values()):
        if occ_id in occ_map:
            relevant_skill_ids.update(occ_map[occ_id]["requiredSkills"])
    skill_ids = sorted(relevant_skill_ids)
    skill_to_idx = {sid: i for i, sid in enumerate(skill_ids)}
    print(f"Skill features: {len(skill_ids)}")

    # --- Encoders ---
    exp_map = {"EN": 0, "MI": 1, "SE": 2, "EX": 3}
    emp_map = {"FT": 0, "PT": 1, "CT": 2, "FL": 3}
    size_map = {"S": 0, "M": 1, "L": 2}
    country_encoder = LabelEncoder()
    residence_encoder = LabelEncoder()
    country_encoder.fit(salaries["company_location"])
    residence_encoder.fit(salaries["employee_residence"])

    # --- Build rows ---
    rows = []
    for _, row in salaries.iterrows():
        title = row["job_title"]
        if title not in title_to_occ:
            continue
        occ_id = title_to_occ[title]
        if occ_id not in occ_map:
            continue
        exp_val = exp_map.get(row["experience_level"])
        if exp_val is None:
            continue
        salary = row["salary_in_usd"]
        if salary <= 0 or salary > 1_000_000:
            continue

        rows.append({
            "salary": salary,
            "bracket": salary_to_bracket(salary),
            "experience": exp_val,
            "country": country_encoder.transform([row["company_location"]])[0],
            "residence": residence_encoder.transform([row["employee_residence"]])[0],
            "remote_ratio": int(row["remote_ratio"]),
            "company_size": size_map.get(row["company_size"], 1),
            "employment_type": emp_map.get(row["employment_type"], 0),
            "work_year": int(row["work_year"]),
            "occ_id": occ_id,
            "title": title,
            "skill_set": set(occ_map[occ_id]["requiredSkills"]),
        })

    df = pd.DataFrame(rows)
    print(f"Total rows: {len(df)}")
    print(f"\nBracket distribution:")
    for i, b in enumerate(BRACKETS):
        count = (df["bracket"] == i).sum()
        print(f"  {b['label']} ({b['range']}): {count} ({100*count/len(df):.1f}%)")

    # --- Sample weights to balance brackets ---
    bracket_counts = df["bracket"].value_counts()
    target_count = bracket_counts.median()
    df["sample_weight"] = df["bracket"].map(
        lambda b: min(target_count / bracket_counts[b], 5.0)
    )
    print(f"\nWeighted effective samples per bracket: ~{target_count:.0f}")

    # --- Feature matrix ---
    n = len(df)
    skill_matrix = np.zeros((n, len(skill_ids)), dtype=np.float32)
    for i, skill_set in enumerate(df["skill_set"]):
        for sid in skill_set:
            if sid in skill_to_idx:
                skill_matrix[i, skill_to_idx[sid]] = 1.0

    extra = df[["experience", "country", "residence", "remote_ratio",
                "company_size", "employment_type", "work_year"]].values

    X = np.column_stack([skill_matrix, extra])
    y = df["bracket"].values
    weights = df["sample_weight"].values

    feature_names = (
        [f"skill_{sid}" for sid in skill_ids]
        + ["experience", "country", "residence", "remote_ratio",
           "company_size", "employment_type", "work_year"]
    )
    print(f"Feature matrix: {X.shape}")

    # --- Stratified split ---
    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, weights, test_size=0.2, random_state=42, stratify=y,
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}\n")

    # --- Train ---
    model = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=7,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.7,
        reg_alpha=0.1,
        reg_lambda=1.0,
        min_child_weight=5,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        X_train, y_train,
        sample_weight=w_train,
        eval_set=[(X_test, y_test)],
        verbose=100,
    )

    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)

    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")

    print(f"\n--- Results ---")
    print(f"Accuracy: {acc:.4f}")
    print(f"F1 (weighted): {f1:.4f}")
    print(f"\nClassification Report:")
    target_names = [f"{b['label']} ({b['range']})" for b in BRACKETS]
    print(classification_report(y_test, y_pred, target_names=target_names))

    # --- SHAP ---
    print("Computing SHAP values...")
    explainer = shap.TreeExplainer(model)
    sample_size = min(2000, len(X_train))
    np.random.seed(42)
    X_sample = X_train[np.random.choice(len(X_train), sample_size, replace=False)]
    shap_values = explainer.shap_values(X_sample)  # shape: (n_classes, n_samples, n_features)

    n_classes = len(BRACKETS)
    sv_arr = np.array(shap_values)
    # Binary: shape is (n_samples, n_features) — positive = pushes toward class 1 (above median)
    if sv_arr.ndim == 2:
        mean_abs_shap_all = np.abs(sv_arr).mean(axis=0)
        mean_shap_top = sv_arr.mean(axis=0)  # positive = above median
    else:
        # Multi-class fallback
        mean_abs_shap_all = np.abs(sv_arr).mean(axis=0)
        mean_shap_top = sv_arr.mean(axis=0)

    skill_importance = {}
    for i, sid in enumerate(skill_ids):
        imp = float(mean_abs_shap_all[i])
        if imp > 0.001:
            skill_importance[sid] = {
                "name": skill_name_map.get(sid, sid),
                "shapMean": round(imp, 4),
                "shapDirection": round(float(mean_shap_top[i]), 4),
            }
    skill_importance = dict(sorted(skill_importance.items(), key=lambda x: x[1]["shapMean"], reverse=True))

    extra_start = len(skill_ids)
    extra_names = ["experience", "country", "residence", "remote_ratio",
                   "company_size", "employment_type", "work_year"]
    print("\nFeature importance (non-skill):")
    for j, name in enumerate(extra_names):
        print(f"  {name}: {mean_abs_shap_all[extra_start + j]:.4f}")

    print(f"\nTop 10 skills pushing toward higher brackets:")
    for i, (sid, info) in enumerate(list(skill_importance.items())[:10]):
        d = "+" if info["shapDirection"] > 0 else "-"
        print(f"  {i+1}. {info['name']}: {info['shapMean']:.4f} ({d})")

    ev = explainer.expected_value
    base_values = [float(ev)] if np.ndim(ev) == 0 else [float(v) for v in ev]

    # --- Pre-compute predictions ---
    print("\nPre-computing predictions...")
    top_countries = ["US", "GB", "DE", "CA", "FR", "ES", "IN", "NL", "AU", "BR"]
    top_countries = [c for c in top_countries if c in country_encoder.classes_]
    exp_names = ["entry", "mid", "senior", "executive"]

    predictions = {}
    for occ_id in set(title_to_occ.values()):
        if occ_id not in occ_map:
            continue
        occ = occ_map[occ_id]
        full_vector = np.zeros(len(skill_ids), dtype=np.float32)
        for sid in occ["requiredSkills"]:
            if sid in skill_to_idx:
                full_vector[skill_to_idx[sid]] = 1.0

        occ_preds = {}
        for exp_val, exp_name in enumerate(exp_names):
            for country_code in top_countries:
                country_val = country_encoder.transform([country_code])[0]
                x = np.concatenate([
                    full_vector,
                    [exp_val, country_val, country_val, 0, 1, 0, 2025]
                ]).reshape(1, -1)

                proba = model.predict_proba(x)[0]
                pred_class = int(np.argmax(proba))

                # SHAP — binary: positive pushes toward "above median"
                sv_raw = np.array(explainer.shap_values(x))
                sv_pred = sv_raw[0] if sv_raw.ndim == 2 else sv_raw[0, :, 0]

                contribs = []
                for i, sid in enumerate(skill_ids):
                    if sid in set(occ["requiredSkills"]) and abs(sv_pred[i]) > 0.01:
                        contribs.append({
                            "skillId": sid,
                            "name": skill_name_map.get(sid, sid),
                            "contribution": round(float(sv_pred[i]), 4),
                        })
                contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)

                key = f"{exp_name}_{country_code}"
                occ_preds[key] = {
                    "predictedBracket": pred_class,
                    "bracketLabel": BRACKETS[pred_class]["label"],
                    "bracketRange": BRACKETS[pred_class]["range"],
                    "probabilities": [round(float(p), 3) for p in proba],
                    "experienceEffect": round(float(sv_pred[extra_start]), 4),
                    "countryEffect": round(float(sv_pred[extra_start + 1]), 4),
                    "topSkillContributions": contribs[:10],
                }
        predictions[occ_id] = occ_preds

    print(f"Predictions for {len(predictions)} occupations")

    # --- Export ---
    print("\nExporting...")

    shap_data = {
        "modelType": "classifier",
        "brackets": BRACKETS,
        "baseValues": base_values,
        "accuracy": round(acc, 4),
        "f1": round(f1, 4),
        "experienceShap": round(float(mean_abs_shap_all[extra_start]), 4),
        "countryShap": round(float(mean_abs_shap_all[extra_start + 1]), 4),
        "skills": skill_importance,
    }
    with open(os.path.join(OUT, "shap.json"), "w", encoding="utf-8") as f:
        json.dump(shap_data, f, ensure_ascii=False)
    print(f"  shap.json: {len(skill_importance)} skills")

    with open(os.path.join(OUT, "predictions.json"), "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False)
    size_mb = os.path.getsize(os.path.join(OUT, "predictions.json")) / (1024 * 1024)
    print(f"  predictions.json: {size_mb:.1f} MB")

    model.save_model(os.path.join(OUT, "model.json"))

    print(f"\nDone! Accuracy={acc:.4f}, F1={f1:.4f}")


if __name__ == "__main__":
    main()
