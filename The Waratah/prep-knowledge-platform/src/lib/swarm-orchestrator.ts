/**
 * PREP Super Agent Swarm Orchestrator
 *
 * Multi-agent orchestration layer based on claude-flow patterns.
 * Enables delegation to 13 specialized sub-agents for complex operations.
 *
 * Swarm Topology: Hierarchical with Queen Coordinator pattern
 *
 * Architecture:
 * ┌─────────────────────────────────────────────┐
 * │         PREP SUPER AGENT (Queen)            │
 * │     Strategic decisions & coordination      │
 * └─────────────────────┬───────────────────────┘
 *                       │
 *     ┌─────────────────┼─────────────────────┐
 *     │                 │                     │
 *     ▼                 ▼                     ▼
 * ┌────────┐      ┌────────────┐       ┌──────────┐
 * │Query   │      │Workflow    │       │Analytics │
 * │Handler │      │Orchestrator│       │Engine    │
 * └────────┘      └─────┬──────┘       └──────────┘
 *                       │
 *         ┌─────────────┼─────────────┐
 *         ▼             ▼             ▼
 *    ┌─────────┐  ┌──────────┐  ┌───────────┐
 *    │Decision │  │Error     │  │Feedback   │
 *    │Engine   │  │Coord     │  │Processor  │
 *    └─────────┘  └──────────┘  └───────────┘
 */

// ============================================
// Types
// ============================================

export type AgentType =
  | 'query-handler'
  | 'workflow-orchestrator'
  | 'decision-engine'
  | 'analytics-engine'
  | 'error-coordinator'
  | 'feedback-processor'
  | 'airtable-operations'
  | 'prep-gas-developer'
  | 'testing-framework'
  | 'monitoring-dashboard'
  | 'health-check'
  | 'staff-guide'
  | 'workflow-states';

export interface AgentCapability {
  name: AgentType;
  description: string;
  triggers: string[];
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  canDelegate: AgentType[];
  tools: string[];
}

export interface TaskRequest {
  id: string;
  type: 'query' | 'action' | 'analysis' | 'error' | 'workflow';
  content: string;
  context: Record<string, unknown>;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline?: number;
  requester: string;
}

export interface TaskResult {
  id: string;
  agentType: AgentType;
  status: 'success' | 'partial' | 'failure' | 'delegated';
  result: unknown;
  confidence: number;
  executionTimeMs: number;
  delegatedTo?: AgentType[];
  error?: string;
}

export interface SwarmStatus {
  activeAgents: AgentType[];
  pendingTasks: number;
  completedTasks: number;
  averageResponseTime: number;
  healthScore: number;
}

// ============================================
// Agent Definitions (from .claude/agents/prep-system/)
// ============================================

