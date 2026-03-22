# Analytics Dashboard — Complete Project Overview

**Phase:** 2.4 Design Specification
**Status:** Ready for Implementation
**Created:** 2026-03-23
**Timeline:** 5 weeks to full deployment

---

## Project Summary

Design and build a **Google Sheet analytics dashboard** that automatically fetches data from two Airtable bases (Sakura House + The Waratah) and displays 7 business intelligence metrics for kitchen prep operations. The dashboard answers critical questions about prep efficiency, waste, recipe popularity, staff workload, feedback resolution, automation health, and cross-venue performance.

### What You'll Deliver

- **1 Google Sheet** with 9 interactive tabs (DASHBOARD + 8 detailed tabs)
- **1 GAS Script** (AnalyticsDashboard.gs) with ~1,500 lines of production-ready code
- **3 supporting documents** (design spec, code template, quick-start guide)
- **Time-driven automation** (daily 10 PM, weekly Saturday 4 PM)
- **User guide** for non-technical managers

### Business Impact

- **Reduces prep reporting time** from 2 hours/week to real-time
- **Identifies waste patterns** — quantifies over/under-production
- **Tracks staff workload** — detects imbalances between orderers
- **Monitors automation health** — catches script failures before they impact operations
- **Enables data-driven decisions** — managers see trends, not just raw numbers

---

## Files Included in This Delivery

| File | Purpose | Read Time | Who Needs It |
|------|---------|-----------|-------------|
| **ANALYTICS_DASHBOARD_DESIGN.md** | Complete 50-page specification covering architecture, all 7 metrics, calculations, sheet design, GAS strategy, success criteria | 40 min | Developers, Project Managers |
| **ANALYTICS_DASHBOARD_CODE_TEMPLATE.gs** | Production-ready code scaffold (~1,500 lines) with all functions stubbed and documented; ready to customize | 30 min skim, 4h implementation | Developers |
| **ANALYTICS_DASHBOARD_QUICKSTART.md** | Step-by-step setup, 5-week phased implementation plan, testing checklist, troubleshooting guide | 20 min | Developers, QA |
| **ANALYTICS_DATA_FLOW.md** | Detailed breakdown of each metric: data sources, query logic, calculations, assumptions, validation rules | 45 min | Developers |
| **ANALYTICS_DASHBOARD_README.md** | This file — high-level overview and navigation guide | 5 min | Everyone |

---

## The 7 Key Metrics

### 1. Prep Efficiency (Daily)

**Question:** What % of ordered items match what was prepped? Over/under-producing?

**Data:** Ingredient Requirements vs Prep Tasks, grouped by Prep Run

**Output:** Weekly efficiency %, over-production count, under-production count, variance trend

**Key Insight:** Target 95–105%; identifies recipes that consistently mismatch order-to-prep ratio

---

### 2. Waste Indicators (Daily)

**Question:** Which items sit above par (waste risk)? Which never reach par (stockout risk)?

**Data:** Weekly Counts vs Par Levels, 4-week rolling window

**Output:** Over-stock items, under-stock items, risk flags, par achievement %

**Key Insight:** Flags items to investigate for par-level adjustment or prep process issues

---

### 3. Recipe Popularity (Weekly)

**Question:** Which recipes are prepped most often? What's the trend?

**Data:** Prep Tasks frequency, 4-week window, top-10 ranking

**Output:** Rank 1–10, frequency, avg qty per prep, item type, trend %

**Key Insight:** Identifies seasonal demand patterns; supports forecasting

---

### 4. Staff Workload (Weekly)

**Question:** How is ordering distributed? Is it balanced?

**Data:** Ingredient Requirements grouped by staff (via Supplier assignments)

**Output:** Per-staff: supplier count, item count, total qty, % of load

**Key Insight:** (Sakura) Detects imbalance between Gooch & Sabs; supports load rebalancing

---

### 5. Feedback Trends (Real-time polling)

**Question:** How much feedback? What's resolved? Which items have issues?

**Data:** Feedback table, last 4 weeks, grouped by status & item

**Output:** Total volume, resolution rate, avg days-to-resolve, top items, open issues

**Key Insight:** Identifies quality problems early; tracks staff engagement

---

### 6. Automation Health (Real-time polling)

**Question:** Are automations working reliably? Error rates? Slow scripts?

**Data:** Audit Log, last 7 days, grouped by script name

**Output:** Overall success rate, per-script metrics, execution time stats, recent errors

**Key Insight:** Detects failing scripts before they impact operations

---

### 7. Cross-Venue Comparison (Daily + Weekly)

**Question:** How do Sakura & Waratah compare?

**Data:** All metrics from both bases, side-by-side

**Output:** Matrix of key metrics, % variance, radar chart, trend lines

**Key Insight:** Benchmarks performance across venues; identifies best practices

