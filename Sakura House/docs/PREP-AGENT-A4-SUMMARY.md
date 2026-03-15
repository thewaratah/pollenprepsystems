# PREP AGENT — A4 Capability Summary

**AI-Powered Kitchen Workflow Orchestration System**

---

## What is PREP AGENT?

PREP AGENT is an AI orchestration layer that transforms the PREP SYSTEM from manual-trigger automation into an intelligent, conversational workflow manager. It combines 13 specialized AI agents with 10 development skills to automate kitchen prep operations from stocktake to staff notifications.

---

## The 13 Specialized Agents

### Phase 1: Foundation Layer

| Agent | Model | Purpose |
|-------|-------|---------|
| **prep-workflow-orchestrator** | Opus | Central coordinator managing the weekly prep cycle state machine. Delegates to subagents, monitors execution, handles errors. |
| **airtable-operations** | Sonnet | Wraps Airtable MCP with PREP-specific query patterns, batch operations, and data validation. |
| **prep-gas-developer** | Sonnet | Google Apps Script specialist for Script Properties, clasp deployment, and debugging the 7 core scripts. |
| **workflow-states** | Haiku | Defines and validates state machine transitions: IDLE → STOCKTAKE → FINALIZING → GENERATING → EXPORTING → NOTIFYING → COMPLETE |
| **query-handler** | Sonnet | Natural language interface for staff questions about stocktake status, prep tasks, recipes, and workflow state. |
| **error-coordinator** | Sonnet | Error taxonomy, classification, recovery procedures, and cascade prevention across the workflow. |

### Phase 2: Intelligence Layer

| Agent | Model | Purpose |
|-------|-------|---------|
| **decision-engine** | Sonnet | Automated decisions with confidence scoring: stocktake readiness, prep run mode, export mode, buffer calculations. |

### Phase 3: Advanced Features

| Agent | Model | Purpose |
|-------|-------|---------|
| **analytics-engine** | Sonnet | Predictive analytics: par level optimization (12-week analysis), usage trends, seasonality detection, efficiency metrics. |
| **feedback-processor** | Sonnet | Staff feedback automation: AI triage, safe auto-fixes (unit/quantity corrections), escalation, weekly digests. |

### Phase 4: Operations

| Agent | Model | Purpose |
|-------|-------|---------|
| **testing-framework** | Sonnet | Comprehensive test suites: state machine, decision logic, data integrity, integration, E2E scenarios. |
| **monitoring-dashboard** | Haiku | System health metrics: workflow timing, integration latency, error rates, agent invocations. |
| **health-check** | Haiku | Automated validation: connection tests, data integrity, workflow health, configuration verification. |
| **staff-guide** | Haiku | End-user documentation: daily tasks by role, how to ask questions, troubleshooting. |

---

## The 10 Development Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **thinking-protocol** | Deep reasoning for complex problems | Buffer calculations, BOM explosion, architectural decisions |
| **create-plans** | Hierarchical project planning (BRIEF → ROADMAP → PLAN) | New features, major changes |
| **subagent-driven-development** | Quality-reviewed task execution | Implementing plans with built-in reviews |
| **compound-docs** | Solution documentation to searchable library | After solving non-trivial issues |
| **backend-development** | Production GAS patterns | Webhooks, APIs, security, retries |
| **mcp-management** | MCP server interactions | Complex Airtable operations beyond CRUD |
| **debugging** | Systematic root cause investigation | Any automation failure |
| **brainstorming** | Feature design through dialogue | Before implementation |
| **confidence-check** | Pre-implementation assessment (≥90% required) | Before starting ANY implementation |
| **prep-system-expertise** | Domain knowledge reference | Planning & context |

---

## Key Capabilities

### Conversational Workflow Management
Ask questions in natural language:
- "What's the stocktake status?" → Coverage %, items remaining, current state
- "What needs to be prepped?" → Prep tasks with batch counts and quantities
- "What does Gooch need to order?" → Ordering list grouped by supplier
- "What's in Wasabi Mayo?" → Recipe ingredients with quantities

### Automated Decision Making
| Decision Point | Auto-Action Threshold | Example |
|----------------|----------------------|---------|
| Stocktake readiness | ≥95% coverage | Auto-finalize |
| Prep run mode | No existing run | Generate new |
| Export mode | Weekday + business hours | LIVE mode |
| Buffer multiplier | Per-item or default | Apply 1.5x |

**Confidence-Based Actions:**
- ≥90%: Execute automatically
- 70-89%: Execute with notification
- 50-69%: Present options to user
- <50%: Require user decision

### Predictive Analytics
- **Par Level Optimization:** Analyzes 12+ weeks of consumption data, recommends adjustments
- **Trend Detection:** INCREASING | DECREASING | STABLE | SEASONAL | VOLATILE
- **Efficiency Analysis:** Task counts, ingredient consolidation, export timing
- **Weekly Reports:** Summary with recommendations posted to Slack

