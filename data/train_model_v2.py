"""
SkillBridge MVP — XGBoost v2: All available features

Adds: work_year, employment_type, remote_ratio, company_size, employee_residence
to the skill vector + experience + country features.
"""

import json
import os
import numpy as np
import pandas as pd
from collections import defaultdict
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import r2_score, mean_absolute_error, mean_absolute_percentage_error
import xgboost as xgb
import shap

RAW = os.path.join(os.path.dirname(__file__), "raw")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data")


def main():
    print("=== XGBoost v2: Full feature set ===\n")

    # --- Load data ---
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

    # --- Build skill vocabulary ---
    relevant_skill_ids = set()
    for occ_id in set(title_to_occ.values()):
        if occ_id in occ_map:
            relevant_skill_ids.update(occ_map[occ_id]["requiredSkills"])
    skill_ids = sorted(relevant_skill_ids)
    skill_to_idx = {sid: i for i, sid in enumerate(skill_ids)}
    print(f"Skill features: {len(skill_ids)}")

    # --- Encode categorical features ---
    exp_map = {"EN": 0, "MI": 1, "SE": 2, "EX": 3}
    emp_map = {"FT": 0, "PT": 1, "CT": 2, "FL": 3}  # full-time, part-time, contract, freelance
    size_map = {"S": 0, "M": 1, "L": 2}

    country_encoder = LabelEncoder()
    residence_encoder = LabelEncoder()

    # Fit encoders on full data
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

        occ_skills = set(occ_map[occ_id]["requiredSkills"])

        rows.append({
            "salary": salary,
            "experience": exp_val,
            "country": country_encoder.transform([row["company_location"]])[0],
            "residence": residence_encoder.transform([row["employee_residence"]])[0],
            "remote_ratio": int(row["remote_ratio"]),
            "company_size": size_map.get(row["company_size"], 1),
            "employment_type": emp_map.get(row["employment_type"], 0),
            "work_year": int(row["work_year"]),
            "occ_id": occ_id,
            "title": title,
            "skill_set": occ_skills,
        })

    df = pd.DataFrame(rows)
    print(f"Rows with ESCO mapping: {len(df)}")

    # --- Clip outliers ---
    p1, p99 = df["salary"].quantile(0.01), df["salary"].quantile(0.99)
    df = df[(df["salary"] >= p1) & (df["salary"] <= p99)]
    print(f"After outlier clipping: {len(df)}")

    # --- Sample weights ---
    df["group_key"] = df["title"] + "_" + df["experience"].astype(str)
    group_counts = df["group_key"].value_counts()
    median_count = group_counts.median()
    df["sample_weight"] = df["group_key"].map(
        lambda k: min(median_count / group_counts[k], 3.0)
    )

    # --- Build feature matrix ---
    n = len(df)
    skill_matrix = np.zeros((n, len(skill_ids)), dtype=np.float32)
    for i, skill_set in enumerate(df["skill_set"]):
        for sid in skill_set:
            if sid in skill_to_idx:
                skill_matrix[i, skill_to_idx[sid]] = 1.0

    extra_features = df[["experience", "country", "residence", "remote_ratio",
                          "company_size", "employment_type", "work_year"]].values

    X = np.column_stack([skill_matrix, extra_features])
    y = df["salary"].values
    weights = df["sample_weight"].values

    feature_names = (
        [f"skill_{sid}" for sid in skill_ids]
        + ["experience", "country", "residence", "remote_ratio",
           "company_size", "employment_type", "work_year"]
    )

    print(f"Feature matrix: {X.shape}")
    print(f"Target: mean=${y.mean():,.0f}, median=${np.median(y):,.0f}\n")

    # --- Train/test split ---
    stratify_key = df["group_key"].values
    key_counts = pd.Series(stratify_key).value_counts()
    small_groups = set(key_counts[key_counts < 2].index)
    stratify_safe = np.array([k if k not in small_groups else "__other__" for k in stratify_key])

    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, weights, test_size=0.2, random_state=42, stratify=stratify_safe,
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # --- Train ---
    model = xgb.XGBRegressor(
        n_estimators=500,
        max_depth=7,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.7,
        reg_alpha=0.1,
        reg_lambda=1.0,
        min_child_weight=5,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        X_train, y_train,
        sample_weight=w_train,
        eval_set=[(X_test, y_test)],
        verbose=100,
    )

    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)
    mae = mean_absolute_error(y_test, y_pred_test)
    mape = mean_absolute_percentage_error(y_test, y_pred_test)

    print(f"\n--- Results ---")
    print(f"R2 train: {r2_train:.4f}")
    print(f"R2 test:  {r2_test:.4f}")
    print(f"MAE:      ${mae:,.0f}")
    print(f"MAPE:     {mape:.1%}")

    # --- SHAP ---
    print("\nComputing SHAP values...")
    explainer = shap.TreeExplainer(model)
    sample_size = min(2000, len(X_train))
    np.random.seed(42)
    X_sample = X_train[np.random.choice(len(X_train), sample_size, replace=False)]
    shap_values = explainer.shap_values(X_sample)
    mean_abs_shap = np.abs(shap_values).mean(axis=0)

    # Skill SHAP
    skill_importance = {}
    for i, sid in enumerate(skill_ids):
        imp = float(mean_abs_shap[i])
        if imp > 0:
            skill_importance[sid] = {
                "name": skill_name_map.get(sid, sid),
                "shapMean": round(imp, 2),
                "shapDirection": float(np.mean(shap_values[:, i])),
            }
    skill_importance = dict(sorted(skill_importance.items(), key=lambda x: x[1]["shapMean"], reverse=True))

    # Non-skill feature SHAP
    extra_start = len(skill_ids)
    extra_names = ["experience", "country", "residence", "remote_ratio",
                   "company_size", "employment_type", "work_year"]
    print("\nFeature importance (non-skill):")
    for j, name in enumerate(extra_names):
        print(f"  {name}: ${mean_abs_shap[extra_start + j]:,.0f}")

    print(f"\nTop 10 skills by SHAP:")
    for i, (sid, info) in enumerate(list(skill_importance.items())[:10]):
        d = "+" if info["shapDirection"] > 0 else "-"
        print(f"  {i+1}. {info['name']}: ${info['shapMean']:,.0f} ({d})")

    base_value = float(explainer.expected_value)

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
                # Use median/mode for other features
                x = np.concatenate([
                    full_vector,
                    [exp_val, country_val, country_val, 0, 1, 0, 2025]
                ]).reshape(1, -1)

                pred = float(model.predict(x)[0])
                sv = explainer.shap_values(x)[0]

                contribs = []
                for i, sid in enumerate(skill_ids):
                    if sid in set(occ["requiredSkills"]) and abs(sv[i]) > 50:
                        contribs.append({
                            "skillId": sid,
                            "name": skill_name_map.get(sid, sid),
                            "contribution": round(float(sv[i]), 0),
                        })
                contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)

                key = f"{exp_name}_{country_code}"
                occ_preds[key] = {
                    "predicted": round(pred, 0),
                    "experienceEffect": round(float(sv[extra_start]), 0),
                    "countryEffect": round(float(sv[extra_start + 1]), 0),
                    "topSkillContributions": contribs[:10],
                }
        predictions[occ_id] = occ_preds

    print(f"Predictions for {len(predictions)} occupations")

    # --- Export ---
    print("\nExporting...")

    shap_data = {
        "baseValue": round(base_value, 0),
        "experienceShap": round(float(mean_abs_shap[extra_start]), 0),
        "countryShap": round(float(mean_abs_shap[extra_start + 1]), 0),
        "skills": skill_importance,
        "modelR2": round(r2_test, 4),
    }
    with open(os.path.join(OUT, "shap.json"), "w", encoding="utf-8") as f:
        json.dump(shap_data, f, ensure_ascii=False)

    with open(os.path.join(OUT, "predictions.json"), "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False)

    model.save_model(os.path.join(OUT, "model.json"))

    print(f"\nDone! R2 = {r2_test:.4f}")


if __name__ == "__main__":
    main()
