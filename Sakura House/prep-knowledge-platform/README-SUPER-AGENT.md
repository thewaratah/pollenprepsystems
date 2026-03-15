# PREP SUPER AGENT

**The Intelligent Operations Hub for Sakura House Kitchen**

PREP SUPER AGENT is an AI-powered assistant that combines real-time operational data with a comprehensive knowledge base to help staff with prep operations, recipe queries, food science questions, and workflow management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PREP SUPER AGENT                             │
│                    (Claude Sonnet 4)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │   MEMORY LAYER      │      │    RAG KNOWLEDGE    │          │
│  │   (Supabase)        │      │    (138,862 chunks) │          │
│  ├─────────────────────┤      ├─────────────────────┤          │
│  │ • Episodic Memory   │      │ • 1,951 documents   │          │
│  │ • Semantic Memory   │      │ • 16 categories     │          │
│  │ • Working Memory    │      │ • Vector search     │          │
│  │ • ReasoningBank     │      │ • Hybrid retrieval  │          │
│  └─────────────────────┘      └─────────────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    TOOLS (7 Operations)                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ get_stocktake_status  │ lookup_recipe    │ scale_recipe │   │
│  │ get_prep_status       │ get_prep_tasks   │ get_ordering │   │
│  │ get_item_details      │                  │              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SWARM ORCHESTRATOR (13 Agents)             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## RAG Knowledge Base

**Total Statistics:**
- **Documents:** 1,951
- **Chunks:** 138,862
- **Categories:** 16
- **Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
- **Index:** IVFFlat with 300 lists (optimized for ~140K vectors)

### Knowledge Categories

#### Operational Knowledge (KB)

| Code | Category | Documents | Description |
|------|----------|-----------|-------------|
| KB-01 | House Recipes | 67 | Proprietary recipes, batches, ingredients, fermentation, R&D |
| KB-02 | Bar Standards | 54 | Cocktail specs, menus, brand standards, spirits |
| KB-03 | SOPs | 3 | Standard Operating Procedures |
| KB-04 | Training | 52 | Staff training, manuals, spirits training, testing |
| KB-05 | Supplier Specs | 64 | Equipment manuals, supplier documentation |
| KB-06 | Scientific | 25 | Distillation, fermentation, food science theory |

**Subtotal:** 265 documents

#### Reference Library (RF)

| Code | Category | Documents | Description |
|------|----------|-----------|-------------|
| RF-01 | Microbiology | 540 | Yeasts, bacteria, fungi, probiotics |
| RF-02 | Fermentation Science | 394 | Process engineering, starter cultures, theory |
| RF-03 | Beverages | 114 | Spirits, beer, wine, coffee, tea, sake |
| RF-04 | Dairy | 129 | Cheese, yogurt, dairy fermentation |
| RF-05 | Food Fermentation | 112 | Bread, vegetables, vinegar, soy, meat |
| RF-06 | Food Science | 207 | Chemistry, safety, nutrition, flavor |
| RF-07 | Processing Technology | 42 | Equipment, methods, industrial processes |
| RF-08 | Agriculture | 71 | Soil, gardening, foraging, composting |
| RF-09 | Reference | 50 | Dictionaries, protocols, handbooks |
| RF-10 | Practical Guides | 20 | Recipes, how-to, home fermentation |

**Subtotal:** 1,679 documents

#### Other

| Category | Documents |
|----------|-----------|
| Uncategorized | 7 |

---

## Memory System

The Super Agent uses a four-tier memory architecture for context persistence and self-learning:

### 1. Episodic Memory
- Stores full conversation histories by session
- Enables context awareness across messages
- Table: `conversation_sessions`

### 2. Semantic Memory
- Learns patterns from interactions (intents, entities, workflows, preferences)
- Improves response quality over time
- Table: `learned_patterns`

### 3. Working Memory
- Active session context
- Current workflow state
- Recent tool results

### 4. ReasoningBank
- Self-learning from successful interactions
- Vector similarity search for similar past queries
- Proactive insights generation
- Tables: `reasoning_chains`, `proactive_insights`

