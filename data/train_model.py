"""
SkillBridge MVP — XGBoost Salary Prediction Model

Trains a model: skill_vector + experience + country → salary
Exports: model JSON, SHAP values, and pre-computed predictions for browser use.

Principles applied:
- Stratified train/test split
- Sample weighting to balance underrepresented groups
- SHAP for full interpretability
- Honest evaluation metrics
"""

import json
import os
import numpy as np
import pandas as pd
from collections import defaultdict
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb
import shap

RAW = os.path.join(os.path.dirname(__file__), "raw")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data")


def load_data():
    """Load and join salary data with ESCO skill vectors."""
    print("Loading data...")

    # Load salary data
    salaries = pd.read_csv(os.path.join(RAW, "salaries.csv"))
    print(f"  Raw salary rows: {len(salaries)}")

    # Load ESCO mappings
    with open(os.path.join(OUT, "occupations.json"), encoding="utf-8") as f:
        occupations = json.load(f)
    with open(os.path.join(OUT, "skills.json"), encoding="utf-8") as f:
        skills = json.load(f)

    # Build title → occupation mapping from salary JSON
    with open(os.path.join(OUT, "salaries.json"), encoding="utf-8") as f:
        salary_json = json.load(f)

    title_to_occ = {}
    for s in salary_json:
        if s.get("occupationId"):
            title_to_occ[s["jobTitle"]] = s["occupationId"]

    occ_map = {o["id"]: o for o in occupations}

    return salaries, title_to_occ, occ_map, skills


def build_features(salaries, title_to_occ, occ_map, skills):
    """Build feature matrix: binary skill vector + experience + country."""
    print("Building features...")

    # Get all skills that appear in mapped occupations
    relevant_skill_ids = set()
    for occ_id in set(title_to_occ.values()):
        if occ_id in occ_map:
            relevant_skill_ids.update(occ_map[occ_id]["requiredSkills"])

    # Sort for consistent column order
    skill_ids = sorted(relevant_skill_ids)
    skill_to_idx = {sid: i for i, sid in enumerate(skill_ids)}
    print(f"  Skill features: {len(skill_ids)}")

    # Build skill name lookup
    skill_name_map = {s["id"]: s["name"] for s in skills}

    # Experience encoding
    exp_map = {"EN": 0, "MI": 1, "SE": 2, "EX": 3}

    # Filter salaries to rows we can map
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
        if salary <= 0 or salary > 1_000_000:  # sanity filter
            continue

        country = row["company_location"]
        occ_skills = set(occ_map[occ_id]["requiredSkills"])

        rows.append({
            "salary": salary,
            "experience": exp_val,
            "country": country,
            "occ_id": occ_id,
            "title": title,
            "skill_set": occ_skills,
        })

    df = pd.DataFrame(rows)
    print(f"  Rows with ESCO mapping: {len(df)}")

    # --- Data balancing via sample weights ---
    # Weight inversely proportional to (title × experience) group size
    group_counts = df.groupby(["title", "experience"]).size()
    median_count = group_counts.median()
    df["group_key"] = df["title"] + "_" + df["experience"].astype(str)
    group_count_map = df["group_key"].value_counts().to_dict()
    df["sample_weight"] = df["group_key"].map(
        lambda k: min(median_count / group_count_map[k], 3.0)  # cap at 3x
    )
    print(f"  Weight range: {df['sample_weight'].min():.2f} - {df['sample_weight'].max():.2f}")

    # Also clip salary outliers (1st and 99th percentile)
    p1, p99 = df["salary"].quantile(0.01), df["salary"].quantile(0.99)
    before = len(df)
    df = df[(df["salary"] >= p1) & (df["salary"] <= p99)]
    print(f"  Clipped {before - len(df)} outliers ({p1:.0f} - {p99:.0f})")

    # Encode country
    country_encoder = LabelEncoder()
    df["country_encoded"] = country_encoder.fit_transform(df["country"])

    # Build binary skill matrix
    skill_matrix = np.zeros((len(df), len(skill_ids)), dtype=np.float32)
    for i, skill_set in enumerate(df["skill_set"]):
        for sid in skill_set:
            if sid in skill_to_idx:
                skill_matrix[i, skill_to_idx[sid]] = 1.0

    # Combine features
    X = np.column_stack([
        skill_matrix,
        df["experience"].values.reshape(-1, 1),
        df["country_encoded"].values.reshape(-1, 1),
    ])

    feature_names = (
        [f"skill_{sid}" for sid in skill_ids]
        + ["experience"]
        + ["country"]
    )

    y = df["salary"].values
    weights = df["sample_weight"].values

    print(f"  Final feature matrix: {X.shape}")
    print(f"  Target mean: ${y.mean():,.0f}, median: ${np.median(y):,.0f}")

    return X, y, weights, feature_names, skill_ids, skill_name_map, country_encoder, df


