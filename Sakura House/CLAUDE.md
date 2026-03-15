# PREP SYSTEM

A comprehensive food preparation management system integrating Airtable, Google Apps Script, Google Docs, and Slack for restaurant/catering operations.

## System Overview

The PREP SYSTEM automates kitchen prep workflows from stocktake to task generation, document creation, and team notifications. It calculates ingredient shortfalls against par levels, generates prep tasks with recipe batching, and distributes ordering/prep lists to staff via Google Docs and Slack.

---

## Folder Architecture

```
PREP SYSTEM/
├── scripts/                          # Core production Google Apps Scripts
│   ├── ClearWeeklyCount.gs           # Initialize stocktake session
│   ├── FinaliseCount.gs              # Validate & finalize stocktake
│   ├── GeneratePrepRun.gs            # Generate prep tasks from shortfalls
│   ├── GeneratePrepSheet.gs          # Export request processor
│   ├── GoogleDocsPrepSystem.gs       # Main doc exporter + Slack
│   ├── GoogleDocsPrepSystem_TestHarness.gs
│   ├── FeedbackForm.gs               # Staff feedback collection web app
│   ├── FeedbackFormUI.html           # Feedback form interface
│   ├── RecipeScaler.gs               # Constraint-based recipe scaling
│   └── RecipeScalerUI.html           # Mobile-friendly scaler interface
│
├── config/                           # Sensitive configuration (GITIGNORED)
│   ├── GoogleDocsPrepSystemScriptProperties
│   └── airtableautomationURLs
│
├── reference/                        # External tools & libraries (pruned)
│   ├── claude-tools/                 # Claude Code skills & frameworks (3.2GB)
│   └── automation/
│       └── awesome-n8n-templates/
│           └── Airtable/             # Airtable-specific n8n templates only
│
├── .claude/                          # Claude Code configuration
│   ├── agents/                       # PREP AGENT specialized agents
│   │   └── prep-system/              # Domain-specific agents
│   │       ├── prep-workflow-orchestrator.md  # Central coordination (P0)
│   │       ├── airtable-operations.md         # Airtable MCP wrapper (P0)
│   │       ├── prep-gas-developer.md          # GAS specialist (P0)
│   │       ├── workflow-states.md             # State machine (P0)
│   │       ├── query-handler.md               # NL query processing (P1)
│   │       ├── error-coordinator.md           # Error handling (P1)
│   │       ├── decision-engine.md             # Automated decisions (P2)
│   │       ├── analytics-engine.md            # Predictive analytics (P3)
│   │       ├── feedback-processor.md          # Feedback automation (P3)
│   │       ├── testing-framework.md           # Test suites (P4)
│   │       ├── monitoring-dashboard.md        # System monitoring (P4)
│   │       ├── health-check.md                # Automated validation (P4)
│   │       └── staff-guide.md                 # End-user documentation (P4)
│   ├── mcp.json                      # MCP server configuration
│   └── skills/                       # Local development skills
│       ├── thinking-protocol.md      # Deep reasoning for debugging
│       ├── create-plans.md           # Feature planning workflow
│       ├── subagent-driven-development.md  # Quality execution
│       ├── compound-docs.md          # Solution documentation
│       ├── backend-development.md    # API & script patterns
│       ├── mcp-management.md         # MCP integration management
│       ├── debugging.md              # Systematic debugging
│       ├── brainstorming.md          # Feature ideation
│       └── expertise/prep-system/    # Domain knowledge
│
├── .planning/                        # Feature planning artifacts
│   ├── BRIEF-TEMPLATE.md             # New feature template
│   └── phases/                       # Phase-by-phase plans
│
├── docs/                             # Documentation
│   ├── STAFF_GUIDE.md        # Quick start for staff
│   ├── MANAGER_GUIDE.md # Manager guide
│   ├── TECHNICAL_REFERENCE.md     # Technical reference
│   └── solutions/                    # Searchable solution library
│       ├── integration-issues/       # API/webhook problems
│       ├── runtime-errors/           # Script failures
│       ├── airtable-issues/          # Airtable-specific
│       ├── slack-issues/             # Slack-specific
│       ├── google-docs-issues/       # Docs-specific
│       ├── configuration-issues/     # Config/deployment
│       └── patterns/                 # Common solutions
│           ├── common-solutions.md
│           └── critical-patterns.md  # Required reading
│
├── templates/                        # Google Docs templates
│   ├── Template_Batching_List.html   # Batching list template
│   ├── Template_Ingredient_Prep_List.html
│   └── Template_Ordering_List.html   # Ordering list template
│
├── CLAUDE.md                         # This documentation file
└── .gitignore                        # Protects sensitive files
```

---

## Development Workflow Skills

Local skills installed in `.claude/skills/` for structured development:

### 1. Thinking Protocol
**File:** [.claude/skills/thinking-protocol.md](.claude/skills/thinking-protocol.md)

Use for complex debugging:
- Buffer multiplier calculations
- Recipe BOM explosion logic
- Integration failure analysis
- Architectural decisions

**Usage:** Ask Claude to "think through step-by-step" about complex problems.

### 2. Create Plans
**File:** [.claude/skills/create-plans.md](.claude/skills/create-plans.md)

Plan new features before implementation:
1. Create BRIEF.md (vision)
2. Create ROADMAP.md (phases)
3. Create PLAN.md (executable tasks)
4. Execute and document

**Usage:** Start with [.planning/BRIEF-TEMPLATE.md](.planning/BRIEF-TEMPLATE.md)

### 3. Subagent-Driven Development
**File:** [.claude/skills/subagent-driven-development.md](.claude/skills/subagent-driven-development.md)

Execute plans with quality reviews:
- Fresh context per task
- Spec compliance review
- Code quality review
- PREP SYSTEM-specific checks

### 4. Compound Docs
**File:** [.claude/skills/compound-docs.md](.claude/skills/compound-docs.md)

Document solved problems for future reference:
- Auto-triggers after "that worked"
- Categorized by problem type
- Searchable with grep

**Solution library:** [docs/solutions/](docs/solutions/)
**Critical patterns:** [docs/solutions/patterns/critical-patterns.md](docs/solutions/patterns/critical-patterns.md)

### 5. Backend Development
**File:** [.claude/skills/backend-development.md](.claude/skills/backend-development.md)

Production patterns for Google Apps Script:
- API design and webhook patterns
- Security best practices
- Error handling and retries
- Performance optimization

### 6. MCP Management
**File:** [.claude/skills/mcp-management.md](.claude/skills/mcp-management.md)

Manage MCP integrations (Airtable, Xero):
- 33+ Airtable tools via airtable-mcp2
- Context-efficient subagent patterns
- When to use MCP vs direct scripts

### 7. Debugging
**File:** [.claude/skills/debugging.md](.claude/skills/debugging.md)

Systematic debugging for automation failures:
- Root cause investigation (before fixes)
- Defense-in-depth validation
- Verification before completion
- Common PREP SYSTEM bugs reference

### 8. Brainstorming
**File:** [.claude/skills/brainstorming.md](.claude/skills/brainstorming.md)

Design new features through dialogue:
- One question at a time
- Explore 2-3 approaches
- Present design in sections
- Document to `docs/plans/`

---

## PREP SUPER AGENT - Intelligent Operations Hub

PREP SUPER AGENT is the intelligent brain of the PREP SYSTEM - a fully-connected AI orchestrator that understands your kitchen operations, remembers context across conversations, proactively surfaces insights, and takes action on your behalf.

### What Makes It a Super Agent

| Capability | Description |
|------------|-------------|
| **Context Persistence** | Remembers conversation history and learns from interactions |
| **RAG Knowledge** | Searches 87K+ embedded documents for relevant context |
| **Tool Execution** | Executes real operations on Airtable, triggers workflows |
| **Multi-Agent Orchestration** | Delegates to 13 specialized sub-agents for complex tasks |
| **Proactive Intelligence** | Surfaces issues before you ask, suggests optimizations |
| **Natural Language Actions** | "Generate prep run" → actually generates it |

### Super Agent Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │           PREP SUPER AGENT                  │
                    │         (Claude Sonnet 4)                   │
                    │                                             │
                    │  ┌─────────────────────────────────────┐   │
                    │  │         MEMORY LAYER                │   │
                    │  │  • Conversation history             │   │
                    │  │  • User preferences                 │   │
                    │  │  • Recent actions & outcomes        │   │
                    │  └─────────────────────────────────────┘   │
                    │                                             │
                    │  ┌─────────────────────────────────────┐   │
                    │  │         REASONING ENGINE            │   │
                    │  │  • Intent detection                 │   │
                    │  │  • Context synthesis                │   │
                    │  │  • Action planning                  │   │
                    │  └─────────────────────────────────────┘   │
                    └─────────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   KNOWLEDGE      │        │     TOOLS        │        │   SUB-AGENTS     │
