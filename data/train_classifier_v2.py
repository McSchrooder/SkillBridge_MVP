"""
SkillBridge — XGBoost Salary Bracket Classifier v2

Key improvement: target-encode occupation (mean salary per title) as a feature.
This gives the model a strong baseline signal, then experience + country + skills
explain variance around that baseline.
"""

import json
import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, f1_score
import xgboost as xgb
import shap

RAW = os.path.join(os.path.dirname(__file__), "raw")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data")

BRACKETS = [
    {"label": "Standard", "range": "Under $100k", "min": 0, "max": 100_000},
    {"label": "Competitive", "range": "$100k - $190k", "min": 100_000, "max": 190_000},
    {"label": "Top", "range": "Over $190k", "min": 190_000, "max": 999_999},
]


def salary_to_bracket(salary):
    for i, b in enumerate(BRACKETS):
        if salary < b["max"]:
            return i
    return len(BRACKETS) - 1


def main():
    print("=== XGBoost Salary Bracket Classifier v2 ===\n")

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
    size_map = {"S": 0, "M": 1, "L": 2}
    country_encoder = LabelEncoder()
    country_encoder.fit(salaries["company_location"])

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
            "remote_ratio": int(row["remote_ratio"]),
            "company_size": size_map.get(row["company_size"], 1),
            "work_year": int(row["work_year"]),
            "occ_id": occ_id,
            "title": title,
            "skill_set": set(occ_map[occ_id]["requiredSkills"]),
        })

    df = pd.DataFrame(rows)
    print(f"Total rows: {len(df)}")

    # --- Target-encode occupation: mean salary per title ---
    # Use K-fold to avoid leakage
    title_mean_salary = {}
    kf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    df["title_encoded"] = 0.0
    for train_idx, val_idx in kf.split(df, df["bracket"]):
        train_means = df.iloc[train_idx].groupby("title")["salary"].mean()
        df.iloc[val_idx, df.columns.get_loc("title_encoded")] = (
            df.iloc[val_idx]["title"].map(train_means).fillna(df.iloc[train_idx]["salary"].mean())
        )
    # Also compute global mean for prediction time
    title_mean_salary = df.groupby("title")["salary"].mean().to_dict()
    global_mean = df["salary"].mean()
    print(f"Target-encoded {len(title_mean_salary)} titles (global mean: ${global_mean:,.0f})")

    # --- Bracket distribution ---
    print(f"\nBracket distribution:")
    for i, b in enumerate(BRACKETS):
        count = (df["bracket"] == i).sum()
        print(f"  {b['label']} ({b['range']}): {count} ({100*count/len(df):.1f}%)")

    # --- Sample weights ---
    bracket_counts = df["bracket"].value_counts()
    target_count = bracket_counts.median()
    df["sample_weight"] = df["bracket"].map(
        lambda b: min(target_count / bracket_counts[b], 5.0)
    )

    # --- Feature matrix ---
    n = len(df)
    skill_matrix = np.zeros((n, len(skill_ids)), dtype=np.float32)
    for i, skill_set in enumerate(df["skill_set"]):
        for sid in skill_set:
            if sid in skill_to_idx:
                skill_matrix[i, skill_to_idx[sid]] = 1.0

    extra = df[["title_encoded", "experience", "country", "remote_ratio",
                "company_size", "work_year"]].values.astype(np.float32)

    X = np.column_stack([skill_matrix, extra])
    y = df["bracket"].values
    weights = df["sample_weight"].values

    feature_names = (
        [f"skill_{sid}" for sid in skill_ids]
        + ["title_encoded", "experience", "country", "remote_ratio",
           "company_size", "work_year"]
    )
    print(f"\nFeature matrix: {X.shape}")

    # --- Split ---
    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, weights, test_size=0.2, random_state=42, stratify=y,
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}\n")

    # --- Train ---
    model = xgb.XGBClassifier(
        n_estimators=600,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.7,
        reg_alpha=0.1,
        reg_lambda=1.0,
        min_child_weight=5,
        num_class=len(BRACKETS),
        objective="multi:softprob",
        eval_metric="mlogloss",
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
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")

    print(f"\n--- Results ---")
    print(f"Accuracy: {acc:.4f}")
    print(f"F1 (weighted): {f1:.4f}")
    target_names = [f"{b['label']} ({b['range']})" for b in BRACKETS]
    print(classification_report(y_test, y_pred, target_names=target_names))

    # --- SHAP ---
    print("Computing SHAP values...")
    explainer = shap.TreeExplainer(model)
    sample_size = min(2000, len(X_train))
    np.random.seed(42)
    X_sample = X_train[np.random.choice(len(X_train), sample_size, replace=False)]
    shap_values = explainer.shap_values(X_sample)

    sv_arr = np.array(shap_values)
    n_classes = len(BRACKETS)
    # Handle shape: could be (n_classes, n_samples, n_features) or (n_samples, n_features, n_classes)
    if sv_arr.ndim == 3:
        if sv_arr.shape[0] == n_classes:
            pass  # already (n_classes, n_samples, n_features)
        elif sv_arr.shape[2] == n_classes:
            sv_arr = sv_arr.transpose(2, 0, 1)

    # Mean absolute SHAP across all classes
    mean_abs_shap = np.zeros(X.shape[1])
    for cls in range(n_classes):
        mean_abs_shap += np.abs(sv_arr[cls]).mean(axis=0)
    mean_abs_shap /= n_classes

    # Direction: SHAP for top bracket
    shap_top = sv_arr[n_classes - 1]
    mean_shap_top = shap_top.mean(axis=0)

    skill_importance = {}
    for i, sid in enumerate(skill_ids):
        imp = float(mean_abs_shap[i])
        if imp > 0.001:
            skill_importance[sid] = {
                "name": skill_name_map.get(sid, sid),
                "shapMean": round(imp, 4),
                "shapDirection": round(float(mean_shap_top[i]), 4),
            }
    skill_importance = dict(sorted(skill_importance.items(), key=lambda x: x[1]["shapMean"], reverse=True))

    extra_start = len(skill_ids)
    extra_names = ["title_encoded", "experience", "country", "remote_ratio",
                   "company_size", "work_year"]
    print("\nFeature importance (non-skill):")
    for j, name in enumerate(extra_names):
        print(f"  {name}: {mean_abs_shap[extra_start + j]:.4f}")
    print(f"\nTop 10 skills:")
    for i, (sid, info) in enumerate(list(skill_importance.items())[:10]):
        d = "+" if info["shapDirection"] > 0 else "-"
        print(f"  {i+1}. {info['name']}: {info['shapMean']:.4f} ({d})")

    ev = explainer.expected_value
    base_values = [float(v) for v in ev] if hasattr(ev, '__iter__') else [float(ev)]

    # --- Pre-compute predictions ---
    print("\nPre-computing predictions...")
    top_countries = ["US", "GB", "DE", "CA", "FR", "ES", "IN", "NL", "AU", "BR"]
    top_countries = [c for c in top_countries if c in country_encoder.classes_]
    exp_names = ["entry", "mid", "senior", "executive"]

    # Build occ_id -> title mean salary lookup
    occ_to_title_mean = {}
    for title, occ_id in title_to_occ.items():
        if title in title_mean_salary:
            if occ_id not in occ_to_title_mean:
                occ_to_title_mean[occ_id] = []
            occ_to_title_mean[occ_id].append(title_mean_salary[title])

    predictions = {}
    for occ_id in set(title_to_occ.values()):
        if occ_id not in occ_map:
            continue
        occ = occ_map[occ_id]
        full_vector = np.zeros(len(skill_ids), dtype=np.float32)
        for sid in occ["requiredSkills"]:
            if sid in skill_to_idx:
                full_vector[skill_to_idx[sid]] = 1.0

        # Get title mean salary for this occupation
        tmeans = occ_to_title_mean.get(occ_id, [global_mean])
        title_enc = np.mean(tmeans)

        occ_preds = {}
        for exp_val, exp_name in enumerate(exp_names):
            for country_code in top_countries:
                country_val = country_encoder.transform([country_code])[0]
                x = np.concatenate([
                    full_vector,
                    [title_enc, exp_val, country_val, 0, 1, 2025]
                ]).reshape(1, -1).astype(np.float32)

                proba = model.predict_proba(x)[0]
                pred_class = int(np.argmax(proba))

                # Per-prediction SHAP
                sv_raw = np.array(explainer.shap_values(x))
                if sv_raw.ndim == 3 and sv_raw.shape[0] == n_classes:
                    sv_pred = sv_raw[pred_class][0]
                elif sv_raw.ndim == 3 and sv_raw.shape[2] == n_classes:
                    sv_pred = sv_raw[0, :, pred_class]
                else:
                    sv_pred = sv_raw[0]

                contribs = []
                for i, sid in enumerate(skill_ids):
                    if sid in set(occ["requiredSkills"]) and abs(sv_pred[i]) > 0.005:
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
                    "experienceEffect": round(float(sv_pred[extra_start + 1]), 4),
                    "countryEffect": round(float(sv_pred[extra_start + 2]), 4),
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
        "experienceShap": round(float(mean_abs_shap[extra_start + 1]), 4),
        "countryShap": round(float(mean_abs_shap[extra_start + 2]), 4),
        "skills": skill_importance,
    }
    with open(os.path.join(OUT, "shap.json"), "w", encoding="utf-8") as f:
        json.dump(shap_data, f, ensure_ascii=False)

    with open(os.path.join(OUT, "predictions.json"), "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False)

    model.save_model(os.path.join(OUT, "model.json"))

    # --- Sanity checks ---
    print(f"\n--- Sanity Checks ---")
    above_ex = sum(1 for p in predictions.values() if p.get("executive_US", {}).get("predictedBracket", 0) >= 2)
    total = len(predictions)
    print(f"Executive US in Senior/Top bracket: {above_ex}/{total} ({100*above_ex/total:.0f}%)")

    below_en = sum(1 for p in predictions.values() if p.get("entry_IN", {}).get("predictedBracket", 0) <= 1)
    print(f"Entry India in Entry/Mid bracket: {below_en}/{total} ({100*below_en/total:.0f}%)")

    print(f"\nDone! Accuracy={acc:.4f}, F1={f1:.4f}")


if __name__ == "__main__":
    main()