def train_model(X, y, weights, feature_names, df):
    """Train XGBoost with stratified split and sample weights."""
    print("\nTraining XGBoost...")

    # Stratified split by title + experience
    stratify_key = df["group_key"].values
    # Handle groups with only 1 member
    key_counts = pd.Series(stratify_key).value_counts()
    small_groups = set(key_counts[key_counts < 2].index)
    stratify_safe = np.array([
        k if k not in small_groups else "__other__" for k in stratify_key
    ])

    X_train, X_test, y_train, y_test, w_train, w_test, idx_train, idx_test = (
        train_test_split(
            X, y, weights, np.arange(len(y)),
            test_size=0.2,
            random_state=42,
            stratify=stratify_safe,
        )
    )

    print(f"  Train: {len(X_train)}, Test: {len(X_test)}")

    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        X_train, y_train,
        sample_weight=w_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    # Evaluation
    from sklearn.metrics import r2_score, mean_absolute_error, mean_absolute_percentage_error

    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)
    mae_test = mean_absolute_error(y_test, y_pred_test)
    mape_test = mean_absolute_percentage_error(y_test, y_pred_test)

    print(f"\n  R2 train: {r2_train:.4f}")
    print(f"  R2 test:  {r2_test:.4f}")
    print(f"  MAE test: ${mae_test:,.0f}")
    print(f"  MAPE test: {mape_test:.1%}")

    if r2_test < 0.3:
        print("\n  WARNING: R2 < 0.3 — model may not be reliable enough.")
        print("  Will still export, but document this limitation.")

    return model, X_train, X_test, y_test, y_pred_test, idx_test


def compute_shap(model, X_train, feature_names, skill_ids, skill_name_map):
    """Compute SHAP values for interpretability."""
    print("\nComputing SHAP values...")

    explainer = shap.TreeExplainer(model)

    # Use a subsample for speed
    sample_size = min(2000, len(X_train))
    np.random.seed(42)
    sample_idx = np.random.choice(len(X_train), sample_size, replace=False)
    X_sample = X_train[sample_idx]

    shap_values = explainer.shap_values(X_sample)

    # Global mean absolute SHAP per feature
    mean_abs_shap = np.abs(shap_values).mean(axis=0)

    # Build skill importance dict (only skills, not experience/country)
    skill_importance = {}
    for i, sid in enumerate(skill_ids):
        name = skill_name_map.get(sid, sid)
        importance = float(mean_abs_shap[i])
        if importance > 0:
            skill_importance[sid] = {
                "name": name,
                "shapMean": round(importance, 2),
                "shapDirection": float(np.mean(shap_values[:, i])),  # positive = increases salary
            }

    # Sort by impact
    skill_importance = dict(
        sorted(skill_importance.items(), key=lambda x: x[1]["shapMean"], reverse=True)
    )

    # Experience and country SHAP
    exp_idx = len(skill_ids)
    country_idx = len(skill_ids) + 1
    exp_shap = float(mean_abs_shap[exp_idx])
    country_shap = float(mean_abs_shap[country_idx])

    print(f"  Top 10 skills by SHAP impact:")
    for i, (sid, info) in enumerate(list(skill_importance.items())[:10]):
        direction = "+" if info["shapDirection"] > 0 else "-"
        print(f"    {i+1}. {info['name']}: ${info['shapMean']:,.0f} ({direction})")
    print(f"  Experience SHAP: ${exp_shap:,.0f}")
    print(f"  Country SHAP: ${country_shap:,.0f}")

    # Base value (expected salary)
    base_value = float(explainer.expected_value)
    print(f"  Base value (avg prediction): ${base_value:,.0f}")

    return skill_importance, exp_shap, country_shap, base_value, explainer