### Intelligent Feedback Processing
**Auto-Fix (Safe):**
- Unit corrections (ea ↔ each)
- Small quantity adjustments (≤50% change)
- Supplier updates (when supplier exists)

**Escalate (Manual):**
- New item creation
- Recipe method changes
- Par level adjustments

### Error Handling & Recovery
| Category | Recovery |
|----------|----------|
| Rate limit | Exponential backoff (3 retries) |
| Missing item | Skip + log, continue workflow |
| Duplicate run | User choice: rebuild/skip |
| Slack failed | Log warning, verify webhook |

---

## Workflow State Machine

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │  IDLE → STOCKTAKE → FINALIZING → GENERATING → EXPORTING → NOTIFYING │
   │    ↑                                                      ↓         │
   │    └──────────────────── COMPLETE ←──────────────────────┘         │
   │                                                                     │
   │              ↑↓ (any state can transition to/from ERROR)            │
   └─────────────────────────────────────────────────────────────────────┘
```

**Transitions triggered by:**
- ClearWeeklyCount.gs → STOCKTAKE
- FinaliseCount.gs → FINALIZING
- GeneratePrepRun.gs → GENERATING
- GoogleDocsPrepSystem.gs → EXPORTING
- Slack notifications → COMPLETE

---

## Integration Architecture

```
                    ┌─────────────────────────┐
                    │   PREP AGENT            │
                    │   Orchestrator (Opus)   │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
   ┌────▼────┐           ┌──────▼──────┐         ┌──────▼──────┐
   │  Query  │           │  Workflow   │         │   Error     │
   │ Handler │           │   States    │         │ Coordinator │
   └────┬────┘           └──────┬──────┘         └──────┬──────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
   ┌────▼────┐           ┌──────▼──────┐         ┌──────▼──────┐
   │ Airtable│           │    GAS      │         │   Slack     │
   │   MCP   │           │  Developer  │         │  Webhooks   │
   └─────────┘           └─────────────┘         └─────────────┘
```

**MCP Integration:** 33+ Airtable tools via `@rashidazarang/airtable-mcp`

---

## New: LLM & Supabase Integration Layer

### Supabase MCP (supabase-mcp)
Real-time PostgreSQL database integration via Model Context Protocol:
- **Direct SQL queries** with parameterized safety
- **Real-time subscriptions** for live data updates
- **Row-level security** integration
- **Edge Functions** for serverless compute

| Capability | Use Case |
|------------|----------|
| Structured analytics storage | Historical prep data beyond Airtable limits |
| Real-time dashboards | Live stocktake progress monitoring |
| Complex queries | Cross-table analytics with SQL |
| Backup/archive | Long-term data retention |

### Supabase JS Client (supabase-js)
JavaScript SDK for direct Supabase integration:
- Authentication & authorization
- Database CRUD operations
- Storage for document attachments
- Realtime channel subscriptions

### Awesome LLM Apps Patterns
Reference library for advanced AI capabilities:
- **RAG patterns** — Enhanced context retrieval for recipe/ingredient queries
- **Agent orchestration** — Multi-agent coordination patterns
- **Tool use** — Function calling best practices
- **Streaming** — Real-time response patterns for dashboards

### Hybrid Architecture (Airtable + Supabase)
```
┌─────────────────┐     ┌──────────────────┐
│    Airtable     │     │     Supabase     │
│  (Operational)  │     │   (Analytics)    │
├─────────────────┤     ├──────────────────┤
│ • Items         │────▶│ • Historical     │
│ • Recipes       │     │   consumption    │
│ • Weekly Counts │     │ • Trend data     │
│ • Prep Runs     │     │ • ML features    │
│ • Feedback      │     │ • Audit archive  │
└─────────────────┘     └──────────────────┘
         │                       │
         └───────┬───────────────┘
                 ▼
        ┌─────────────────┐
        │   PREP AGENT    │
        │   Orchestrator  │
        └─────────────────┘
```

---

## Quick Reference

### Start a Conversation
```
"What's the current prep workflow status?"
"Is stocktake ready for finalization?"
"Generate a prep run for this week"
```

### Trigger Actions
```
"Export the prep run to Google Docs"
"Send ordering lists to Slack"
"Run smoke tests on the system"
```

### Debug Issues
```
"Why did the prep run generation fail?"
"Show me the last 5 audit log entries"
"What's causing the rate limit errors?"
```

---

**Version:** 5.4 | **Agents:** 13 | **Skills:** 10 | **Integrations:** Airtable MCP, Supabase MCP, LLM Patterns | **Last Updated:** 2026-02-01
