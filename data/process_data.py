"""
SkillBridge MVP — Data Processing Pipeline

Reads raw CSVs (ESCO, ai-jobs.net salaries, Coursera courses)
and produces JSON files for /public/data/.

Run: python data/process_data.py
"""

import csv
import json
import os
import re
import ast
from collections import defaultdict

RAW = os.path.join(os.path.dirname(__file__), "raw")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data")

os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. ESCO: Occupations, Skills, and Relations
# ---------------------------------------------------------------------------

def process_esco():
    print("Processing ESCO data...")

    # --- Read occupation-skill relations to find which occupations/skills are actually used ---
    relations = []
    occ_skill_map = defaultdict(lambda: {"essential": [], "optional": []})
    skill_occ_count = defaultdict(int)

    with open(os.path.join(RAW, "esco", "occupationSkillRelations_en.csv"), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            occ_uri = row["occupationUri"]
            skill_uri = row["skillUri"]
            rel_type = row["relationType"]  # essential or optional
            occ_skill_map[occ_uri][rel_type].append(skill_uri)
            skill_occ_count[skill_uri] += 1
            relations.append(row)

    print(f"  Relations: {len(relations)}")

    # --- Read occupations ---
    occupations_raw = {}
    with open(os.path.join(RAW, "esco", "occupations_en.csv"), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            uri = row["conceptUri"]
            occupations_raw[uri] = {
                "title": row["preferredLabel"],
                "description": row.get("description", ""),
                "iscoGroup": row.get("iscoGroup", ""),
                "altLabels": row.get("altLabels", ""),
            }

    print(f"  Occupations total: {len(occupations_raw)}")

    # --- Read skills ---
    skills_raw = {}
    with open(os.path.join(RAW, "esco", "skills_en.csv"), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            uri = row["conceptUri"]
            skills_raw[uri] = {
                "name": row["preferredLabel"],
                "type": row.get("skillType", ""),
                "reuseLevel": row.get("reuseLevel", ""),
            }

    print(f"  Skills total: {len(skills_raw)}")

    # --- Filter to occupations that have salary data matches (done later) ---
    # For now, keep all occupations that have at least some skill relations
    # We'll filter down after salary mapping

    # Build occupation list with skill IDs
    occupations = []
    for uri, info in occupations_raw.items():
        if uri not in occ_skill_map:
            continue
        essential = occ_skill_map[uri]["essential"]
        optional = occ_skill_map[uri]["optional"]
        if not essential and not optional:
            continue
        occupations.append({
            "id": uri.split("/")[-1],  # short UUID from URI
            "uri": uri,
            "title": info["title"],
            "description": info["description"][:200] if info["description"] else "",
            "iscoGroup": info["iscoGroup"],
            "altLabels": [l.strip() for l in info["altLabels"].split("\n") if l.strip()][:5],
            "requiredSkills": [s.split("/")[-1] for s in essential],
            "optionalSkills": [s.split("/")[-1] for s in optional],
        })

    print(f"  Occupations with skills: {len(occupations)}")

    # Build skill list (only skills that appear in at least one occupation)
    used_skill_uris = set()
    for uri in occ_skill_map:
        for s in occ_skill_map[uri]["essential"] + occ_skill_map[uri]["optional"]:
            used_skill_uris.add(s)

    skills = []
    for uri in used_skill_uris:
        if uri not in skills_raw:
            continue
        info = skills_raw[uri]
        skills.append({
            "id": uri.split("/")[-1],
            "uri": uri,
            "name": info["name"],
            "category": info["type"],  # "skill/competence" or "knowledge"
            "reuseLevel": info["reuseLevel"],
            "occupationCount": skill_occ_count.get(uri, 0),
        })

    # Sort skills by how many occupations use them (most versatile first)
    skills.sort(key=lambda s: s["occupationCount"], reverse=True)
    print(f"  Skills used in occupations: {len(skills)}")

    return occupations, skills


# ---------------------------------------------------------------------------
# 2. Salary data (ai-jobs.net)
# ---------------------------------------------------------------------------

def process_salaries():
    print("Processing salary data...")

    EXP_MAP = {"EN": "entry", "MI": "mid", "SE": "senior", "EX": "executive"}

    # Group by job_title + experience_level
    groups = defaultdict(list)
    title_counts = defaultdict(int)

    with open(os.path.join(RAW, "salaries.csv"), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            title = row["job_title"]
            exp = row["experience_level"]
            salary = float(row["salary_in_usd"])
            country = row["company_location"]
            year = int(row["work_year"])
            title_counts[title] += 1
            groups[(title, exp)].append({
                "salary": salary,
                "country": country,
                "year": year,
            })

    # Compute stats per title + experience level
    salaries = []
    for (title, exp), rows in groups.items():
        if len(rows) < 3:  # need minimum sample
            continue
        vals = sorted([r["salary"] for r in rows])
        n = len(vals)
        salaries.append({
            "jobTitle": title,
            "experienceLevel": EXP_MAP.get(exp, exp),
            "median": int(vals[n // 2]),
            "p25": int(vals[n // 4]),
            "p75": int(vals[3 * n // 4]),
            "currency": "USD",
            "sampleSize": n,
        })

    salaries.sort(key=lambda s: s["sampleSize"], reverse=True)
    print(f"  Salary stat rows: {len(salaries)}")
    print(f"  Unique job titles with stats: {len(set(s['jobTitle'] for s in salaries))}")

    # --- Demand proxy: row counts per title per year ---
    demand = []
    year_title_counts = defaultdict(lambda: defaultdict(int))
    for (title, exp), rows in groups.items():
        for r in rows:
            year_title_counts[title][r["year"]] += 1

    for title, year_data in year_title_counts.items():
        if title_counts[title] < 10:
            continue
        for year, count in sorted(year_data.items()):
            demand.append({
                "jobTitle": title,
                "year": year,
                "postings": count,
            })

    demand.sort(key=lambda d: (d["jobTitle"], d["year"]))
    print(f"  Demand data points: {len(demand)}")

    return salaries, demand


# ---------------------------------------------------------------------------
# 3. Map salary job titles to ESCO occupations
# ---------------------------------------------------------------------------

def build_title_mapping(occupations, salaries):
    """
    Fuzzy-ish match between ai-jobs.net job titles and ESCO occupation titles.
    Uses lowercased substring matching + alt labels.
    """
    print("Mapping salary titles to ESCO occupations...")

    salary_titles = set(s["jobTitle"] for s in salaries)

    # Build lookup: lowered title/altlabel -> occupation
    occ_lookup = {}
    for occ in occupations:
        key = occ["title"].lower().strip()
        occ_lookup[key] = occ["id"]
        for alt in occ.get("altLabels", []):
            occ_lookup[alt.lower().strip()] = occ["id"]

    mapping = {}
    for title in salary_titles:
        t = title.lower().strip()
        # Exact match
        if t in occ_lookup:
            mapping[title] = occ_lookup[t]
            continue
        # Try common normalizations
        for occ_title, occ_id in occ_lookup.items():
            if t in occ_title or occ_title in t:
                mapping[title] = occ_id
                break

    print(f"  Mapped {len(mapping)}/{len(salary_titles)} salary titles to ESCO occupations")

    # Add occupationId to salary records where we have a match
    for s in salaries:
        s["occupationId"] = mapping.get(s["jobTitle"], "")

    return mapping


# ---------------------------------------------------------------------------
# 4. Coursera courses
# ---------------------------------------------------------------------------

def process_courses(skills):
    print("Processing Coursera courses...")

    skill_name_to_id = {}
    for s in skills:
        skill_name_to_id[s["name"].lower()] = s["id"]

    courses = []
    matched_skills_total = 0

    # Try Rustamov dataset first, fall back to old format
    rustamov_path = os.path.join(RAW, "coursera_rustamov", "CourseraDataset-Clean.csv")
    old_path = os.path.join(RAW, "coursera_courses.csv")
    csv_path = rustamov_path if os.path.exists(rustamov_path) else old_path
    is_rustamov = csv_path == rustamov_path
    print(f"  Using: {'Rustamov (Kaggle, CC0)' if is_rustamov else 'azrai99 (HuggingFace)'}")

    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if is_rustamov:
                raw_skills = row.get("Skill gain", "").strip()
                title = row.get("Course Title", "").strip()
                url = row.get("Course Url", "").strip()
                rating = row.get("Rating", "")
                schedule = row.get("Duration to complete (Approx.)", "").strip()
                org = row.get("Offered By", "").strip()
                level = row.get("Level", "").strip()
                # Rustamov format: comma-separated skills
                if raw_skills and raw_skills.lower() != "not specified":
                    skill_list = [s.strip() for s in raw_skills.split(",") if s.strip()]
                else:
                    skill_list = []
            else:
                raw_skills = row.get("Skills", "[]").strip()
                title = row.get("title", "").strip()
                url = row.get("URL", "").strip()
                rating = row.get("rating", "")
                schedule = row.get("Schedule", "").strip()
                org = row.get("Organization", "").strip()
                level = row.get("Level", "").strip()
                try:
                    skill_list = ast.literal_eval(raw_skills) if raw_skills and raw_skills != "[]" else []
                except:
                    skill_list = []
                if not isinstance(skill_list, list):
                    skill_list = []

            if not title or not url:
                continue

            # Map Coursera skill names to ESCO skill IDs
            mapped_ids = []
            for cs in skill_list:
                cs_lower = cs.lower().strip()
                if cs_lower in skill_name_to_id:
                    mapped_ids.append(skill_name_to_id[cs_lower])
                else:
                    # Try partial match
                    for esco_name, esco_id in skill_name_to_id.items():
                        if cs_lower in esco_name or esco_name in cs_lower:
                            mapped_ids.append(esco_id)
                            break

            matched_skills_total += len(mapped_ids)

            try:
                rating_val = float(rating)
            except:
                rating_val = 0

            # Duration: Rustamov has hours as float, format nicely
            if is_rustamov and schedule:
                try:
                    hours = float(schedule)
                    schedule = f"{int(hours)} hours" if hours == int(hours) else f"{hours:.0f} hours"
                except:
                    pass

            courses.append({
                "id": f"coursera-{len(courses)}",
                "title": title,
                "platform": "Coursera",
                "organization": org,
                "url": url,
                "duration": schedule,
                "rating": rating_val,
                "level": level,
                "skillIds": mapped_ids,
                "skillNames": skill_list[:10],
            })

    # Keep only courses that have at least one mapped skill OR have a rating >= 4.0
    courses_with_skills = [c for c in courses if c["skillIds"]]
    courses_popular = [c for c in courses if not c["skillIds"] and c["rating"] >= 4.5]

    final = courses_with_skills + courses_popular[:200]  # cap unmatched
    final.sort(key=lambda c: c["rating"], reverse=True)

    print(f"  Total courses parsed: {len(courses)}")
    print(f"  Courses with ESCO skill matches: {len(courses_with_skills)}")
    print(f"  Total mapped skill links: {matched_skills_total}")

    return final


# ---------------------------------------------------------------------------
# 5. Write output JSONs
# ---------------------------------------------------------------------------

def write_json(filename, data):
    path = os.path.join(OUT, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"  Wrote {filename}: {len(data)} items, {size_mb:.1f} MB")


def main():
    occupations, skills = process_esco()
    salaries, demand = process_salaries()
    title_mapping = build_title_mapping(occupations, salaries)

    # Filter occupations to only those relevant (have salary data OR are in tech/data domain)
    tech_isco_prefixes = ["25", "21", "13", "24", "35"]  # ICT, science, management, business, technicians
    relevant_occupations = [
        o for o in occupations
        if o["id"] in set(title_mapping.values())
        or any(o["iscoGroup"].startswith(p) for p in tech_isco_prefixes)
    ]
    print(f"Filtered to {len(relevant_occupations)} relevant occupations")

    courses = process_courses(skills)

    # Write all JSONs
    print("\nWriting output files...")
    write_json("occupations.json", relevant_occupations)
    write_json("skills.json", skills)
    write_json("salaries.json", salaries)
    write_json("courses.json", courses)
    write_json("demand.json", demand)

    # Write a small metadata file
    meta = {
        "generatedAt": "2026-04-05",
        "sources": {
            "esco": "v1.2.1 (European Commission)",
            "salaries": "ai-jobs.net (CC0)",
            "courses": "Coursera Courses 2024 (Apache 2.0)",
            "demand": "Derived from ai-jobs.net posting counts",
        },
        "counts": {
            "occupations": len(relevant_occupations),
            "skills": len(skills),
            "salaryRows": len(salaries),
            "courses": len(courses),
            "demandPoints": len(demand),
        }
    }
    write_json("meta.json", meta)

    total_size = sum(
        os.path.getsize(os.path.join(OUT, f))
        for f in os.listdir(OUT) if f.endswith(".json")
    ) / (1024 * 1024)
    print(f"\nTotal JSON size: {total_size:.1f} MB")
    print("Done!")


if __name__ == "__main__":
    main()