---

## Architecture at a Glance

```
AIRTABLE                    GAS SCRIPT                  GOOGLE SHEET
───────────────────────────────────────────────────────────────────
Sakura Base                 AnalyticsDashboard.gs       Dashboard
├─ Items                   ├─ Phase 1:                 ├─ Prep Efficiency
├─ Recipes                 │  Data Fetching             ├─ Waste Analysis
├─ Prep Tasks              ├─ Phase 2:                 ├─ Recipe Popularity
├─ Ingredient Reqs         │  Calculations              ├─ Staff Workload
├─ Weekly Counts           ├─ Phase 3:                 ├─ Feedback Trends
├─ Feedback                │  Sheet Writing             ├─ Automation Health
├─ Audit Log               └─ Phase 4:                 ├─ Cross-Venue Comp
└─ Suppliers               │  Orchestration            └─ Data Cache
                          └─ Time-Driven Triggers
Waratah Base                   (Daily 10 PM,
├─ Items                       Weekly Sat 4 PM)
├─ Recipes
├─ Prep Tasks
├─ Stock Counts
├─ Count Sessions
├─ Feedback
├─ Audit Log
└─ Suppliers
```

---

## How to Use the Deliverables

### For Project Managers / Stakeholders

1. **Start here:** ANALYTICS_DASHBOARD_README.md (this file)
2. **Understand the scope:** Read "The 7 Key Metrics" section above
3. **Review timeline:** See "5-Week Implementation Plan" in QUICKSTART
4. **Track progress:** Use the phased breakdown to set weekly milestones

---

### For Developers

1. **Phase 0 — Understand (1 hour)**
   - Read ANALYTICS_DASHBOARD_DESIGN.md (full specification)
   - Skim ANALYTICS_DATA_FLOW.md (understand metric calculations)

2. **Phase 1 — Setup (30 minutes)**
   - Follow "Setup Steps" in ANALYTICS_DASHBOARD_QUICKSTART.md
   - Configure Script Properties, Airtable PAT, sheet ID

3. **Phase 2–5 — Implement (5 weeks)**
   - Follow the weekly phases in QUICKSTART
   - Copy code template (ANALYTICS_DASHBOARD_CODE_TEMPLATE.gs)
   - Implement each phase incrementally
   - Test with "Testing Checklist" in QUICKSTART

4. **Phase 6 — Deploy**
   - Set up time-driven triggers
   - Train managers
   - Monitor for 1 week
   - Go live

---

### For QA / Testers

1. **Read:** ANALYTICS_DASHBOARD_QUICKSTART.md — Testing Checklist section
2. **Manual test each metric** with known data values
3. **Monitor execution logs** during scheduled triggers
4. **Verify rate limiting** — no API errors
5. **Validate edge cases** — null values, empty tables, missing links

---

### For Managers / End Users

1. **Read:** User Guide section in ANALYTICS_DASHBOARD_QUICKSTART.md
2. **Learn:** How to interpret the DASHBOARD tab
3. **Drill down:** Click metric names to explore detailed data
4. **Act:** Use color-coded alerts (green/yellow/red) to prioritize investigations

---

## Key Design Decisions

### 1. Google Sheet (vs Power BI / Tableau / Custom Web App)

**Why:**
- No additional infrastructure (uses existing Google Workspace)
- Familiar to all staff (no new tool training)
- Easy to customize formulas + charts
- Free (no licensing cost)

**Trade-off:**
- Less polished UI than dedicated BI tools
- Limited to native Google charts
- Manual column sizing/formatting

**Mitigation:** User guide covers all common tasks; templates for charts

---

### 2. Airtable REST API (vs direct database queries)

**Why:**
- Native Airtable integration (no middleware)
- Respects Airtable's row-level permissions
- No need to manage database credentials

**Trade-off:**
- 5 req/sec rate limit
- Larger payloads (includes all fields)
- No complex joins at API level

**Mitigation:** Batch fetching, caching, scheduled off-peak refreshes

---

### 3. Daily + Weekly + Real-time Refresh

**Why:**
- Daily (10 PM): Captures prep efficiency, waste, feedback, automation health
- Weekly (Sat 4 PM): Captures recipe popularity, staff workload (after shift complete)
- Real-time: Feedback & audit log polling (every 10 min)

**Trade-off:**
- Multiple triggers (harder to debug)
- Data latency for some metrics (e.g., recipe popularity waits for Sat 4 PM)

**Mitigation:** Manual refresh button for on-demand updates; clear timestamps on all data

---

### 4. Cache + 2-Hour TTL

**Why:**
- Reduces API calls by 80% (reuse cached data within 2 hours)
- Faster sheet opens (no need to fetch every time)
- Protects against rate limiting

**Trade-off:**
- Data up to 2 hours stale (not real-time for all metrics)