---

## Available Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `get_stocktake_status` | Current stocktake progress, coverage %, items remaining | "What's the stocktake status?" |
| `get_prep_status` | Active prep run info and completion | "How's prep going?" |
| `get_prep_tasks` | List all prep tasks with batch quantities | "What needs to be prepped?" |
| `get_ordering_list` | Ordering requirements by staff (Gooch, Sabs) | "What needs ordering?" |
| `lookup_recipe` | Recipe details, ingredients, method | "What's in the Mule batch?" |
| `scale_recipe` | Scale recipe by constraint ingredient | "Scale Ponzu for 50ml yuzu" |
| `get_item_details` | Item info: par level, stock, supplier | "Tell me about wasabi oil" |

---

## Swarm Orchestrator

The Super Agent can delegate to 13 specialized sub-agents for complex operations:

### Orchestration Layer (P0)
- **prep-workflow-orchestrator** - Central coordination for multi-step operations
- **workflow-states** - State machine validation
- **airtable-operations** - Direct Airtable data operations
- **prep-gas-developer** - Google Apps Script specialist

### Query & Intelligence (P1-P3)
- **query-handler** - Natural language query processing
- **error-coordinator** - Error handling and recovery
- **decision-engine** - Automated decisions based on confidence
- **analytics-engine** - Predictive analytics and trends
- **feedback-processor** - Staff feedback handling with AI triage

### Operations & Monitoring (P4)
- **testing-framework** - Test suites for validation
- **monitoring-dashboard** - System health monitoring
- **health-check** - Automated system validation
- **staff-guide** - End-user documentation and training

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Main Super Agent chat (streaming) |
| `/api/search` | POST | RAG knowledge search |
| `/api/stats` | GET | Knowledge base statistics |
| `/api/analytics/search` | GET | Search performance metrics |

### Chat Request Format

```json
{
  "messages": [
    { "role": "user", "content": "What's in the Mule batch?" }
  ]
}
```

### Response
Streaming text response with markdown formatting.

---

## Environment Variables

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# Supabase (RAG + Memory)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (Embeddings)
OPENAI_API_KEY=sk-proj-...

# Airtable (Operations)
AIRTABLE_BASE_ID=appNsFRhuU47e9qlR
AIRTABLE_PAT=pat...
```

---

## Example Queries

### Operational
- "What's the stocktake status?"
- "What needs to be prepped this week?"
- "What's Gooch's ordering list?"
- "Look up the Wasabi Mayo recipe"
- "Scale Ponzu to use only 50ml yuzu juice"

### Knowledge
- "Explain our house sugar syrup recipe (47.5 brix)"
- "What is a suitable replacement for citric acid?"
- "How can I prevent fermentation of non-alcoholic cocktails?"
- "What is the ABV of our Mule batch?"
- "Why do we bloom gelatin in cold water first?"
- "What's the Maillard reaction?"
- "How does lacto-fermentation preserve vegetables?"

---

## Database Schema

### Memory Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `conversation_sessions` | Episodic memory - conversation histories |
| `learned_patterns` | Semantic memory - learned patterns |
| `user_preferences` | User-specific preferences |
| `interaction_analytics` | Performance tracking |
| `reasoning_chains` | Self-learning with vector search |
| `proactive_insights` | AI-generated insights |

### RAG Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `rag_documents` | Document metadata (1,951 docs) |
| `rag_chunks` | Text chunks with embeddings (138,862 chunks) |
| `rag_categories` | Category taxonomy (16 categories) |
| `search_analytics` | Query performance logs |

---

## Performance

- **RAG Search:** ~100-200ms (hybrid vector + full-text)
- **Tool Execution:** ~200-500ms (Airtable API)
- **Full Response:** 2-10s (depends on complexity)
- **Memory Operations:** <50ms (cached)

---

## Version

- **Super Agent Version:** 1.0.0
- **Model:** Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Knowledge Base:** 138,862 chunks from 1,951 documents
- **Last Updated:** February 2026