const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    name: 'query-handler',
    description: 'Natural language query processing for staff questions',
    triggers: ['what', 'how', 'why', 'when', 'where', 'status', 'show', 'list', 'tell'],
    priority: 'P1',
    canDelegate: ['airtable-operations', 'analytics-engine'],
    tools: ['get_stocktake_status', 'get_prep_tasks', 'get_ordering_list', 'lookup_recipe'],
  },
  {
    name: 'workflow-orchestrator',
    description: 'Central coordination for multi-step operations',
    triggers: ['generate', 'run', 'execute', 'start', 'process', 'complete'],
    priority: 'P0',
    canDelegate: ['decision-engine', 'error-coordinator', 'airtable-operations'],
    tools: ['finalize_stocktake', 'generate_prep_run', 'export_documents'],
  },
  {
    name: 'decision-engine',
    description: 'Automated decisions based on confidence thresholds',
    triggers: ['should', 'decide', 'approve', 'recommend', 'suggest'],
    priority: 'P2',
    canDelegate: ['analytics-engine'],
    tools: ['evaluate_confidence', 'check_thresholds'],
  },
  {
    name: 'analytics-engine',
    description: 'Predictive analytics and trend detection',
    triggers: ['trend', 'analyze', 'predict', 'forecast', 'compare', 'efficiency'],
    priority: 'P3',
    canDelegate: [],
    tools: ['get_usage_trends', 'calculate_par_recommendations'],
  },
  {
    name: 'error-coordinator',
    description: 'Error handling and recovery procedures',
    triggers: ['error', 'failed', 'fix', 'retry', 'recover', 'issue'],
    priority: 'P1',
    canDelegate: ['workflow-orchestrator'],
    tools: ['diagnose_error', 'attempt_recovery', 'escalate'],
  },
  {
    name: 'feedback-processor',
    description: 'Staff feedback handling with AI triage',
    triggers: ['feedback', 'report', 'wrong', 'incorrect', 'missing', 'update'],
    priority: 'P3',
    canDelegate: ['airtable-operations'],
    tools: ['submit_feedback', 'triage_feedback', 'auto_fix'],
  },
  {
    name: 'airtable-operations',
    description: 'Direct Airtable data operations',
    triggers: ['update', 'create', 'delete', 'modify', 'change', 'set'],
    priority: 'P0',
    canDelegate: [],
    tools: ['read_records', 'write_records', 'batch_update'],
  },
  {
    name: 'prep-gas-developer',
    description: 'Google Apps Script specialist',
    triggers: ['script', 'automation', 'deploy', 'debug', 'clasp'],
    priority: 'P0',
    canDelegate: [],
    tools: ['check_script_properties', 'deploy_script', 'debug_script'],
  },
  {
    name: 'testing-framework',
    description: 'Test suites for validation',
    triggers: ['test', 'validate', 'verify', 'check'],
    priority: 'P4',
    canDelegate: [],
    tools: ['run_smoke_tests', 'run_integration_tests'],
  },
  {
    name: 'monitoring-dashboard',
    description: 'System health monitoring',
    triggers: ['monitor', 'health', 'metrics', 'latency', 'performance'],
    priority: 'P4',
    canDelegate: ['health-check'],
    tools: ['get_system_metrics', 'check_latency'],
  },
  {
    name: 'health-check',
    description: 'Automated system validation',
    triggers: ['health', 'ping', 'alive', 'connection'],
    priority: 'P4',
    canDelegate: [],
    tools: ['check_airtable', 'check_slack', 'check_docs'],
  },
  {
    name: 'staff-guide',
    description: 'End-user documentation and training',
    triggers: ['help', 'how do i', 'tutorial', 'guide', 'documentation'],
    priority: 'P4',
    canDelegate: [],
    tools: ['get_documentation', 'get_training_materials'],
  },
  {
    name: 'workflow-states',
    description: 'Workflow state machine validation',
    triggers: ['state', 'transition', 'valid', 'allowed'],
    priority: 'P0',
    canDelegate: [],
    tools: ['validate_transition', 'get_current_state'],
  },
];

// ============================================
// Swarm Orchestrator Implementation
// ============================================

export class SwarmOrchestrator {
  private activeAgents: Set<AgentType> = new Set();
  private taskQueue: TaskRequest[] = [];
  private completedTasks: Map<string, TaskResult> = new Map();
  private capabilities: Map<AgentType, AgentCapability>;

  constructor() {
    this.capabilities = new Map(
      AGENT_CAPABILITIES.map((cap) => [cap.name, cap])
    );
  }

  /**
   * Route a request to the appropriate agent(s)
   */
  async routeRequest(request: TaskRequest): Promise<TaskResult> {
    const startTime = Date.now();

    // Determine which agent should handle this
    const selectedAgent = this.selectAgent(request);

    if (!selectedAgent) {
      return {
        id: request.id,
        agentType: 'query-handler', // Default fallback
        status: 'failure',
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        error: 'No suitable agent found for request',
      };
    }

    // Mark agent as active
    this.activeAgents.add(selectedAgent);

    try {
      // Execute the agent's logic
      const result = await this.executeAgent(selectedAgent, request);

      // Check if delegation is needed
      if (result.status === 'delegated' && result.delegatedTo) {
        // Execute delegated agents
        const delegatedResults = await Promise.all(
          result.delegatedTo.map((agent) =>
            this.executeAgent(agent, request)
          )
        );

        // Merge results
        result.result = {
          primary: result.result,
          delegated: delegatedResults.map((r) => ({
            agent: r.agentType,
            result: r.result,
          })),
        };
      }

      result.executionTimeMs = Date.now() - startTime;
      this.completedTasks.set(request.id, result);
      return result;
    } finally {
      this.activeAgents.delete(selectedAgent);
    }
  }