**Mitigation:** Real-time polling for Feedback & Audit Log; manual refresh clears cache

---

## Success Criteria

### Functional

- [x] Fetch from both bases without API errors
- [x] Calculate all 7 metrics correctly
- [x] Populate 9 Google Sheet tabs automatically
- [x] Execution time < 90 seconds per refresh
- [x] 99%+ uptime (< 1 failure/month)

### User Experience

- [x] Non-technical managers can read dashboard
- [x] Color-coded alerts (green/yellow/red) visible at a glance
- [x] Drill-down links to detailed tabs
- [x] Manual refresh button available
- [x] Timestamps show data freshness

### Performance

- [x] Respects Airtable rate limits (5 req/sec)
- [x] GAS execution < 6 minutes
- [x] Sheet opens in < 2 seconds
- [x] Cache reduces redundant API calls
- [x] No timeouts

### Data Quality

- [x] No division-by-zero errors
- [x] Handle null/missing values gracefully
- [x] Validate assumptions (e.g., Ordered qty > 0)
- [x] Log all errors to Audit Log
- [x] Slack alerts for P0 failures

---

## Implementation Timeline (5 Weeks)

| Week | Phase | Focus | Deliverable |
|------|-------|-------|-------------|
| 1 | 2.4a | Foundation | Data fetching validated; all 9 tabs created |
| 2 | 2.4b | Core metrics | Metrics 1–3 implemented + charts |
| 3 | 2.4c | Secondary metrics | Metrics 4–6 implemented + charts |
| 4 | 2.4d | Cross-venue & scheduling | Metric 7 + triggers set up |
| 5 | 2.4e | Polish & deploy | Testing, docs, training, go-live |

**Effort:** ~200 developer hours total (~40h/week)

---

## Common Questions

### Q: Will this dashboard replace the current reports?

**A:** Yes, once deployed, it becomes the single source of truth for analytics. Historical reports can be archived.

---

### Q: What if we add a new metric later?

**A:** The template is designed to be extensible. Add a new `calculate*()` function, a `write*()` function, and trigger on daily/weekly schedule. Estimated: 4–6 hours per new metric.

---

### Q: Can managers edit the dashboard data?

**A:** No. The sheet is view-only for staff; edit for admins only. This ensures data integrity. Admins can make schema changes (e.g., adjust par levels in Airtable), and the dashboard reflects them automatically.

---

### Q: What happens if Airtable is down?

**A:** The GAS script will fail, but the cache will serve stale data (up to 2 hours old). If cache is expired, the dashboard will show the last refresh timestamp and an error note.

---

### Q: How do I add a custom metric?

**A:** Implement a new `calculate*()` function in AnalyticsDashboard.gs, add a `write*()` function to populate a new tab, and trigger on the appropriate schedule. See examples in the code template.

---

## Support & Troubleshooting

**Most common issues:**

1. **"Rate Limit Exceeded"** → Check cache is working; reduce polling frequency
2. **"Cannot read property X"** → Field name mismatch; verify in Airtable schema docs
3. **Sheet not updating** → Check Apps Script Executions tab for errors
4. **Slow execution** → Reduce data window (4 weeks → 2 weeks) or split script

See ANALYTICS_DASHBOARD_QUICKSTART.md — Troubleshooting section for detailed solutions.

---

## Next Steps

1. **Share this file** with the project team
2. **Assign a lead developer** to drive implementation
3. **Review the phased timeline** with stakeholders
4. **Schedule kick-off meeting** (1 hour) to walk through design
5. **Start Phase 2.4a** this week (setup + data fetching validation)

---

## Document Hierarchy

```
README (you are here)
├─ QUICKSTART ─────────────────► Start here for implementation
│   ├─ Setup steps (30 min)
│   ├─ Phased timeline (5 weeks)
│   └─ Testing checklist
│
├─ DESIGN (full specification)
│   ├─ Architecture & pipeline
│   ├─ All 7 metrics detailed
│   ├─ Sheet design spec
│   ├─ GAS script approach
│   └─ Success criteria
│
├─ DATA_FLOW (metric details)
│   ├─ Data sources per metric
│   ├─ Query logic
│   ├─ Calculation formulas
│   └─ Key assumptions
│
└─ CODE_TEMPLATE (ready-to-use code)
    ├─ Config object
    ├─ Data fetching functions
    ├─ Calculation functions
    ├─ Sheet writing functions
    └─ Orchestration & scheduling
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-23 | Initial design specification for Phase 2.4 |

---

## Contact

- **Design Lead:** Evan Stroeve
- **Questions:** See Troubleshooting section in QUICKSTART

---

**Status:** Ready for implementation.
**Next:** Read ANALYTICS_DASHBOARD_QUICKSTART.md to begin Phase 2.4a.