def compute_prediction_explanations(
    model, explainer, occ_map, skill_ids, skill_to_idx,
    skill_name_map, country_encoder, title_to_occ
):
    """
    Pre-compute explained predictions for each occupation × experience × country combo.
    This powers the "why this salary?" breakdown in the browser.
    """
    print("\nPre-computing predictions with explanations...")

    exp_levels = [0, 1, 2, 3]
    exp_names = ["entry", "mid", "senior", "executive"]

    # Top countries by data volume
    top_countries = ["US", "GB", "DE", "CA", "FR", "ES", "IN", "NL", "AU", "BR"]
    available_countries = list(country_encoder.classes_)
    top_countries = [c for c in top_countries if c in available_countries]

    predictions = {}
    occ_ids_with_salary = set(title_to_occ.values())

    skill_to_idx_local = {sid: i for i, sid in enumerate(skill_ids)}

    for occ_id in occ_ids_with_salary:
        if occ_id not in occ_map:
            continue

        occ = occ_map[occ_id]
        occ_skills = set(occ["requiredSkills"])

        # Build full skill vector for this occupation
        full_vector = np.zeros(len(skill_ids), dtype=np.float32)
        for sid in occ_skills:
            if sid in skill_to_idx_local:
                full_vector[skill_to_idx_local[sid]] = 1.0

        occ_preds = {}
        for exp_val, exp_name in zip(exp_levels, exp_names):
            for country in top_countries:
                country_val = country_encoder.transform([country])[0]

                # Full skills prediction
                x_full = np.concatenate([full_vector, [exp_val, country_val]]).reshape(1, -1)
                pred_full = float(model.predict(x_full)[0])

                # SHAP explanation for full prediction
                shap_vals = explainer.shap_values(x_full)[0]

                # Top contributing skills
                skill_contribs = []
                for i, sid in enumerate(skill_ids):
                    if sid in occ_skills and abs(shap_vals[i]) > 50:
                        skill_contribs.append({
                            "skillId": sid,
                            "name": skill_name_map.get(sid, sid),
                            "contribution": round(float(shap_vals[i]), 0),
                        })

                skill_contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)

                key = f"{exp_name}_{country}"
                occ_preds[key] = {
                    "predicted": round(pred_full, 0),
                    "experienceEffect": round(float(shap_vals[len(skill_ids)]), 0),
                    "countryEffect": round(float(shap_vals[len(skill_ids) + 1]), 0),
                    "topSkillContributions": skill_contribs[:10],
                }

        predictions[occ_id] = occ_preds

    print(f"  Pre-computed predictions for {len(predictions)} occupations")
    return predictions


def export(
    model, skill_importance, exp_shap, country_shap, base_value,
    predictions, skill_ids, skill_name_map, r2_test, feature_names
):
    """Export everything as JSON for the browser."""
    print("\nExporting...")

    # 1. SHAP importance per skill
    shap_data = {
        "baseValue": round(base_value, 0),
        "experienceShap": round(exp_shap, 0),
        "countryShap": round(country_shap, 0),
        "skills": skill_importance,
        "modelR2": round(r2_test, 4),
    }

    with open(os.path.join(OUT, "shap.json"), "w", encoding="utf-8") as f:
        json.dump(shap_data, f, ensure_ascii=False)
    print(f"  shap.json: {len(skill_importance)} skills with SHAP values")

    # 2. Pre-computed predictions
    with open(os.path.join(OUT, "predictions.json"), "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False)
    size_mb = os.path.getsize(os.path.join(OUT, "predictions.json")) / (1024 * 1024)
    print(f"  predictions.json: {size_mb:.1f} MB")

    # 3. Model as JSON (for potential future browser inference)
    model.save_model(os.path.join(OUT, "model.json"))
    size_mb = os.path.getsize(os.path.join(OUT, "model.json")) / (1024 * 1024)
    print(f"  model.json: {size_mb:.1f} MB")

    # 4. Feature metadata
    feature_meta = {
        "skillIds": skill_ids,
        "skillNames": {sid: skill_name_map.get(sid, sid) for sid in skill_ids},
        "featureOrder": feature_names,
    }
    with open(os.path.join(OUT, "model_meta.json"), "w", encoding="utf-8") as f:
        json.dump(feature_meta, f, ensure_ascii=False)
    print(f"  model_meta.json written")


def main():
    salaries, title_to_occ, occ_map, skills = load_data()
    X, y, weights, feature_names, skill_ids, skill_name_map, country_encoder, df = (
        build_features(salaries, title_to_occ, occ_map, skills)
    )

    skill_to_idx = {sid: i for i, sid in enumerate(skill_ids)}

    model, X_train, X_test, y_test, y_pred_test, idx_test = (
        train_model(X, y, weights, feature_names, df)
    )

    from sklearn.metrics import r2_score
    r2_test = r2_score(y_test, y_pred_test)

    skill_importance, exp_shap, country_shap, base_value, explainer = (
        compute_shap(model, X_train, feature_names, skill_ids, skill_name_map)
    )

    predictions = compute_prediction_explanations(
        model, explainer, occ_map, skill_ids, skill_to_idx,
        skill_name_map, country_encoder, title_to_occ,
    )

    export(
        model, skill_importance, exp_shap, country_shap, base_value,
        predictions, skill_ids, skill_name_map, r2_test, feature_names,
    )

    print("\nDone! Model training and export complete.")
    print(f"R2 = {r2_test:.4f} — {'Good enough for MVP' if r2_test > 0.3 else 'Weak — document as limitation'}")


if __name__ == "__main__":
    main()