  /**
   * Select the best agent for a request
   */
  private selectAgent(request: TaskRequest): AgentType | null {
    const contentLower = request.content.toLowerCase();

    // Score each agent based on trigger matches
    const scores: Array<{ agent: AgentType; score: number }> = [];

    for (const [agentType, capability] of this.capabilities) {
      let score = 0;

      // Check trigger word matches
      for (const trigger of capability.triggers) {
        if (contentLower.includes(trigger)) {
          score += 10;
        }
      }

      // Boost for priority alignment
      const priorityBoost: Record<TaskRequest['priority'], Record<AgentCapability['priority'], number>> = {
        critical: { P0: 5, P1: 3, P2: 1, P3: 0, P4: 0 },
        high: { P0: 4, P1: 4, P2: 2, P3: 1, P4: 0 },
        medium: { P0: 3, P1: 3, P2: 3, P3: 2, P4: 1 },
        low: { P0: 1, P1: 2, P2: 3, P3: 3, P4: 3 },
      };

      score += priorityBoost[request.priority]?.[capability.priority] || 0;

      // Request type alignment
      if (request.type === 'query' && agentType === 'query-handler') score += 5;
      if (request.type === 'action' && agentType === 'workflow-orchestrator') score += 5;
      if (request.type === 'analysis' && agentType === 'analytics-engine') score += 5;
      if (request.type === 'error' && agentType === 'error-coordinator') score += 5;
      if (request.type === 'workflow' && agentType === 'workflow-states') score += 5;

      if (score > 0) {
        scores.push({ agent: agentType, score });
      }
    }

    // Sort by score and return best match
    scores.sort((a, b) => b.score - a.score);

    return scores.length > 0 ? scores[0].agent : null;
  }

  /**
   * Execute an agent's logic
   */
  private async executeAgent(
    agentType: AgentType,
    request: TaskRequest
  ): Promise<TaskResult> {
    const capability = this.capabilities.get(agentType);

    if (!capability) {
      return {
        id: request.id,
        agentType,
        status: 'failure',
        result: null,
        confidence: 0,
        executionTimeMs: 0,
        error: 'Agent capability not found',
      };
    }

    // Simulate agent execution
    // In a full implementation, this would call the actual agent logic
    const result = await this.simulateAgentExecution(agentType, request, capability);

    return result;
  }

  /**
   * Simulate agent execution (placeholder for actual implementation)
   */
  private async simulateAgentExecution(
    agentType: AgentType,
    request: TaskRequest,
    capability: AgentCapability
  ): Promise<TaskResult> {
    // In a real implementation, this would:
    // 1. Load the agent's prompt from .claude/agents/prep-system/
    // 2. Execute the agent with appropriate tools
    // 3. Return the actual result

    // For now, return a simulated response
    const shouldDelegate = capability.canDelegate.length > 0 &&
      request.content.toLowerCase().includes('detail');

    return {
      id: request.id,
      agentType,
      status: shouldDelegate ? 'delegated' : 'success',
      result: {
        agent: agentType,
        request: request.content,
        availableTools: capability.tools,
        message: `Handled by ${agentType}`,
      },
      confidence: 0.85,
      executionTimeMs: 0,
      delegatedTo: shouldDelegate ? capability.canDelegate.slice(0, 2) : undefined,
    };
  }

  /**
   * Get current swarm status
   */
  getStatus(): SwarmStatus {
    const completed = Array.from(this.completedTasks.values());
    const avgTime = completed.length > 0
      ? completed.reduce((sum, t) => sum + t.executionTimeMs, 0) / completed.length
      : 0;

    const successCount = completed.filter((t) => t.status === 'success').length;
    const healthScore = completed.length > 0
      ? successCount / completed.length
      : 1;

    return {
      activeAgents: Array.from(this.activeAgents),
      pendingTasks: this.taskQueue.length,
      completedTasks: completed.length,
      averageResponseTime: avgTime,
      healthScore,
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Check if an agent can handle a specific tool
   */
  canHandleTool(tool: string): AgentType | null {
    for (const [agentType, capability] of this.capabilities) {
      if (capability.tools.includes(tool)) {
        return agentType;
      }
    }
    return null;
  }

  /**
   * Get delegation chain for a request
   */
  getDelegationChain(agentType: AgentType): AgentType[] {
    const chain: AgentType[] = [agentType];
    const capability = this.capabilities.get(agentType);

    if (capability) {
      for (const delegate of capability.canDelegate) {
        chain.push(...this.getDelegationChain(delegate));
      }
    }

    return chain;
  }
}

// Export singleton instance
export const swarmOrchestrator = new SwarmOrchestrator();

// Export helper function for easy task creation
export function createTask(
  type: TaskRequest['type'],
  content: string,
  priority: TaskRequest['priority'] = 'medium',
  context: Record<string, unknown> = {}
): TaskRequest {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    content,
    context,
    priority,
    requester: 'super-agent',
  };
}
