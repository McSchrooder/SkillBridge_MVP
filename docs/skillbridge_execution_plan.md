# SkillBridge — Execution Plan

## Approach
Build a working MVP first (Path B), then layer ML on top (Path A) if time allows.
Every step below is a starting assumption, not a commitment. If something takes too long, doesn't work, or a better approach surfaces mid-build, pivot.

---

## Phase 1: Prep

### Get the raw data
- ESCO v1.2.1 English CSV
- ai-jobs.net salary data (GitHub)
- Coursera courses dataset (Kaggle)
- OECD Skills for Jobs (check download format)
- Optionally: tabiya-tech pre-flattened ESCO as fallback

### Inspect and sanity check
- Open each file, verify columns match expectations
- Note row counts, missing values, encoding issues
- If any source is broken or unusable, find alternative before proceeding

### Init project
- Next.js app, push to GitHub, connect Vercel
- Confirm empty deploy works
- *Pivot: if Next.js feels like overkill or rusty, Streamlit is a valid fallback. Faster to build, less pretty, still deployable.*

---

## Phase 2: Data pipeline

### ESCO → occupation-skill lookup
- Join the CSVs on URIs to get human-readable occupation → skills mapping
- Filter to relevant occupations and frequently-used skills
- Export as JSON
- *Pivot: if URI joins are painful, use tabiya pre-flattened data or manually map top 30-50 occupations*

### Salary data → stats per role
- Group ai-jobs.net by job title, compute averages by experience and country
- Map job titles to ESCO occupations (fuzzy match or manual)
- Export as JSON
- *Pivot: if mapping is too lossy (too few matches), just use ai-jobs titles directly as the occupation list instead of ESCO*

### Course data → recommendations per skill
- Filter Coursera dataset to rated courses with skill tags
- Map Coursera skill tags to ESCO skill names
- Export as JSON
- *Pivot: if mapping is poor, manually curate 50-80 courses for top skills. Still valid for MVP.*

### Demand data → trend signals
- Try OECD Skills for Jobs shortage indicators
- If not downloadable: derive from ai-jobs.net row counts per year as proxy
- Export as JSON
- *Pivot: if demand data is too weak, drop this feature from MVP and mention it as future work in report*

### Combine
- All JSONs into /public/data/ in the Next.js project
- Verify total size is reasonable (under 3-5 MB)

---

## Phase 3: Build working MVP (Path B)

### Backend logic
- API routes or client-side functions that read from JSON files:
  - Skill gap: compare user skills vs occupation requirements
  - Salary lookup: return stats for selected role/country/experience
  - Course recommendations: match courses to missing skills
  - Demand trends: return growth data for selected role

### Frontend
- Input: select target occupation, pick current skills, choose country and experience
- Output: skill gap visualization, salary comparison, course cards, demand chart
- Style to roughly match Esmeralda's mockup
- *Pivot: if building a full React frontend is too slow, a single-page app with minimal components is fine. The graders care about functionality, not design perfection.*

### Deploy and share
- Push to Vercel, get live URL
- Test full flow end-to-end
- Share with Esmeralda for feedback
- **At this point the MVP is submittable**

---

## Phase 4: ML upgrade (Path A) — only if Path B is stable

### Feature engineering
- Take salary data, map to ESCO occupations
- Expand each row's skills into binary feature columns
- Add experience level and location as features
- *Pivot: if the resulting dataset has too few rows per skill combination, the model won't learn anything useful. Check this before training.*

### Train XGBoost
- Train regressor: skills + experience + location → salary
- Evaluate R² on test set
- If R² > 0.3: worth integrating
- If R² < 0.3: model is noise, stick with Path B
- Compute global mean SHAP values per skill
- *Pivot: if XGBoost underperforms, try simple linear regression. Coefficients are directly interpretable as "€ per skill" without SHAP.*

### Export for browser
- Save model as JSON, write JS tree walker for inference
- Or fall back to pre-computed lookup table if tree walker is too complex
- Export SHAP values as JSON
- *Pivot: if JS inference is buggy, just pre-compute predictions for all occupation × experience × country combos and serve as static JSON. Loses personalization but works.*

### Integrate
- Update results page with live salary predictions (current skills vs target)
- Add SHAP-based priority ranking to course recommendations
- Add explainability section showing which skills drive salary

---

## Phase 5: Report and submission

### Sync with Esmeralda on section ownership
- Her: problem statement, value proposition, UX design rationale, design thinking
- You: data sources justification, technical architecture, ML approach, ethics
- Both: intro, conclusion

### Ethics section must cover
- Training data bias (tech-only, US-heavy, no gender data)
- Salary model reproducing existing pay gaps
- Transparency via SHAP (ties to EU AI Act Article 13)
- Scope limitations stated honestly in the app

### Submit
- Live URL + report covering all 6 competencies
- Due April 12

---

## General notes

- **Any step can be questioned.** If a data source turns out to be garbage, a feature turns out to be impossible, or a better approach appears, adapt. The plan is a starting direction, not a contract.
- **Scope is negotiable.** A clean app with 3 features that work beats 6 half-broken features. Cut aggressively if needed.
- **Document decisions.** Every pivot, rejection, or compromise is material for the report. "We initially planned X but found Y, so we chose Z" is exactly what the assessors want to read.
- **Ship early, improve later.** A deployed URL with basic functionality on day 1 is worth more than a perfect local prototype on the last day.
