# SkillBridge — MVP Concept

## What it is
A web app that helps people figure out what skills they're missing for a career they want, how much those skills are worth in salary terms, and where to learn them. It combines EU labor market data, salary intelligence, and course catalogs into one interface that gives personalized, actionable guidance.

## The problem it solves
Someone wants to switch careers or re-enter the workforce. They know what they can do but they don't know what the market wants, which skills matter most, what to learn first, or what salary to realistically expect. Right now they'd have to manually cross-reference job listings, course platforms, and salary surveys. SkillBridge does that in one place using real data.

## Who it's for
Unemployed adults, career changers, older workers re-entering the workforce, anyone trying to understand where they stand relative to the job market and what to do about it. Aligns with SDG 4 (Quality Education) and SDG 8 (Decent Work and Economic Growth).

## How it works

### User inputs
- Their current skills (selected from a searchable list based on ESCO taxonomy)
- A target occupation they're interested in
- Their country
- Their experience level

### What the app returns

**Skill gap analysis**
Shows which skills the user already has vs what the target occupation requires. Clear visual: green for matched, red for missing. Powered by ESCO occupation-skill mappings (EU standard taxonomy covering ~3,000 occupations and ~13,000 skills).

**Salary insight**
Shows what people in that role typically earn, broken down by experience level and country. If the ML model is integrated: predicts the user's earning potential based on their specific skill combination, both now and after closing the gaps.

**Prioritized learning path**
Not just "here are your missing skills" but "learn these in this order." Priority is driven by data, either SHAP-based salary impact (if ML is integrated) or demand/shortage signals from OECD data. The skill that adds the most value to the user's profile comes first.

**Course recommendations**
For each missing skill, concrete course suggestions with title, platform, duration, and link. Sourced from real Coursera catalog data mapped to ESCO skills.

**Demand trends**
Is this occupation growing or shrinking? Based on Eurostat vacancy data or OECD shortage indicators. Helps the user avoid investing in a declining field.

## Data sources
- **ESCO v1.2.1** — EU taxonomy of occupations and skills (European Commission, free, CSV)
- **ai-jobs.net** — real salary survey data (CC0 license, weekly updated)
- **Coursera courses dataset** — ~6,650 courses with skill tags (Kaggle, Apache 2.0)
- **OECD Skills for Jobs / Eurostat** — demand and shortage indicators per occupation
- All sources are free, open, and citable in an academic context

## ML component (if integrated)
XGBoost model trained on salary data enriched with ESCO skill features. Predicts salary based on skill combination + experience + country. SHAP values explain why each skill matters and by how much, powering the priority ranking. Model runs client-side via a lightweight JS tree walker over the exported model JSON. No server-side Python needed.

## Tech stack
- Next.js (React) frontend
- All data served as static JSON files (no database)
- Deployed on Vercel (free tier)
- ML inference in browser (no backend dependency)
- Accessible via public URL for professor/peers to test

## What it is NOT
- Not a job board or job matching platform
- Not a full LMS or learning platform
- Not real-time (data is periodically updated, not live)
- Not production-ready (MVP scope, limited to tech/data occupations in current salary data)
- Not a replacement for career counseling (a tool for self-guided exploration)

## Scope limitations (stated honestly)
- Salary predictions only work for tech/AI/data roles due to available training data
- Course recommendations cover Coursera primarily
- Skill gap analysis relies on ESCO mappings which may not reflect every employer's real requirements
- No user accounts or saved progress in MVP
- These are documented as known limitations and future improvement areas in the report