│   (Supabase)     │        │   (Actions)      │        │  (Specialists)   │
├──────────────────┤        ├──────────────────┤        ├──────────────────┤
│ • 87K+ chunks    │        │ • stocktake_*    │        │ • query-handler  │
│ • Recipes        │        │ • prep_run_*     │        │ • analytics      │
│ • Food science   │        │ • recipe_*       │        │ • error-recovery │
│ • SOPs           │        │ • workflow_*     │        │ • decision-engine│
│ • Training docs  │        │ • export_*       │        │ • feedback-proc  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
          │                             │                             │
          └─────────────────────────────┼─────────────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │           INTEGRATIONS                      │
                    ├─────────────┬─────────────┬─────────────────┤
                    │  Airtable   │   Slack     │  Google Docs    │
                    │  (33+ MCP   │  Webhooks   │  Generation     │
                    │   tools)    │             │                 │
                    └─────────────┴─────────────┴─────────────────┘
```

### Endpoint Architecture

The Super Agent uses `/api/chat` as its primary endpoint:

| Endpoint | Model | Purpose | Status |
|----------|-------|---------|--------|
| `/api/chat` | Claude Sonnet 4 | **Main Super Agent** - RAG + Tools + Streaming | **Active** |
| `/api/prep/chat` | ~~Haiku~~ | Legacy - redirects to /api/chat | Deprecated |

### Available Tools

The Super Agent has 15+ tools for real operations:

**Stocktake Operations:**
| Tool | Description |
|------|-------------|
| `get_stocktake_status` | Current stocktake coverage, items remaining |
| `get_item_count` | Stock count for specific item |
| `update_item_count` | Update stock count (with confirmation) |
| `clear_weekly_counts` | Initialize new stocktake session |
| `finalize_stocktake` | Validate and confirm stocktake |

**Prep Run Operations:**
| Tool | Description |
|------|-------------|
| `get_prep_status` | Current prep run state and progress |
| `get_prep_tasks` | List all prep tasks with status |
| `generate_prep_run` | Calculate shortfalls, create tasks |
| `export_prep_docs` | Generate Google Docs and notify Slack |

**Recipe Operations:**
| Tool | Description |
|------|-------------|
| `lookup_recipe` | Get recipe details by name or ID |
| `scale_recipe` | Scale recipe based on available ingredient |
| `get_recipe_yield` | Recipe yield and batch size |

**Analytics & Insights:**
| Tool | Description |
|------|-------------|
| `get_par_recommendations` | AI-suggested par level adjustments |
| `get_usage_trends` | Item usage trends (increasing/decreasing) |
| `get_efficiency_metrics` | Prep team efficiency analysis |

### Conversation Memory

The Super Agent maintains context across messages:

```typescript
// Memory structure (stored in session)
interface ConversationMemory {
  messages: Message[];           // Full conversation history
  currentContext: {
    prepRun?: PrepRun;           // Active prep run
    stocktakeStatus?: Status;    // Current stocktake state
    lastAction?: Action;         // Last executed action
  };
  userPreferences: {
    role?: 'prep' | 'ordering' | 'manager';
    defaultView?: string;
    verbosity?: 'concise' | 'detailed';
  };
}
```

**How Memory Works:**
1. Each message includes full conversation history
2. Tool results are cached for the session
3. User preferences are learned over time
4. Recent actions inform follow-up suggestions

### Example Interactions

**Status Query with Context:**
```
User: "What's the stocktake status?"

Super Agent: Based on the current data:

📊 **Stocktake Progress: 85% complete**

Counted: 127/150 items
Remaining: 23 items

Missing items by category:
• Sauces: 8 items (including Wasabi Mayo, Ponzu)
• Proteins: 7 items
• Garnishes: 8 items

Would you like me to:
1. List the specific items remaining?
2. Start the finalization anyway (partial coverage)?
3. Send a reminder to the team?
```

**Natural Language Actions:**
```
User: "Generate the prep run for this week"

Super Agent: I'll generate the prep run now.

⏳ **Generating Prep Run...**

✅ **Prep Run Created: 2026-02-03**

Summary:
• 24 prep tasks created
• 156 ingredient requirements calculated
• 12 items need ordering (Gooch: 8, Sabs: 4)

Top priority items:
1. Wasabi Mayo - 15 batches needed (high demand)
2. Ponzu - 8 batches needed
3. Pickled Ginger - 6 batches needed

Ready to export to Google Docs? I can:
1. Export now (LIVE mode - notifies team)
2. Export test (TEST mode - dev channel only)
3. Show me the full task list first
```

**Proactive Insights:**
```
User: "What should I know before this week's prep?"

Super Agent: Here's your prep briefing for the week:

🔔 **Heads Up:**

1. **Wasabi Mayo demand up 35%** - Consider increasing par level
   from 15 to 20. Last 3 weeks showed consistent uptick.

2. **Ponzu running low on key ingredient** - Only 2.5L Yuzu juice
   in stock. Need to order before Wednesday prep.

3. **Recipe issue flagged** - 2 staff reported Miso Glaze quantities
   seem off. AI confidence: 78% this is a real issue.

📈 **Trends:**
• Fermented items: +22% demand (summer menu effect?)
• Protein marinades: stable
• Dessert preps: -15% (expected post-holiday)

