"""
SkillBridge — XGBoost Salary Bracket Classifier v3

Improvements over v2:
- Quantile-based brackets (balanced classes by design)
- Multiple target encodings: title, title*experience, title*country
- Log-transformed salary for better separation
- Tuned hyperparameters
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


def main():
    print("=== XGBoost Salary Bracket Classifier v3 ===\n")

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

    # --- Encoders ---
    exp_map = {"EN": 0, "MI": 1, "SE": 2, "EX": 3}
    exp_names_list = ["entry", "mid", "senior", "executive"]
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
            "log_salary": np.log1p(salary),
            "experience": exp_val,
            "country_code": row["company_location"],
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

    # --- Quantile-based brackets (4 equal-sized groups) ---
    q25, q50, q75 = df["salary"].quantile([0.25, 0.50, 0.75])
    BRACKETS = [
        {"label": "Entry-level", "range": f"Under ${q25/1000:.0f}k", "min": 0, "max": int(q25)},
        {"label": "Mid-range", "range": f"${q25/1000:.0f}k - ${q50/1000:.0f}k", "min": int(q25), "max": int(q50)},
        {"label": "Competitive", "range": f"${q50/1000:.0f}k - ${q75/1000:.0f}k", "min": int(q50), "max": int(q75)},
        {"label": "Top-tier", "range": f"Over ${q75/1000:.0f}k", "min": int(q75), "max": 999_999},
    ]
    print(f"Quartile boundaries: ${q25:,.0f} / ${q50:,.0f} / ${q75:,.0f}")

    def salary_to_bracket(s):
        if s < q25: return 0
        if s < q50: return 1
        if s < q75: return 2
        return 3

    df["bracket"] = df["salary"].apply(salary_to_bracket)

    print(f"\nBracket distribution:")
    for i, b in enumerate(BRACKETS):
        count = (df["bracket"] == i).sum()
        print(f"  {b['label']} ({b['range']}): {count} ({100*count/len(df):.1f}%)")

    # --- Multiple target encodings (K-fold to avoid leakage) ---
    global_mean = df["salary"].mean()
    kf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    # 1. Title mean salary
    df["te_title"] = 0.0
    for train_idx, val_idx in kf.split(df, df["bracket"]):
        means = df.iloc[train_idx].groupby("title")["salary"].mean()
        df.iloc[val_idx, df.columns.get_loc("te_title")] = (
            df.iloc[val_idx]["title"].map(means).fillna(global_mean)
        )

    # 2. Title × experience mean salary
    df["title_exp"] = df["title"] + "_" + df["experience"].astype(str)
    df["te_title_exp"] = 0.0
    for train_idx, val_idx in kf.split(df, df["bracket"]):
        means = df.iloc[train_idx].groupby("title_exp")["salary"].mean()
        df.iloc[val_idx, df.columns.get_loc("te_title_exp")] = (
            df.iloc[val_idx]["title_exp"].map(means).fillna(global_mean)
        )

    # 3. Title × country mean salary
    df["title_country"] = df["title"] + "_" + df["country_code"]
    df["te_title_country"] = 0.0
    for train_idx, val_idx in kf.split(df, df["bracket"]):
        means = df.iloc[train_idx].groupby("title_country")["salary"].mean()
        df.iloc[val_idx, df.columns.get_loc("te_title_country")] = (
            df.iloc[val_idx]["title_country"].map(means).fillna(global_mean)
        )

    # Global means for prediction time
    te_title_global = df.groupby("title")["salary"].mean().to_dict()
    te_title_exp_global = df.groupby("title_exp")["salary"].mean().to_dict()
    te_title_country_global = df.groupby("title_country")["salary"].mean().to_dict()

    print(f"Target encodings: title({len(te_title_global)}), title*exp({len(te_title_exp_global)}), title*country({len(te_title_country_global)})")

    # --- Feature matrix ---
    n = len(df)
    skill_matrix = np.zeros((n, len(skill_ids)), dtype=np.float32)
    for i, skill_set in enumerate(df["skill_set"]):
        for sid in skill_set:
            if sid in skill_to_idx:
                skill_matrix[i, skill_to_idx[sid]] = 1.0

    extra = df[["te_title", "te_title_exp", "te_title_country",
                "experience", "country", "remote_ratio",
                "company_size", "work_year"]].values.astype(np.float32)

    X = np.column_stack([skill_matrix, extra])
    y = df["bracket"].values

    feature_names = (
        [f"skill_{sid}" for sid in skill_ids]
        + ["te_title", "te_title_exp", "te_title_country",
           "experience", "country", "remote_ratio",
           "company_size", "work_year"]
    )
    extra_start = len(skill_ids)
    print(f"Feature matrix: {X.shape}")

    # --- Split ---
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}\n")

    # --- Train ---
    model = xgb.XGBClassifier(
        n_estimators=800,
        max_depth=8,
        learning_rate=0.03,
        subsample=0.85,
        colsample_bytree=0.6,
        reg_alpha=0.05,
        reg_lambda=0.5,
        min_child_weight=3,
        gamma=0.1,
        num_class=4,
        objective="multi:softprob",
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
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

    n_classes = len(BRACKETS)
    sv_arr = np.array(shap_values)
    if sv_arr.ndim == 3:
        if sv_arr.shape[0] == n_classes:
            pass
        elif sv_arr.shape[2] == n_classes:
            sv_arr = sv_arr.transpose(2, 0, 1)

    mean_abs_shap = np.zeros(X.shape[1])
    for cls in range(n_classes):
        mean_abs_shap += np.abs(sv_arr[cls]).mean(axis=0)
    mean_abs_shap /= n_classes

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

    extra_names = ["te_title", "te_title_exp", "te_title_country",
                   "experience", "country", "remote_ratio", "company_size", "work_year"]
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

    # Build lookups for prediction time
    occ_to_titles = {}
    for title, occ_id in title_to_occ.items():
        occ_to_titles.setdefault(occ_id, []).append(title)

    predictions = {}
    for occ_id in set(title_to_occ.values()):
        if occ_id not in occ_map:
            continue
        occ = occ_map[occ_id]
        full_vector = np.zeros(len(skill_ids), dtype=np.float32)
        for sid in occ["requiredSkills"]:
            if sid in skill_to_idx:
                full_vector[skill_to_idx[sid]] = 1.0

        titles_for_occ = occ_to_titles.get(occ_id, [])
        te_t = np.mean([te_title_global.get(t, global_mean) for t in titles_for_occ]) if titles_for_occ else global_mean

        occ_preds = {}
        for exp_val, exp_name in enumerate(exp_names_list):
            for country_code in top_countries:
                country_val = country_encoder.transform([country_code])[0]

                # Compute target encodings for this combo
                te_te_vals = [te_title_exp_global.get(f"{t}_{exp_val}", global_mean) for t in titles_for_occ]
                te_te = np.mean(te_te_vals) if te_te_vals else global_mean

                te_tc_vals = [te_title_country_global.get(f"{t}_{country_code}", global_mean) for t in titles_for_occ]
                te_tc = np.mean(te_tc_vals) if te_tc_vals else global_mean

                x = np.concatenate([
                    full_vector,
                    [te_t, te_te, te_tc, exp_val, country_val, 0, 1, 2025]
                ]).reshape(1, -1).astype(np.float32)

                proba = model.predict_proba(x)[0]
                pred_class = int(np.argmax(proba))

                sv_raw = np.array(explainer.shap_values(x))
                if sv_raw.ndim == 3 and sv_raw.shape[0] == n_classes:
                    sv_pred = sv_raw[pred_class][0]
                elif sv_raw.ndim == 3 and sv_raw.shape[2] == n_classes:
                    sv_pred = sv_raw[0, :, pred_class]
                else:
                    sv_pred = sv_raw[0]

                contribs = []
                for i, sid in enumerate(skill_ids):
                    if sid in set(occ["requiredSkills"]) and abs(sv_pred[i]) > 0.003:
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
                    "experienceEffect": round(float(sv_pred[extra_start + 3]), 4),
                    "countryEffect": round(float(sv_pred[extra_start + 4]), 4),
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
        "experienceShap": round(float(mean_abs_shap[extra_start + 3]), 4),
        "countryShap": round(float(mean_abs_shap[extra_start + 4]), 4),
        "skills": skill_importance,
    }
    with open(os.path.join(OUT, "shap.json"), "w", encoding="utf-8") as f:
        json.dump(shap_data, f, ensure_ascii=False)

    with open(os.path.join(OUT, "predictions.json"), "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False)

    model.save_model(os.path.join(OUT, "model.json"))

    # --- Sanity checks ---
    print(f"\n--- Sanity Checks ---")
    # Executive US should be in top 2 brackets
    top2_ex = sum(1 for p in predictions.values() if p.get("executive_US", {}).get("predictedBracket", 0) >= 2)
    total = len(predictions)
    print(f"Executive US in Competitive/Top: {top2_ex}/{total} ({100*top2_ex/total:.0f}%)")

    # Entry India should be in bottom 2 brackets
    bot2_en = sum(1 for p in predictions.values() if p.get("entry_IN", {}).get("predictedBracket", 0) <= 1)
    print(f"Entry India in Entry/Mid: {bot2_en}/{total} ({100*bot2_en/total:.0f}%)")

    # Senior US should mostly be bracket 2+
    top2_sr = sum(1 for p in predictions.values() if p.get("senior_US", {}).get("predictedBracket", 0) >= 2)
    print(f"Senior US in Competitive/Top: {top2_sr}/{total} ({100*top2_sr/total:.0f}%)")

    # Senior > Entry for same role
    pass_count = 0
    for occ_id, preds_occ in predictions.items():
        e = preds_occ.get("entry_US", {}).get("predictedBracket", -1)
        s = preds_occ.get("senior_US", {}).get("predictedBracket", -1)
        if s >= e: pass_count += 1
    print(f"Senior US >= Entry US: {pass_count}/{total} ({100*pass_count/total:.0f}%)")

    print(f"\nDone! Accuracy={acc:.4f}, F1={f1:.4f}")


if __name__ == "__main__":
    main()