Want me to adjust par levels based on these trends?
```

### RAG Knowledge Base

The Super Agent searches 87K+ embedded documents:

| Category | Documents | Examples |
|----------|-----------|----------|
| Recipes | ~500 | All Sakura House recipes with methods |
| Food Science | ~2,000 | Maillard reaction, fermentation, preservation |
| SOPs | ~200 | Kitchen procedures, safety protocols |
| Training | ~100 | Staff onboarding, equipment guides |
| Cookbooks | ~80,000 | Reference materials, techniques |

**How RAG Works:**
1. User query is embedded using OpenAI
2. Vector similarity search finds relevant chunks
3. Top 5-10 chunks are included in context
4. Claude reasons over both RAG and real-time data

### Sub-Agent Delegation

For complex tasks, the Super Agent delegates to specialists:

| Task Type | Sub-Agent | Capabilities |
|-----------|-----------|--------------|
| Data queries | query-handler | Intent detection, entity extraction, response formatting |
| Workflow decisions | decision-engine | Confidence scoring, automated actions, escalation |
| Error recovery | error-coordinator | Diagnosis, retry logic, cascade prevention |
| Analytics | analytics-engine | Trend detection, par optimization, forecasting |
| Feedback | feedback-processor | Triage, auto-fix, escalation routing |

### Integration with Frontend

The Super Agent is accessed via the floating chat button on all `/prep/*` pages:

```
┌─────────────────────────────────────────┐
│  PREP Dashboard                         │
│  ┌─────────────────────────────────┐   │
│  │  Weekly Stocktake               │   │
│  │  Ordering Lists                 │   │
│  │  Batching                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│                    ┌──────────────────┐ │
│                    │  💬 PREP AGENT   │ │
│                    │                  │ │
│                    │ Chat window with │ │
│                    │ full Super Agent │ │
│                    │ capabilities     │ │
│                    └──────────────────┘ │
└─────────────────────────────────────────┘
```

### Sub-Agent Directory

The Super Agent delegates to 13 specialized sub-agents in [.claude/agents/prep-system/](.claude/agents/prep-system/):

**Orchestration Layer**
| Agent | When Invoked | Capabilities |
|-------|--------------|--------------|
| [prep-workflow-orchestrator.md](.claude/agents/prep-system/prep-workflow-orchestrator.md) | Complex multi-step operations | Coordinates sub-agents, manages state, handles failures |
| [workflow-states.md](.claude/agents/prep-system/workflow-states.md) | State transitions | Validates state changes, enforces business rules |

**Query & Response**
| Agent | When Invoked | Capabilities |
|-------|--------------|--------------|
| [query-handler.md](.claude/agents/prep-system/query-handler.md) | Natural language questions | Intent detection, entity extraction, formatted responses |
| [airtable-operations.md](.claude/agents/prep-system/airtable-operations.md) | Data operations | 33+ MCP tools, batch operations, schema-aware queries |

**Intelligence Layer**
| Agent | When Invoked | Capabilities |
|-------|--------------|--------------|
| [decision-engine.md](.claude/agents/prep-system/decision-engine.md) | Automated decisions | Confidence scoring, threshold-based actions, escalation |
| [analytics-engine.md](.claude/agents/prep-system/analytics-engine.md) | Insights & forecasting | Par optimization, trend detection, efficiency analysis |

**Error & Recovery**
| Agent | When Invoked | Capabilities |
|-------|--------------|--------------|
| [error-coordinator.md](.claude/agents/prep-system/error-coordinator.md) | Failures & exceptions | Diagnosis, retry logic, cascade prevention, recovery |

**Feedback & Learning**
| Agent | When Invoked | Capabilities |
|-------|--------------|--------------|
| [feedback-processor.md](.claude/agents/prep-system/feedback-processor.md) | Staff feedback | AI triage, auto-fix safe changes, escalation routing |

**Development & Operations**
| Agent | When Invoked | Capabilities |
|-------|--------------|--------------|
| [prep-gas-developer.md](.claude/agents/prep-system/prep-gas-developer.md) | GAS script issues | Script Properties, clasp, debugging, deployment |
| [testing-framework.md](.claude/agents/prep-system/testing-framework.md) | Validation | Smoke tests, integration tests, dry-run mode |
| [monitoring-dashboard.md](.claude/agents/prep-system/monitoring-dashboard.md) | System health | Metrics, latency, error rates, alerting |
| [health-check.md](.claude/agents/prep-system/health-check.md) | Automated validation | Connection tests, data integrity, config checks |
| [staff-guide.md](.claude/agents/prep-system/staff-guide.md) | Training questions | Role-based guidance, troubleshooting, how-to |

### Data Layer Architecture

The Super Agent uses a hybrid data architecture optimized for different use cases:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPER AGENT DATA LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │     AIRTABLE        │      │     SUPABASE        │          │
│  │  (Operational)      │      │  (Knowledge + AI)   │          │
│  ├─────────────────────┤      ├─────────────────────┤          │
│  │ • Items (250+)      │      │ • rag_chunks (87K+) │          │
│  │ • Recipes (150+)    │      │ • embeddings (1536d)│          │
│  │ • Weekly Counts     │      │ • search_analytics  │          │
│  │ • Prep Runs         │      │ • conversation_logs │          │
│  │ • Prep Tasks        │      │ • user_preferences  │          │
│  │ • Ingredient Reqs   │      │                     │          │
│  │ • Par Levels        │      │                     │          │
│  │ • Feedback          │      │                     │          │
│  │ • Audit Log         │      │                     │          │
│  └─────────────────────┘      └─────────────────────┘          │
│           │                            │                        │
│           │  Direct API                │  pgvector search       │
│           ▼                            ▼                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SUPER AGENT (/api/chat)                    │   │
│  │  • Queries Airtable for real-time operational data      │   │
│  │  • Searches Supabase for knowledge context              │   │
│  │  • Combines both for informed responses                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why Hybrid?**
| Data Type | Storage | Reason |
|-----------|---------|--------|
| Real-time ops | Airtable | Staff-friendly UI, automations, quick updates |
| RAG knowledge | Supabase | Vector search, SQL analytics, scales to millions |
| Conversation logs | Supabase | Persistence, analysis, learning |
| User preferences | Supabase | Cross-session memory |

### MCP Configuration

The Super Agent can use MCP for advanced Airtable operations. Configuration in [.claude/mcp.json](.claude/mcp.json):

```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": ["@rashidazarang/airtable-mcp"],
      "env": {
        "AIRTABLE_TOKEN": "${AIRTABLE_PAT}",
        "AIRTABLE_BASE_ID": "appNsFRhuU47e9qlR"
      }
    }
  }
}
```

**Available MCP Tools (33+):**
| Category | Tools |
|----------|-------|
| Read | `list_records`, `get_record`, `search_records` |
| Write | `create_record`, `update_record`, `delete_record` |
| Bulk | `create_records`, `update_records`, `delete_records` |
| Schema | `list_bases`, `get_base_schema`, `list_tables` |
| Advanced | `run_query`, `aggregate`, `get_linked_records` |

### Environment Configuration

Required environment variables for the Super Agent:

```env
# Claude API (Super Agent brain)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# Supabase (Knowledge + Memory)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (Embeddings for RAG)
OPENAI_API_KEY=sk-proj-...

# Airtable (Operational Data)
AIRTABLE_BASE_ID=appNsFRhuU47e9qlR
AIRTABLE_PAT=pat...

# Optional: MCP for advanced operations
AIRTABLE_TOKEN=${AIRTABLE_PAT}
```

### Workflow State Machine

The Super Agent tracks the weekly prep cycle through these states:

```
IDLE → STOCKTAKE → FINALIZING → GENERATING → EXPORTING → NOTIFYING → COMPLETE
  │                                                                      │
  └──────────────────────── ERROR (with recovery) ◄─────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────┐
                         │  ERROR STATES   │
                         ├─────────────────┤
                         │ • AUTO_RETRY    │ → Automatic recovery
                         │ • NEEDS_INPUT   │ → User decision
                         │ • FAILED        │ → Manual intervention
                         └─────────────────┘
```

**State Awareness:**
The Super Agent always knows the current workflow state and can:
- Report status in plain language
- Suggest next actions
- Block invalid transitions
- Recover from errors automatically when possible

### Intelligent Query Handling

The Super Agent understands intent and responds appropriately:

**Status Queries:**
| Query | Understanding | Response |
|-------|---------------|----------|
| "What's the status?" | Workflow overview | State, progress, next steps |
| "How's the stocktake going?" | Stocktake-specific | Coverage %, remaining items, blockers |
| "What needs ordering?" | Ordering focus | Items by supplier and staff |

**Action Requests:**
| Query | Understanding | Action |
|-------|---------------|--------|
| "Generate the prep run" | Workflow action | Executes generate_prep_run tool |
| "Export to docs" | Export action | Executes export_prep_docs tool |
| "Update wasabi count to 12" | Data update | Executes update_item_count tool |

**Knowledge Questions:**
| Query | Understanding | Response |
|-------|---------------|----------|
| "What's in Wasabi Mayo?" | Recipe lookup | Ingredients, method, yield |
| "How long does miso take to cure?" | Food science | RAG search + knowledge |
| "Why do we blanch first?" | Technique | Scientific explanation |

### Error Handling & Recovery

The Super Agent handles errors gracefully:

| Error Type | Detection | Recovery |
|------------|-----------|----------|
| Rate limit | HTTP 429 | Exponential backoff, retry 3x |
| Network timeout | No response | Retry with increased timeout |
| Data validation | Invalid input | Clear error message, suggest fix |
| Missing data | Null/undefined | Graceful fallback, explain gap |
| Workflow conflict | State mismatch | Explain issue, offer resolution |

**Error Response Example:**
```
User: "Generate the prep run"

Super Agent: I couldn't generate the prep run because:

⚠️ **Stocktake Not Finalized**

The stocktake is only 73% complete and hasn't been confirmed yet.

Options:
1. **Finalize anyway** - Generate with incomplete data (not recommended)
2. **Show remaining items** - See what's left to count
3. **Wait** - Complete stocktake first

What would you like to do?
```

### Usage Examples

**Conversational Flow:**
```
User: "Morning! What's happening with prep?"

Super Agent: Good morning! Here's your prep overview:

📊 **Current Status: STOCKTAKE IN PROGRESS**

• Coverage: 127/150 items (85%)
• Last counted: 2 hours ago
• Prep run: Not yet generated

🔔 **Action Needed:**
23 items still need counting before I can generate the prep run.

Want me to list the remaining items?

───────────────────────────────

User: "Yes, show me"

Super Agent: Here are the 23 uncounted items:

**Sauces (8):**
□ Wasabi Mayo
□ Ponzu
□ Miso Glaze
... (5 more)

**Proteins (7):**
□ Salmon Portions
□ Tuna Saku
... (5 more)

**Garnishes (8):**
□ Pickled Ginger
□ Wakame
... (6 more)

Would you like me to send this list to the team on Slack?

───────────────────────────────

User: "Update wasabi mayo to 14 and ponzu to 8"

Super Agent: ✅ Updated stock counts:

| Item | Previous | New |
|------|----------|-----|
| Wasabi Mayo | - | 14 |
| Ponzu | - | 8 |

Progress now: 129/150 (86%)

21 items remaining. Keep going?
```

**Action Execution:**
```
User: "Stocktake is done, generate everything"

Super Agent: I'll run the full workflow now:

**Step 1: Finalizing Stocktake**
⏳ Validating 150 items...
✅ Stocktake finalized (Count Date: 2026-02-01)

**Step 2: Generating Prep Run**
⏳ Calculating shortfalls against par levels...
⏳ Creating prep tasks...
⏳ Exploding recipes to ingredients...
✅ Prep Run 2026-02-03 created

Summary:
• 24 prep tasks
• 156 ingredient requirements
• Gooch: 8 items to order
• Sabs: 4 items to order

**Step 3: Exporting Documents**
⏳ Generating Google Docs...
✅ 4 documents created

**Step 4: Notifying Team**
⏳ Sending Slack notifications...
✅ Gooch notified
✅ Sabs notified
✅ Prep channel notified

🎉 **All done!**

📁 [View Prep Guides Folder](https://drive.google.com/...)
```

### Proactive Intelligence

The Super Agent doesn't just answer questions - it proactively surfaces insights:

**Automated Decision Making:**
| Decision Point | Confidence Threshold | Auto-Action |
|----------------|---------------------|-------------|
| Stocktake ≥95% complete | High (≥90%) | "Ready to finalize. Shall I proceed?" |
| Stocktake 80-94% complete | Medium (70-89%) | "Almost ready. 12 items remaining." |
| Stocktake <80% complete | Low (<70%) | "Not ready yet. Here's what's missing..." |
| Export on weekday morning | Context-aware | Default to LIVE mode |
| Export on weekend | Context-aware | Default to TEST mode |

**Predictive Analytics:**

The Super Agent analyzes patterns and surfaces recommendations:

```
📈 **Weekly Insights (Auto-Generated)**

**Par Level Adjustments Suggested:**
┌────────────────┬─────────┬───────────┬─────────────────────┐
│ Item           │ Current │ Suggested │ Reason              │
├────────────────┼─────────┼───────────┼─────────────────────┤
│ Wasabi Mayo    │ 15      │ 18 (+20%) │ Increasing trend    │
│ Ponzu          │ 10      │ 8 (-20%)  │ Decreasing demand   │
│ Miso Glaze     │ 12      │ 15 (+25%) │ Seasonal uptick     │
└────────────────┴─────────┴───────────┴─────────────────────┘

**Trend Detection:**
• Fermented items: +22% demand (summer menu launch)
• Protein marinades: Stable
• Dessert preps: -15% (post-holiday normal)

Want me to apply these suggestions?
```

**Feedback Learning:**

The Super Agent processes staff feedback and learns:

| Feedback Type | Auto-Action | Confidence |
|---------------|-------------|------------|
| "Quantity should be 150ml not 100ml" | Update recipe line | High (if <50% change) |
| "We're out of yuzu" | Alert ordering staff | Immediate |
| "Miso cure takes 48h not 24h" | Flag for review | Needs confirmation |
| "New item: Korean Chili Flakes" | Create item request | Manual approval |

### System Health & Monitoring

The Super Agent monitors its own health:

**Health Indicators:**
| Component | Status | Check Frequency |
|-----------|--------|-----------------|
| Airtable API | 🟢 Connected | Every request |
| Supabase (RAG) | 🟢 Connected | Every search |
| OpenAI Embeddings | 🟢 Available | On-demand |
| Slack Webhooks | 🟢 Verified | On export |

**When You Ask "Is the system healthy?":**
```
Super Agent: System Health Check:

✅ **All Systems Operational**

| Service | Status | Latency |
|---------|--------|---------|
| Airtable API | 🟢 OK | 145ms |
| Supabase RAG | 🟢 OK | 89ms |
| OpenAI Embed | 🟢 OK | 234ms |
| Slack (Kalisha) | 🟢 OK | 161ms |
| Slack (Evan) | 🟢 OK | 164ms |
| Slack (Gooch) | 🟢 OK | 167ms |
| Slack (Sabs) | 🟢 OK | 172ms |
| Slack (Prep) | 🟢 OK | 169ms |

Last successful workflow: 2 days ago
Knowledge base: 87,234 chunks indexed
```

### Role-Based Guidance

The Super Agent adapts to different user roles:

**Prep Team:**
- Focus on batching lists and ingredient prep
- Recipe scaling help
- Prep task status

**Ordering Staff (Gooch/Sabs):**
- Focus on ordering lists by supplier
- Stock level alerts
- Supplier contact info

**Managers:**
- Full workflow visibility
- Analytics and trends
- System health
- Configuration access

### Implementation Status

The Super Agent implementation:

| Component | Status | Notes |
|-----------|--------|-------|
| `/api/chat` endpoint | ✅ Built | Claude Sonnet 4 + RAG + Tools |
| RAG knowledge base | ✅ 87K+ chunks | Recipes, food science, SOPs |
| Stocktake tools | ✅ Complete | get/update/clear/finalize |
| Prep run tools | ✅ Complete | generate/export/status |
| Recipe tools | ✅ Complete | lookup/scale/yield |
| Conversation memory | ✅ Session-based | Full history per session |
| Sub-agent delegation | ⏳ Phase 2 | 13 agents defined, orchestration pending |
| User preferences | ⏳ Phase 2 | Supabase storage ready |
| Proactive insights | ⏳ Phase 3 | Analytics engine ready |

**Total Agents:** 13 specialized sub-agents for complex delegation

---

## Knowledge Platform

The Knowledge Platform is a Next.js application providing RAG (Retrieval-Augmented Generation) chat interface for PREP operations and scientific knowledge queries.

**Location:** [prep-knowledge-platform/](prep-knowledge-platform/)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Platform                        │
│                    (Next.js + React)                         │
├─────────────────────────────────────────────────────────────┤
│  /api/chat       │  Claude Sonnet 4 + PREP Tools            │
│  /api/search     │  Smart Search (vector + hybrid)          │
│  /api/sync/recipe│  Airtable → RAG sync webhook             │
│  /api/analytics  │  Search performance monitoring           │
└─────────────────────────────────────────────────────────────┘
          │                      │                    │
          ▼                      ▼                    ▼
    ┌──────────┐          ┌──────────┐         ┌──────────┐
    │ Supabase │          │ OpenAI   │         │ Airtable │
    │ pgvector │          │ Embed    │         │   MCP    │
    │ (87K+)   │          │ API      │         │          │
    └──────────┘          └──────────┘         └──────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **RAG Chat** | Claude-powered chat with knowledge base context |
| **PREP Tools** | Stocktake status, recipe lookup, recipe scaling |
| **Smart Search** | Auto-selects vector vs hybrid based on query |
| **Query Caching** | 15-minute TTL for repeated queries |
| **Recipe Sync** | Webhook for Airtable recipe → RAG ingestion |
| **Analytics** | Search latency, similarity scores, popular queries |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Chat with PREP Agent (Claude + tools) |
| `/api/search` | POST | Search knowledge base |
| `/api/sync/recipe` | POST | Sync recipe from Airtable |
| `/api/sync/recipe?all=true` | GET | Sync all recipes |
| `/api/analytics/search` | GET | Search performance stats |
| `/api/stats` | GET | Knowledge base statistics |

### PREP Operations API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prep/counts` | GET | Fetch all active items with weekly counts |
| `/api/prep/counts` | PATCH | Update single item's stock count (upsert) |
| `/api/prep/counts/clear` | POST | Clear weekly counts, create placeholders |
| `/api/prep/workflow/generate` | POST | Run full workflow (finalize → generate → export) |
| `/api/prep/lists` | GET | Fetch prep lists (ordering, batching, ingredients) |
| `/api/prep/status` | GET | Get current workflow status |

### PREP Operations Pages

| Page | Purpose |
|------|---------|
| `/prep` | Dashboard with links to all prep operations |
| `/prep/stocktake` | Weekly stocktake entry with inline count inputs |
| `/prep/ordering` | Ordering list by supplier and staff |
| `/prep/batching` | Batch tasks with ingredients and methods |
| `/prep/ingredients` | Ingredient prep list (sub-recipes by batch) |
| `/scaler` | Recipe scaler for constraint-based scaling |
| `/feedback` | Staff feedback submission form |

### Stocktake Workflow

The `/prep/stocktake` page provides a unified interface for the weekly stocktake workflow:

1. **Enter Counts** - Inline number inputs with auto-save (300ms debounce)
2. **Clear Weekly Count** - Reset all counts for new stocktake session
3. **Generate Ordering & Prep Sheets** - One-click workflow:
   - Finalize stocktake (set Confirmed=true)
   - Generate prep run (shortfalls → Prep Tasks → Ingredient Requirements)
   - Trigger export (sets `Export Request State = "REQUESTED"` for GAS polling)

The workflow replicates GAS script logic in Next.js for faster execution and better error handling.

### Environment Variables

```env
# Supabase (Vector DB)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Claude API
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# OpenAI (embeddings)
OPENAI_API_KEY=sk-proj-...

# Airtable
AIRTABLE_BASE_ID=appNsFRhuU47e9qlR
AIRTABLE_PAT=pat...

# Recipe Sync
RECIPE_SYNC_SECRET=<secret>
```

### Database Schema (Supabase)

| Table | Purpose | Records |
|-------|---------|---------|
| `rag_documents` | Document metadata | ~1,000+ |
| `rag_chunks` | Text chunks + embeddings (1536 dims) | ~87,000+ |
| `rag_categories` | Category taxonomy | 16 |
| `search_analytics` | Query logs for optimization | Growing |
| `search_feedback` | User feedback on results | Growing |

### Search Strategies

| Strategy | When Used | Description |
|----------|-----------|-------------|
| **Vector** | Short queries (<4 words) | Pure semantic similarity |
| **Hybrid** | Longer queries (≥4 words) | 70% vector + 30% full-text |
| **Smart** | Default | Auto-selects based on query |

### Recipe Sync (Phase 6)

Airtable recipes are automatically synced to RAG:

1. Create Airtable automation on Recipes table
2. Trigger calls `POST /api/sync/recipe` with recipe ID
3. Webhook fetches full recipe, converts to text, embeds, stores
4. Recipe becomes searchable in knowledge base

Documentation: [docs/AIRTABLE-RECIPE-SYNC.md](docs/AIRTABLE-RECIPE-SYNC.md)

### Optimization (Phase 7)

| Optimization | Implementation |
|--------------|----------------|
| IVFFlat index | 300 lists (optimal for 90K chunks) |
| Query caching | 15-min TTL, in-memory |
| Hybrid search | Vector + full-text combined |
| Analytics | Latency, similarity, popular queries |

SQL migration: [supabase/migrations/002_optimize_search.sql](prep-knowledge-platform/supabase/migrations/002_optimize_search.sql)

---

### Data Flow

```
Airtable Database
    ↓
Google Apps Script Automation (scripts/)
    ↓
Generated Google Docs + Slack Notifications
```

---

## Core Scripts

All production scripts are located in [scripts/](scripts/).

### 1. ClearWeeklyCount.gs
**Location:** [scripts/ClearWeeklyCount.gs](scripts/ClearWeeklyCount.gs)

**Purpose:** Initialize new stocktake session

**Version:** 2.0 (with audit logging)

**Functionality:**
- Resets Weekly Counts table for new stocktake
- Creates placeholder records for all active items
- Optional: Preserve previous verified stocktakes
- Filters by item type: Batch, Sub Recipe, Garnish, Other
- Supports dry-run mode

**Configuration:**
- Tables: Items, Weekly Counts, Audit Log
- Time Zone: Australia/Sydney
- Batch Size: 50 records
- Default: Does NOT preserve verified stocktakes

**Automation URL:**
```
https://airtable.com/appNsFRhuU47e9qlR/wflUDx6hYwgLNbChL
```

---

### 2. FinaliseCount.gs
**Location:** [scripts/FinaliseCount.gs](scripts/FinaliseCount.gs)

**Purpose:** Validate and finalize stocktake

**Version:** 2.0 (with audit logging + recipe validation)

**Functionality:**
- Validates Weekly Counts stocktake data
- Sets `Confirmed = true` on verified counts
- Normalizes Count Date to midnight
- Validates recipe integrity (WARNING mode)
- Checks for missing items in recipes
- Updates Count Source to "Stocktake (Verified)"

**Validation Checks:**
- Items must have valid links
- Stock counts must be present
- Recipe validation (optional):
  - Sub Recipe items must have recipes
  - Recipe components must exist as items
  - Recipe yields must be defined

**Configuration:**
- Batch Size: 50 records
- Max Blank Items to Show: 25
- Max Recipe Issues to Show: 25

**Automation URL:**
```
https://airtable.com/appNsFRhuU47e9qlR/wflsb2UqWDxsAYW6o
```

---

### 3. GeneratePrepRun.gs
**Location:** [scripts/GeneratePrepRun.gs](scripts/GeneratePrepRun.gs)

**Purpose:** Generate prep tasks from stocktake shortfalls

**Version:** 2.0 (with audit logging + buffer multiplier)

**Functionality:**
- Finds latest verified stocktake
- Calculates shortfalls (Par Level - Current Stock)
- Generates Prep Tasks for items to produce
- Calculates batches needed based on recipe yields
- Generates Ingredient Requirements (BOM explosion)
- Buffer Multiplier support (e.g., 150% suggestion)
- Suggested Qty field calculation
- Supports rebuild mode for same stocktake
- Prevents duplicate runs (unless allowed)

**Algorithm:**
1. Query latest verified Weekly Counts
2. Load Par Levels for all items
3. Calculate shortfall for each item
4. For shortfall items:
   - Find recipe that produces item
   - Calculate batches needed (shortfall / yield)
   - Create Prep Task
5. For each Prep Task:
   - Load recipe lines (ingredients)
   - Calculate total ingredient qty needed
   - Create/update Ingredient Requirements
6. Group requirements by supplier + ordering staff

**Buffer Multiplier:**
- Optional per-item field: "Buffer Multiplier"
- Default: 1.0 (100%)
- Example: 1.5 = suggest 150% of target
- Writes to: "Suggested Qty (Buffer)" field

**Configuration:**
- Batch Size: 50 records
- Supports dry-run mode
- Allows duplicate detection override
- Captures audit trail with user info

**Automation URL:**
```
https://airtable.com/appNsFRhuU47e9qlR/wflKrpnwrRcgizAZ5
```

---

### 4. GeneratePrepSheet.gs
**Location:** [scripts/GeneratePrepSheet.gs](scripts/GeneratePrepSheet.gs)

**Purpose:** Export request processor (Airtable to Google Apps Script webhook)

**Version:** 2.0 (with audit logging + hardcoded webhook)

**Functionality:**
- Polls "Prep Run Requests" table for pending exports
- Calls Google Apps Script webhook with requestId
- Updates request status (Pending -> Processing -> Done/Failed)
- Logs execution to Audit Log
- Processes up to maxRequests per run (default: 1)

**Status Flow:**
```
Pending -> Processing -> Done
                     \-> Failed (on error)
```

**Configuration:**
- Webhook URL from Script Properties: `GOOGLE_APPS_SCRIPT_WEBHOOK`
- Max Requests: 1 (configurable)
- Dry-run mode available

**Automation URL:**
```
https://airtable.com/appNsFRhuU47e9qlR/wflTYAUhRJxDP7OLd
```

---

### 5. GoogleDocsPrepSystem.gs
**Location:** [scripts/GoogleDocsPrepSystem.gs](scripts/GoogleDocsPrepSystem.gs)

**Purpose:** Export prep run to 4 Google Docs + send Slack notifications + unified web app router

**Version:** 4.6 — Negligible Stock Decrements

**Version History:**
- **v4.6:** Added Negligible Stock Decrements section to Gooch and Sabs ordering docs
- **v4.5:** Unified doGet router - single deployment serves both Feedback Form and Recipe Scaler
- **v4.4:** Added Feedback Form system with AI triage
- **v4.3:** Fixed empty blocks in generated documents
- **v4.2:** Hybrid approach - templates for branding, code for content. Fixes nested loop limitation.
- **v4.1:** Element-based template engine (attempted nested loops)
- **v4.0:** Template-based document generation with branded styling, programmatic fallback
- **v3.0:** 1.5x buffer multiplier applied to ALL ingredients and batches

**Unified Web App Router (v4.5):**

The script contains a unified `doGet()` function that routes to either the Feedback Form or Recipe Scaler based on URL parameters:

```javascript
function doGet(e) {
  const page = (e.parameter.page || 'feedback').toLowerCase();
  if (page === 'scaler') {
    return doGetRecipeScaler(e);  // From RecipeScaler.gs
  } else {
    return doGetFeedback(e);      // From FeedbackForm.gs
  }
}
```

**URL Routing:**
- Base URL → Feedback Form (default)
- Base URL + `?page=scaler` → Recipe Scaler

This allows a **single deployment** to serve both web apps, simplifying configuration and management.

**Output Documents:**

1. **Ingredient Prep List**
   - Sub Recipe tasks grouped by Batch
   - Shows what needs to be made
   - Target: Prep team

2. **Batching List**
   - Batch tasks with ingredient bullets
   - Includes method/instructions
   - Target: Prep team

3. **Gooch Ordering List**
   - Grouped by supplier
   - Gooch's ordering responsibilities
   - Includes "Negligible Stock Decrements" section at the bottom (items ≤5% of order unit size)
   - Target: Gooch

4. **Sabs Ordering List**
   - Grouped by supplier
   - Sabs' ordering responsibilities
   - Includes "Negligible Stock Decrements" section at the bottom (items ≤5% of order unit size)
   - Target: Sabs

**Hybrid Template Engine (v4.2):**

The script uses a **hybrid approach**:
- **Templates provide:** Header branding, logo, styling, fonts
- **Code provides:** All dynamic content (suppliers, items, batches, etc.)

This avoids Google Docs API limitations with nested loops while enabling branded documents.

**How it works:**
1. Check if template ID exists in Script Properties
2. If template exists:
   - Copy template to new document
   - Replace header placeholders (DATE, RUN_LABEL, STAFF_NAME)
   - Find `{{CONTENT}}` marker and remove it
   - Append all dynamic content programmatically at that position
3. If template missing, use full programmatic generation

**Template Format:**
```
┌─────────────────────────────────────────────────────┐
│  [LOGO]                                             │
│  {{STAFF_NAME}} Ordering List                       │  ← Header section
│  {{DATE}} • {{RUN_LABEL}}                           │    (from template)
├─────────────────────────────────────────────────────┤
│  {{CONTENT}}                                        │  ← Content marker
│                                                     │    (replaced by code)
└─────────────────────────────────────────────────────┘
```

**Supported Placeholders:**
```
{{DATE}}        - Formatted date (e.g., "Monday, 3 February 2026")
{{RUN_LABEL}}   - Prep run label (e.g., "2026-02-03")
{{STAFF_NAME}}  - Staff name (e.g., "GOOCH", "SABS")
{{CONTENT}}     - Marker where dynamic content is inserted
```

**Template Tips:**
- Design the header with your logo, colors, and fonts
- Place `{{CONTENT}}` on its own line where content should appear
- Everything after `{{CONTENT}}` becomes a footer
- Keep templates simple - all complex content is code-generated

**Buffer Multiplier:**
- Global 1.5x multiplier applied to all quantities
- Format: `100ml (1.5× = 150ml)`
- Bold + underline formatting on base quantity

**Poll-Based Export Processor:**

The script includes a time-trigger polling function for automated exports:

```javascript
function processPrepRunExportRequests()
```

- Set up as Google Apps Script time-trigger (e.g., every 5 minutes)
- Polls Prep Runs table for `Export Request State = "REQUESTED"`
- Processes oldest request first
- Updates state: `REQUESTED` → `IN_PROGRESS` → `DONE`/`FAILED`

Airtable Fields for Export:
- `Export Request State` (single select: REQUESTED, IN_PROGRESS, DONE, FAILED)
- `Export Mode` (LIVE or TEST)
- `Export Notify Slack` (checkbox)
- `Export Requested At` (date)
- `Export Finished At` (date)
- `Export Last Error` (text)
- `Export Last Result` (long text - JSON)

**Slack Notifications:**

**LIVE Mode:**
- Kalisha channel: all 4 docs + folder link
- Evan channel: all 4 docs + folder link
- Gooch channel: all 4 docs + folder link
- Sabs channel: all 4 docs + folder link
- Prep channel: Ingredient Prep + Batching + folder link

**TEST Mode:**
- ALL docs + folder link → `SLACK_WEBHOOK_EV_TEST` only
- No team channel notifications

**Airtable Integration:**
- Writes folder URL back to Prep Runs table
- Field: "Link to Prep Guides"

**Manual Trigger:**
- Deploy as Web App
- POST to `/exec` with:
  ```json
  {
    "secret": "<MANUAL_TRIGGER_SECRET>",
    "runId": "<record_id>",
    "mode": "LIVE" | "TEST",
    "notifySlack": true | false
  }
  ```

**Configuration:**
- Time Zone: Australia/Sydney
- Docs Folder: Specified by `DOCS_FOLDER_ID`

---

### 6. RecipeScaler.gs
**Location:** [scripts/RecipeScaler.gs](scripts/RecipeScaler.gs)

**Purpose:** Constraint-based recipe scaling during prep shifts

**Version:** 1.1 (unified router integration)

**Functionality:**
- Scale recipes based on available ingredient quantities
- "Reverse scaling" - enter how much of one ingredient you have, get scaled quantities for everything else
- Mobile-friendly web interface
- Links embedded in Batching List for quick access

**Use Case Example:**
> Recipe calls for 30ml Wasabi Oil, but you only have 4ml available.
> Enter "4ml" as the constraint, and the scaler calculates scaled quantities for all other ingredients and the final yield.

**Entry Point:**
- `doGetRecipeScaler(e)` - Serves the Recipe Scaler HTML page
- Called by the unified `doGet()` router in GoogleDocsPrepSystem.gs when `?page=scaler`

**API Functions:**
- `getRecipeList()` - Returns all recipes for dropdown
- `getRecipeDetails(recipeId)` - Returns recipe with ingredients
- `calculateScaledRecipe(recipeId, constraintIngredientId, availableQty)` - Performs scaling

**Access:**
The Recipe Scaler is served via the unified web app deployment:
- URL: `<deployment-url>?page=scaler`
- Set `RECIPE_SCALER_URL` to the same deployment URL as `FEEDBACK_FORM_URL`

**URL Parameters:**
- `?page=scaler` - **Required** to route to Recipe Scaler
- `?recipeId=recXXX` - Pre-select recipe by Airtable record ID
- `?recipe=RecipeName` - Pre-select recipe by name (partial match)

---

### 7. FeedbackForm.gs
**Location:** [scripts/FeedbackForm.gs](scripts/FeedbackForm.gs)

**Purpose:** Staff feedback collection with AI triage

**Version:** 1.1 (unified router integration)

**Functionality:**
- Web app form for staff to submit feedback from generated docs
- Pre-filled context from URL parameters (prep run, doc type, staff role)
- Item and recipe autocomplete search
- AI triage to categorize feedback and suggest actions
- Sends Slack notification to `SLACK_WEBHOOK_EV_TEST`
- Logs to Airtable Feedback table

**Entry Point:**
- `doGetFeedback(e)` - Serves the Feedback Form HTML page
- Called by the unified `doGet()` router in GoogleDocsPrepSystem.gs (default route)

**Feedback Types:**
- Missing Data - Missing items or ingredients
- Recipe Issue - Wrong quantities, missing steps
- Suggestion - General improvement ideas
- Other - Anything else

**AI Triage Categories:**
- Data Fix - Issues with Items, Recipes, or Par Levels
- Recipe Update - Issues with Recipe Lines or Methods
- General - Suggestions and other feedback

**API Functions:**
- `getFormConfig()` - Returns dropdown options
- `searchItems(query)` - Autocomplete search for items
- `searchRecipes(query)` - Autocomplete search for recipes
- `submitFeedback(data)` - Main submission: validate → triage → Airtable → Slack

**Access:**
The Feedback Form is served via the unified web app deployment:
- URL: `<deployment-url>` (default, no page parameter needed)
- Set `FEEDBACK_FORM_URL` to the deployment URL

**URL Parameters:**
- `?prepRunId=recXXX` - Pre-fill prep run context
- `?docType=Batching List` - Pre-fill document type
- `?staffRole=Prep Team` - Pre-fill staff role

**Integration:**
- Feedback links automatically appear at the top of generated documents
- Links include context parameters for seamless submission

---

## Configuration

### Script Properties

All scripts require these Script Properties (Google Apps Script → Project Settings → Script Properties):

**Required:**
```
AIRTABLE_BASE_ID = appNsFRhuU47e9qlR
AIRTABLE_PAT = <your-airtable-pat>
DOCS_FOLDER_ID = <your-drive-folder-id>
```

**Slack Webhooks (LIVE):**

Each individual receives all 4 docs (Gooch Ordering, Sabs Ordering, Ingredient Prep, Batching).
Prep Channel receives only the prep docs (Ingredient Prep + Batching).

```
SLACK_WEBHOOK_KALISHA = https://hooks.slack.com/services/...  ← all 4 docs
SLACK_WEBHOOK_EVAN    = https://hooks.slack.com/services/...  ← all 4 docs
SLACK_WEBHOOK_GOOCH   = https://hooks.slack.com/services/...  ← all 4 docs
SLACK_WEBHOOK_SABS    = https://hooks.slack.com/services/...  ← all 4 docs
SLACK_WEBHOOK_PREP    = https://hooks.slack.com/services/...  ← Ingredient Prep + Batching only
```

**Slack Webhook (TEST):**
```
SLACK_WEBHOOK_EV_TEST = https://hooks.slack.com/services/...
```

**Optional - Manual Trigger:**
```
MANUAL_TRIGGER_SECRET = <your-secret>
```

**Optional - Template IDs (v4.0+):**
```
TEMPLATE_ORDERING_ID = <google-doc-id>       # Ordering list template
TEMPLATE_BATCHING_ID = <google-doc-id>       # Batching list template
TEMPLATE_INGREDIENT_PREP_ID = <google-doc-id> # Ingredient prep template
```

Templates are Google Docs with placeholder syntax (see GoogleDocsPrepSystem.gs section).

**Optional - Web Apps (Unified Deployment):**
```
FEEDBACK_FORM_URL = <deployed-web-app-url>   # Base deployment URL
RECIPE_SCALER_URL = <deployed-web-app-url>   # Same URL as FEEDBACK_FORM_URL
```

**Important:** Both URLs should be set to the **same deployment URL**. The unified `doGet()` router handles routing:
- `FEEDBACK_FORM_URL` → Links to base URL (shows Feedback Form)
- `RECIPE_SCALER_URL` → Links include `?page=scaler` parameter (shows Recipe Scaler)

When set:
- "Have feedback? Submit here" links appear at the top of all generated documents
- "Scale this recipe" links appear in Batching List documents
- Feedback notifications are sent to `SLACK_WEBHOOK_EV_TEST`

If template IDs are not set or templates are missing, the script falls back to programmatic document generation.

**Credentials Location:**
Actual values stored in [config/GoogleDocsPrepSystemScriptProperties](config/GoogleDocsPrepSystemScriptProperties) (gitignored)

### clasp Deployment

The `scripts/` folder is configured for Google Apps Script deployment using clasp.

**Configuration Files:**
- [scripts/.clasp.json](scripts/.clasp.json) - Links to Google Apps Script project
- [scripts/appsscript.json](scripts/appsscript.json) - Apps Script manifest
- [scripts/.claspignore](scripts/.claspignore) - Excludes Airtable-only scripts

**Script ID:** `1ALLTzQ44TDvekiQ2phF2tCKnbdNPmzbGqR6rGDL6scOIgI5aszJAWfEM`

**Deployment Commands:**
```bash
cd scripts/

# Login to Google (first time or if token expired)
clasp login

# Push local changes to Google Apps Script
clasp push

# Force push (overwrite remote)
clasp push --force

# Pull remote changes to local
clasp pull

# Check tracked files
clasp status

# Open script in browser
clasp open
```

**Files Pushed to Google Apps Script:**
- `appsscript.json` - Project manifest
- `GoogleDocsPrepSystem.gs` - Main export script
- `FeedbackForm.gs` - Feedback collection web app backend
- `FeedbackFormUI.html` - Feedback form web app UI
- `RecipeScaler.gs` - Recipe scaling web app backend
- `RecipeScalerUI.html` - Recipe scaling web app UI

**Files Ignored (Airtable-only scripts):**
- `ClearWeeklyCount.gs`
- `FinaliseCount.gs`
- `GeneratePrepRun.gs`
- `GeneratePrepSheet.gs`
- `GoogleDocsPrepSystem_TestHarness.gs`

---

## Airtable Structure

**Required Tables:**
- Items
- Recipes
- Recipe Lines
- Par Levels
- Weekly Counts
- Prep Runs
- Prep Tasks
- Ingredient Requirements
- Prep Run Requests
- Supplier
- Audit Log
- Feedback

**Key Fields:**

**Items:**
- Item Name
- Item Type (Batch | Sub Recipe | Garnish | Other)
- Active (checkbox)
- Unit
- Supplier (link)
- Buffer Multiplier (number, default 1.0)

**Weekly Counts:**
- Item (link to Items)
- Stock Count (number)
- Count Date (date)
- Count Source (single select)
- Confirmed (checkbox)

**Par Levels:**
- Item Link (link to Items)
- Par Qty (number)

**Recipes:**
- Item Name (link to Items) - what this recipe produces
- Yield Qty (number)

**Recipe Lines:**
- Recipe (link to Recipes)
- Item (link to Items) - ingredient
- Qty (number)

**Prep Tasks:**
- Prep Run (link)
- Item Needed (link to Items)
- Recipe Used (link to Recipes)
- Target Qty (number)
- Batches Needed (number)
- Suggested Qty (Buffer) (number)
- Notes (text)

**Ingredient Requirements:**
- Prep Run (link)
- Item Link (link to Items)
- Total Qty Needed (number)
- Supplier Name (Static) (text)
- Ordering Staff (Static) (text)
- Order Size (Lookup) (number, from Items.Order Size) — used for negligible stock ratio
- Unit (Lookup) (text, from Items.Unit) — used for negligible stock display

**Prep Runs (Export Fields):**
- Link to Prep Guides (URL) - populated by export
- Export Request State (single select: REQUESTED, IN_PROGRESS, DONE, FAILED)
- Export Mode (single select: LIVE, TEST)
- Export Notify Slack (checkbox)
- Export Requested At (date)
- Export Finished At (date)
- Export Last Error (text)
- Export Last Result (long text - JSON)

**Audit Log:**
- Timestamp (date)
- Script Name (single select)
- Status (single select: Success | Warning | Error)
- Message (text)
- Details (long text)
- User (text)
- Execution Time (seconds) (number)
- Error Stack (long text)
- Config Used (long text)

**Feedback:**
- Prep Run (link to Prep Runs)
- Doc Type (single select: Ingredient Prep List | Batching List | Gooch Ordering | Sabs Ordering)
- Staff Name (text)
- Staff Role (single select: Prep Team | Ordering - Gooch | Ordering - Sabs | Manager | Other)
- Feedback Type (single select: Missing Data | Recipe Issue | Suggestion | Other)
- Description (long text)
- Item Reference (link to Items) - optional
- Recipe Reference (link to Recipes) - optional
- AI Category (single select: Data Fix | Recipe Update | General)
- AI Suggestion (long text)
- AI Confidence (number 0-100)
- Item Exists Check (checkbox)
- Found Recipe Line (link to Recipe Lines)
- Status (single select: New | In Review | Actioned | Resolved | Dismissed)
- Slack Notified (checkbox)
- Created At (date)
- Notes (long text) - admin notes

---

## Workflow

### Weekly Prep Cycle

**Saturday Morning:**
1. Run `ClearWeeklyCount` automation
   - Resets Weekly Counts
   - Creates placeholder records

**Saturday-Sunday:**
2. Staff conduct physical stocktake
   - Update Stock Count values in Weekly Counts table
   - Mark items as counted

**Monday Morning:**
3. Run `FinaliseCount` automation
   - Validates stocktake data
   - Sets Confirmed = true
   - Marks as "Stocktake (Verified)"

**Monday Afternoon:**
4. Run `GeneratePrepRun` automation
   - Calculates shortfalls
   - Creates Prep Tasks
   - Creates Ingredient Requirements

5. Create Prep Run Request (Interface button)
   - Creates record in Prep Run Requests
   - Status: Pending

6. Run `GeneratePrepSheet` automation
   - Picks up pending request
   - Calls GoogleDocsPrepSystem webhook
   - Updates status to Processing

7. GoogleDocsPrepSystem executes
   - Creates 4 Google Docs
   - Writes folder URL to Airtable
   - Sends Slack notifications
   - Updates request status to Done

**Tuesday-Friday:**
8. Teams execute prep tasks
   - Gooch/Sabs order ingredients
   - Prep team makes batches/sub-recipes

---

## Reference Materials

The [reference/](reference/) folder contains external tools and frameworks for development. Pruned to Claude + Airtable resources only (2026-03-03).

### Claude Tools (reference/claude-tools/)

Large collection (3.2GB) of Claude Code skills, frameworks, and development tools including Thinking-Claude, claudekit-skills, compound-engineering-plugin, development_tools, and others.

### Automation (reference/automation/)

**[awesome-n8n-templates/Airtable/](reference/automation/awesome-n8n-templates/Airtable/)**
- Airtable-specific n8n workflow templates only (other categories removed)

---

## Security Notes

**Sensitive Files (gitignored):**
- [config/GoogleDocsPrepSystemScriptProperties](config/GoogleDocsPrepSystemScriptProperties) - Contains:
  - Airtable API token (PAT)
  - Slack webhook URLs
  - Google Drive folder IDs
  - Manual trigger secrets

- [config/airtableautomationURLs](config/airtableautomationURLs) - Contains:
  - Airtable automation webhook URLs

**Security Measures:**
1. `.gitignore` protects all files in `config/`
2. Store production credentials in:
   - Google Apps Script -> Project Settings -> Script Properties
   - Airtable -> Automations -> Environment variables
3. Rotate credentials if exposed publicly
4. Never commit actual credential values to documentation

---

## Audit Logging

All v2.0 scripts include comprehensive audit logging:

**Logged Information:**
- Timestamp (Sydney time)
- Script Name
- Status (Success | Warning | Error)
- Message (summary)
- Details (full execution log)
- User (from Last Modified By)
- Execution Time (seconds)
- Error Stack (if failed)
- Config Used (script configuration)

**Benefits:**
- Troubleshooting execution failures
- Performance monitoring
- Compliance and accountability
- Historical analysis of prep runs

---

## Testing

**Dry-Run Mode:**
All automation scripts support `dryRun: true` parameter:
- Validates logic without making changes
- Logs what WOULD happen
- Useful for testing configuration changes

**Test Mode (GoogleDocsPrepSystem):**
- Set `SLACK_WEBHOOK_EV_TEST` in Script Properties
- Use `exportLatestPrepRunToDocs_TEST()` function
- Sends all notifications to test webhook only
- Does NOT notify team channels

**Test Harness:**
- [scripts/GoogleDocsPrepSystem_TestHarness.gs](scripts/GoogleDocsPrepSystem_TestHarness.gs)
- Isolated testing environment for doc generation

**Manual Triggers:**
- Use Airtable Interface buttons
- Override automation inputs
- Test specific edge cases

---

## Troubleshooting

### Common Issues

**Issue:** Stocktake not appearing in GeneratePrepRun
- **Check:** FinaliseCount was run
- **Check:** Count Source = "Stocktake (Verified)"
- **Check:** Confirmed = true

**Issue:** Missing ingredients in requirements
- **Check:** Recipe Lines exist for all recipes
- **Check:** Recipe yields are defined
- **Check:** Items are Active

**Issue:** Slack notifications not sent
- **Check:** Script Properties contain webhook URLs
- **Check:** Mode is LIVE (not TEST)
- **Check:** notifySlack = true in trigger

**Issue:** Google Docs not created
- **Check:** DOCS_FOLDER_ID is correct
- **Check:** Script has access to Drive folder
- **Check:** Prep Run exists in Airtable

### Debug Process

1. Check Audit Log table for errors
2. Run with `dryRun: true` to validate logic
3. Use TEST mode for Slack/Docs creation
4. Verify Script Properties are set
5. Check Airtable field names match CONFIG constants

---

## Future Enhancements

**Potential Improvements:**
- [ ] Automated stocktake integration (barcode scanning)
- [ ] Supplier order automation (API integrations)
- [ ] Prep progress tracking (real-time updates)
- [ ] Cost calculation (ingredient pricing)
- [ ] Waste tracking (actual vs. planned)
- [ ] Historical analytics (prep efficiency trends)
- [ ] Mobile app for stocktake entry
- [ ] Predictive par level adjustments
- [ ] Multi-location support
- [ ] Allergen tracking and labeling
- [ ] Xero accounting integration

---

## Support

For issues or questions:
1. Check Audit Log table in Airtable
2. Review this documentation
3. Test with dry-run mode
4. Contact system administrator

---

## Version History

**v6.0 (PREP SUPER AGENT):**
- Transformed PREP AGENT into PREP SUPER AGENT architecture
- Connected `/api/chat` as primary endpoint (Claude Sonnet 4)
- Deprecated `/api/prep/chat` (was using Haiku with 256 tokens)
- Full RAG integration with 87K+ document chunks
- 15+ operational tools for real workflow actions
- Conversation memory for context persistence
- Sub-agent orchestration for complex tasks
- Proactive intelligence and trend detection
- Role-based guidance for different staff types
- Comprehensive error handling and recovery

**v5.7 (PREP Operations UI - Stocktake Page):**
- Added `/prep/stocktake` page with inline count inputs and auto-save
- Added `/api/prep/counts` endpoint (GET/PATCH for stocktake counts)
- Added `/api/prep/counts/clear` endpoint (reset weekly counts)
- Added `/api/prep/workflow/generate` endpoint (full workflow orchestration)
- One-click workflow: Finalize → Generate Prep Run → Trigger Export
- BOM explosion for sub-recipes and ingredient requirements
- Dashboard updated with Weekly Stocktake card (green highlight)
- Replicates GAS script logic in Next.js for faster execution

**v5.6 (Knowledge Platform - Phase 7 Optimization):**
- Enhanced search library with 15-minute query caching
- Smart search auto-selects vector vs hybrid strategy
- Hybrid search: 70% vector similarity + 30% full-text
- Search analytics endpoint for performance monitoring
- Feedback tracking for search quality improvement
- IVFFlat index tuned for 90K chunks (300 lists)
- SQL migration: `supabase/migrations/002_optimize_search.sql`

**v5.5 (Knowledge Platform - Phase 6 Recipe Sync):**
- Recipe sync webhook: `/api/sync/recipe`
- Airtable automation integration for automatic sync
- Incremental RAG ingestion with upsert support
- Recipe-to-text conversion (ingredients, method, yield)
- Bulk sync endpoint: `GET /api/sync/recipe?all=true`
- Documentation: `docs/AIRTABLE-RECIPE-SYNC.md`

**v5.4 (LLM & Supabase Integration):**
- Added Supabase MCP for PostgreSQL analytics layer
- Added supabase-js client SDK reference
- Added awesome-llm-apps patterns library
- Hybrid architecture: Airtable (operational) + Supabase (analytics)
- RAGfiles integration for enhanced context retrieval
- A4 capability summary: [docs/PREP-AGENT-A4-SUMMARY.md](docs/PREP-AGENT-A4-SUMMARY.md)

**v5.3 (PREP AGENT - Phase 4 Complete):**
- Added testing-framework for comprehensive test suites
- Added monitoring-dashboard for system health tracking
- Added health-check for automated validation
- Added staff-guide for end-user documentation
- Smoke tests, full test suites, dry-run modes
- Alerting integration with Slack
- 13 total specialized agents (all phases complete)

**v5.2 (PREP AGENT - Phase 2 & 3 Complete):**
- Added decision-engine for automated workflow decisions
- Added analytics-engine for predictive par level optimization
- Added feedback-processor for automated feedback handling
- Cross-agent integration: analytics → decisions → orchestrator
- Confidence-based action thresholds
- Weekly analytics reports and feedback digests
- 9 total specialized agents for full workflow automation

**v5.0 (PREP AGENT - Phase 1 Foundation):**
- Added PREP AGENT AI orchestration layer
- 6 specialized agents for workflow coordination
- MCP configuration for Airtable integration
- Workflow state machine definition
- Natural language query handling
- Error taxonomy and recovery procedures
- Agent directory: `.claude/agents/prep-system/`

**v4.6 (Current - GoogleDocsPrepSystem):**
- Added "Negligible Stock Decrements" section to Gooch and Sabs ordering docs
- Items where `Total Qty Needed / Order Size ≤ 5%` are flagged (likely have stock on hand)
- Grouped by supplier within the section; shows `Xunit needed / Yunit unit = Z%` per item
- Items with missing Order Size remain in the main ordering list (safe default)
- Threshold constant `CFG.negligibleRatioThreshold` for easy tuning
- Design doc: `docs/plans/2026-02-20-negligible-stock-decrements-design.md`

**v4.5 (GoogleDocsPrepSystem):**
- Unified `doGet()` router - single deployment serves both web apps
- URL-based routing: base URL → Feedback Form, `?page=scaler` → Recipe Scaler
- Simplified deployment configuration (one URL for both apps)
- Both `FEEDBACK_FORM_URL` and `RECIPE_SCALER_URL` now point to same deployment

**v4.4 (GoogleDocsPrepSystem):**
- Added Feedback Form system (FeedbackForm.gs + FeedbackFormUI.html)
- Staff can submit feedback from generated documents
- AI triage categorizes feedback and suggests actions
- Slack notifications to admin channel (`SLACK_WEBHOOK_EV_TEST`)
- Airtable Feedback table for tracking
- "Have feedback? Submit here" links in all generated docs

**v4.3 (GoogleDocsPrepSystem):**
- Fixed empty blocks appearing in generated documents
- Pre-filtering of batches/suppliers before rendering headings
- Aggressive cleanup of template Mustache markers ({{#...}}, {{/...}})
- Batches with no visible ingredients now excluded
- Batches with no sub-recipes now excluded from Ingredient Prep List

**v4.2 (GoogleDocsPrepSystem):**
- HYBRID APPROACH: Templates for branding, code for content
- Templates now only need header styling + `{{CONTENT}}` marker
- All dynamic content handled programmatically (reliable)
- Fixes Google Docs API nested loop limitation
- Simpler templates, more maintainable code

**v4.1 (GoogleDocsPrepSystem):**
- Element-based template engine (attempted nested loops)
- Bold/underline quantity formatting
- Poll-based export processor for automated triggers

**v4.0 (GoogleDocsPrepSystem):**
- Template-based document generation with branded styling
- Falls back to programmatic generation if templates missing
- New Script Properties for template IDs

**v3.0 (GoogleDocsPrepSystem):**
- 1.5x buffer multiplier applied to ALL ingredients and batches
- Buffer format: "3862.07ml (1.5× = 5793.10ml)"

**v2.2 (System):**
- Added templates/ folder for Google Docs templates
- Moved COMPREHENSIVE_REPOSITORY_GUIDE.md to reference/
- Added Recipe Scaler (RecipeScaler.gs + RecipeScalerUI.html)
- Updated all README documentation files
- Cleaned up folder architecture

**v2.1 (System):**
- Reorganized folder architecture
- Added reference materials library
- Improved security with gitignore
- Updated documentation structure
- clasp deployment setup for Google Apps Script

**v2.0 (Airtable Scripts):**
- Audit logging for all scripts
- Buffer Multiplier support (per-item)
- Enhanced progress indicators
- Recipe integrity validation
- User attribution tracking
- Detailed execution metrics

**v1.0:**
- Initial system implementation
- Basic stocktake → prep run workflow
- Google Docs export
- Slack notifications

---

## Recent Changes

### 2026-03-03 — Reference Directory Cleanup

**`Sakura House/reference/` pruned to Claude + Airtable resources only:**
- Removed `integrations/` (airtable-mcp2, python-slack-sdk, xero-mcp-server, supabase-mcp, supabase-js)
- Removed `llm-patterns/` (awesome-llm-apps)
- Removed `automation/ohmyzsh/`
- Removed `automation/awesome-n8n-templates/` non-Airtable categories (kept `Airtable/` only)
- Removed `COMPREHENSIVE_REPOSITORY_GUIDE.md`
- Retained: `claude-tools/` (3.2GB), `automation/awesome-n8n-templates/Airtable/`

**Docs updated:** Folder Architecture tree and Reference Materials section in this file updated to reflect cleanup.

---

### 2026-03-03 — Agent Instruction Enhancements (no system code changed)

**Agent files updated (`.claude/agents/*.md`):**
- `gas-code-review-agent.md` — added GAS runtime constraints (P0: no `fetch()`/`require()`), web app security rules, GAS tooling reference (gas-local, QUnitGS2, clasp-token-action, BetterLog)
- `rag-knowledge-agent.md` — added Hybrid Search Pattern, CRAG Pattern, Supabase MCP sections; pgvector index strategy (ivfflat vs hnsw) and chunk sizing guidance
- `knowledge-platform-agent.md` — added CRAG, Memory Persistence, Multi-MCP sections; system prompt quality checklist (injection defense, CoT, anti-patterns)
- `sakura-prep-agent.md` — added GAS web app patterns (`doGet`, param sanitization), library dependency fix reference
- `prep-orchestrator.md` — added SPARC Planning Protocol; agent concurrency rules / compatibility matrix
- `slack-ordering-agent.md` — added Block Kit builder section
- `recipe-scaler-agent.md` — added full web app entry point and deployment reference
- `documentation-agent.md` — added CLAUDE.md Health Check procedure
- `deployment-agent.md` — added CI/CD GitHub Actions reference (clasp-token-action)
- `airtable-mcp-agent.md` — **NEW agent created** for live Airtable data access via MCP2 server (33+ tools)

**Key note for future sessions:**
- All of the above are agent instruction files only — no GAS scripts or Airtable automations were modified
- `airtable-mcp-agent` is now available for direct Airtable record queries via MCP; routing rule added to main CLAUDE.md

---

## License

Proprietary system for internal use.

---

*Last Updated: 2026-03-03*
*Documentation Generated by: Claude Code*
