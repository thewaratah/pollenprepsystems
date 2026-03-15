# Agent Category Review - Week 2 Cleanup

**Purpose:** Review each agent category individually for archival decision
**Total Categories:** 20 (excluding prep-system)
**Total Generic Agents:** 95
**Decision Required:** Keep or Archive each category

---

## Review Process

For each category below, decide:
- **✅ KEEP** - If you plan to use these agents for PREP features
- **📦 ARCHIVE** - Move to `.claude/agents/archive/` (can restore anytime)
- **❓ REVIEW** - Need more information before deciding

---

## Category 1: consensus/ (7 agents)

**Purpose:** Distributed consensus protocols for fault-tolerant systems

**Agents:**
1. byzantine-coordinator.md - Byzantine fault tolerance, malicious actor detection
2. crdt-synchronizer.md - Conflict-free replicated data types
3. gossip-coordinator.md - Gossip-based consensus for scalability
4. performance-benchmarker.md - Benchmarking consensus protocols
5. quorum-manager.md - Dynamic quorum adjustment
6. raft-manager.md - Raft consensus algorithm (leader election, log replication)
7. security-manager.md - Security for distributed consensus

**Used by PREP?** ❌ No
**Typical use case:** Multi-agent coordination in distributed systems
**Complexity:** High - Advanced distributed systems concepts

**Recommendation:** 📦 Archive (PREP uses single orchestrator, not distributed consensus)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 2: swarm/ (3 agents)

**Purpose:** Swarm coordination patterns with different topologies

**Agents:**
1. hierarchical-coordinator.md - Queen-led hierarchy with worker delegation
2. mesh-coordinator.md - Peer-to-peer mesh network, distributed decision-making
3. adaptive-coordinator.md - Dynamic topology switching, self-organizing patterns

**Used by PREP?** ❌ No
**Typical use case:** Large-scale multi-agent systems with dynamic coordination
**Complexity:** High - Advanced coordination patterns

**Recommendation:** 📦 Archive (PREP uses centralized orchestrator pattern)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 3: flow-nexus/ (9 agents)

**Purpose:** Flow Nexus platform integration (appears to be external platform)

**Agents:**
1. authentication.md - Flow Nexus auth and user management
2. app-store.md - Application marketplace and template management
3. sandbox.md - E2B sandbox deployment and management
4. neural-network.md - Neural network training and deployment
5. challenges.md - Coding challenges and gamification
6. workflow.md - Event-driven workflow automation
7. payments.md - Credit management and billing
8. swarm.md - AI swarm orchestration and management
9. user-tools.md - User management and system utilities

**Used by PREP?** ❌ No
**Typical use case:** Integration with Flow Nexus cloud platform
**Complexity:** High - External platform dependency

**Recommendation:** 📦 Archive (No Flow Nexus integration in PREP)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 4: github/ (13 agents)

**Purpose:** GitHub workflow automation and repository management

**Agents:**
1. swarm-issue.md - GitHub issue-based swarm coordination
2. swarm-pr.md - Pull request swarm management
3. release-manager.md - Automated release coordination
4. release-swarm.md - Complex release orchestration with AI swarms
5. sync-coordinator.md - Multi-repository synchronization
6. pr-manager.md - Pull request lifecycle management
7. multi-repo-swarm.md - Cross-repository swarm orchestration
8. workflow-automation.md - GitHub Actions workflow automation
9. code-review-swarm.md - AI-powered code review deployment
10. github-modes.md - Comprehensive GitHub integration modes
11. project-board-sync.md - Synchronize AI swarms with GitHub Projects
12. issue-tracker.md - Intelligent issue management
13. repo-architect.md - Repository structure optimization

**Used by PREP?** ❌ No (PREP uses Google Apps Script, not GitHub workflows)
**Typical use case:** Software development workflow automation
**Complexity:** Medium-High - GitHub-specific

**Recommendation:** 📦 Archive (PREP doesn't use GitHub for automation)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 5: v3/ (5 agents)

**Purpose:** V3 integration architecture (appears to be framework upgrade)

**Agents:**
1. v3-integration-architect.md - Deep agentic-flow@alpha integration
2. v3-queen-coordinator.md - 15-agent concurrent swarm orchestration
3. v3-performance-engineer.md - Performance targets (2.49x-7.47x speedup)
4. v3-security-architect.md - Security overhaul, CVE remediation
5. v3-memory-specialist.md - Unified memory service (AgentDB with HNSW)

**Used by PREP?** ❌ No
**Typical use case:** Framework v3 upgrade planning
**Complexity:** High - Framework-specific architecture

**Recommendation:** 📦 Archive (Framework code, not PREP-specific)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 6: sublinear/ (5 agents)

**Purpose:** Sublinear algorithm implementations (advanced algorithms)

**Agents:**
1. consensus-coordinator.md - Distributed consensus with sublinear solvers
2. matrix-optimizer.md - Matrix analysis and optimization
3. trading-predictor.md - Financial trading with temporal advantage
4. performance-optimizer.md - System performance optimization
5. pagerank-analyzer.md - Graph analysis and PageRank calculations

**Used by PREP?** ❌ No
**Typical use case:** Advanced algorithm research and optimization
**Complexity:** Very High - Research-level algorithms

**Recommendation:** 📦 Archive (No sublinear algorithms needed for PREP)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 7: optimization/ (5 agents)

**Purpose:** Performance optimization and resource management

**Agents:**
1. load-balancer.md - Dynamic task distribution and work-stealing
2. resource-allocator.md - Adaptive resource allocation and scaling
3. benchmark-suite.md - Performance benchmarking and regression detection
4. topology-optimizer.md - Dynamic swarm topology reconfiguration
5. performance-monitor.md - Real-time metrics, bottleneck analysis, SLA monitoring

**Used by PREP?** ❌ No (PREP has monitoring-dashboard.md in prep-system)
**Typical use case:** Multi-agent system performance optimization
**Complexity:** High - Performance engineering

**Recommendation:** 📦 Archive (PREP has its own monitoring in prep-system/)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 8: hive-mind/ (5 agents)

**Purpose:** Hive mind coordination (collective intelligence patterns)

**Agents:**
1. scout-explorer.md - Information reconnaissance specialist
2. collective-intelligence-coordinator.md - Distributed cognitive processes
3. worker-specialist.md - Dedicated task execution
4. swarm-memory-manager.md - Distributed memory across hive mind
5. queen-coordinator.md - Sovereign orchestrator of hierarchical hive operations

**Used by PREP?** ❌ No (PREP uses centralized orchestration)
**Typical use case:** Collective intelligence systems
**Complexity:** High - Advanced coordination patterns

**Recommendation:** 📦 Archive (PREP doesn't use hive mind patterns)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 9: templates/ (9 agents)

**Purpose:** Agent templates for creating new agents

**Agents:**
1. migration-plan.md - Migration planning template
2. memory-coordinator.md - Memory coordination template
3. implementer-sparc-coder.md - SPARC implementation template
4. orchestrator-task.md - Task orchestration template
5. performance-analyzer.md - Performance analysis template
6. github-pr-manager.md - GitHub PR management template
7. sparc-coordinator.md - SPARC coordination template
8. automation-smart-agent.md - Smart automation template
9. coordinator-swarm-init.md - Swarm initialization template

**Used by PREP?** ❌ No
**Typical use case:** Creating new agents from templates
**Complexity:** Medium - Templates for agent creation

**Recommendation:** ❓ REVIEW - Could be useful if creating new PREP agents

**Your Decision:**
- [ ] ✅ KEEP - For creating new PREP agents
- [ ] 📦 ARCHIVE - Don't need templates
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 10: core/ (5 agents)

**Purpose:** Core utility agents (general purpose)

**Agents:**
1. reviewer.md - Code review and quality assurance
2. researcher.md - Deep research and information gathering
3. tester.md - Comprehensive testing and QA
4. planner.md - Strategic planning and task orchestration
5. coder.md - Implementation specialist for writing code

**Used by PREP?** ❌ No (PREP has specific agents in prep-system/)
**Typical use case:** General software development workflow
**Complexity:** Medium - General purpose utilities

**Recommendation:** 📦 Archive (PREP has domain-specific agents)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 11: analysis/ (2 agents)

**Purpose:** Code analysis and quality assessment

**Agents:**
1. code-analyzer.md - Advanced code quality analysis
2. analyze-code-quality.md - Comprehensive code reviews

**Used by PREP?** ❌ No (PREP focuses on kitchen operations, not code analysis)
**Typical use case:** Code quality assessment
**Complexity:** Medium - Code analysis

**Recommendation:** 📦 Archive (Not needed for PREP operations)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 12: goal/ (3 agents)

**Purpose:** Goal-oriented action planning (GOAP)

**Agents:**
1. agent.md - Goal-oriented planning agent
2. goal-planner.md - GOAP specialist with gaming AI techniques
3. code-goal-planner.md - Code-centric GOAP for software development

**Used by PREP?** ❌ No (PREP uses workflow-states.md for state management)
**Typical use case:** Dynamic goal planning and replanning
**Complexity:** High - Advanced planning algorithms

**Recommendation:** 📦 Archive (PREP uses fixed workflow, not dynamic GOAP)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 13: reasoning/ (2 agents)

**Purpose:** Reasoning and decision-making agents

**Agents:**
1. agent.md - General reasoning agent
2. goal-planner.md - Goal-oriented reasoning

**Used by PREP?** ❌ No (PREP has decision-engine.md in prep-system/)
**Typical use case:** Complex reasoning tasks
**Complexity:** High - Advanced reasoning

**Recommendation:** 📦 Archive (PREP has decision-engine.md)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 14: sparc/ (4 agents)

**Purpose:** SPARC methodology (Specification, Pseudocode, Architecture, Refinement, Code)

**Agents:**
1. specification.md - Requirements analysis
2. architecture.md - System design
3. pseudocode.md - Algorithm design
4. refinement.md - Iterative improvement

**Used by PREP?** ❌ No
**Typical use case:** Structured software development methodology
**Complexity:** Medium - Development methodology

**Recommendation:** 📦 Archive (PREP doesn't use SPARC methodology)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 15: testing/ (2 agents)

**Purpose:** Testing and validation

**Agents:**
1. tdd-london-swarm.md - TDD London School for mock-driven development
2. production-validator.md - Production validation and deployment readiness

**Used by PREP?** ❌ No (PREP has testing-framework.md in prep-system/)
**Typical use case:** Software testing workflows
**Complexity:** Medium - Testing methodologies

**Recommendation:** 📦 Archive (PREP has testing-framework.md)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 16: neural/ (1 agent)

**Purpose:** Neural network and machine learning

**Agents:**
1. safla-neural.md - Self-Aware Feedback Loop Algorithm (SAFLA) neural specialist

**Used by PREP?** ❌ No
**Typical use case:** ML model training and deployment
**Complexity:** Very High - Machine learning

**Recommendation:** 📦 Archive (PREP doesn't use neural networks currently)

**Your Decision:**
- [ ] ✅ KEEP - For future ML features?
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 17: sona/ (1 agent)

**Purpose:** SONA learning and optimization

**Agents:**
1. sona-learning-optimizer.md - SONA-powered self-optimizing agent with LoRA fine-tuning

**Used by PREP?** ❌ No
**Typical use case:** Self-optimizing ML systems
**Complexity:** Very High - Advanced ML

**Recommendation:** 📦 Archive (PREP doesn't use SONA)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 18: payments/ (1 agent)

**Purpose:** Payment authorization for autonomous AI commerce

**Agents:**
1. agentic-payments.md - Multi-agent payment authorization with cryptographic verification

**Used by PREP?** ❌ No (PREP doesn't handle payments)
**Typical use case:** AI-to-AI commerce
**Complexity:** High - Payment infrastructure

**Recommendation:** 📦 Archive (PREP doesn't process payments)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 19: custom/ (1 agent)

**Purpose:** Custom/experimental agents

**Agents:**
1. base-template-generator.md - Foundational template generation

**Used by PREP?** ❌ No
**Typical use case:** Template generation
**Complexity:** Low - Basic template generation

**Recommendation:** 📦 Archive

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Category 20: development/ (1 agent)

**Purpose:** Backend development patterns

**Agents:**
1. dev-backend-api.md - Backend API development specialist

**Used by PREP?** ❌ No (PREP has prep-gas-developer.md for GAS)
**Typical use case:** Backend API development
**Complexity:** Medium - Backend development

**Recommendation:** 📦 Archive (PREP has prep-gas-developer.md)

**Your Decision:**
- [ ] ✅ KEEP - Reason: _____________________
- [ ] 📦 ARCHIVE
- [ ] ❓ REVIEW - Questions: _____________________

---

## Summary of Recommendations

| Category | Agents | Recommendation | Reason |
|----------|--------|----------------|--------|
| consensus | 7 | 📦 Archive | No distributed consensus needed |
| swarm | 3 | 📦 Archive | Centralized orchestration used |
| flow-nexus | 9 | 📦 Archive | No Flow Nexus integration |
| github | 13 | 📦 Archive | PREP uses Google Apps Script |
| v3 | 5 | 📦 Archive | Framework code, not PREP |
| sublinear | 5 | 📦 Archive | No advanced algorithms needed |
| optimization | 5 | 📦 Archive | PREP has own monitoring |
| hive-mind | 5 | 📦 Archive | No hive mind patterns |
| templates | 9 | ❓ Review | Could be useful for new agents |
| core | 5 | 📦 Archive | PREP has domain-specific agents |
| analysis | 2 | 📦 Archive | Not for kitchen operations |
| goal | 3 | 📦 Archive | Fixed workflow, not dynamic GOAP |
| reasoning | 2 | 📦 Archive | PREP has decision-engine |
| sparc | 4 | 📦 Archive | Don't use SPARC methodology |
| testing | 2 | 📦 Archive | PREP has testing-framework |
| neural | 1 | 📦 Archive | No ML currently |
| sona | 1 | 📦 Archive | No SONA |
| payments | 1 | 📦 Archive | No payment processing |
| custom | 1 | 📦 Archive | Not needed |
| development | 1 | 📦 Archive | PREP has prep-gas-developer |

**Total to Archive:** 19 categories (~90 agents)
**Undecided:** 1 category (templates - 9 agents)

---

## Your Decisions

**Quick Options:**
1. **Archive All Recommended** - Archive 19 categories, keep templates for review
2. **Archive Everything** - Archive all 20 categories (most aggressive cleanup)
3. **Custom Selection** - Mark your decisions above for each category

**Which option do you prefer?**
- [ ] Option 1: Archive all recommended (19 categories)
- [ ] Option 2: Archive everything (20 categories)
- [ ] Option 3: Custom (I'll mark decisions above)

---

**Note:** All archived agents go to `.claude/agents/archive/` and can be restored anytime by simply copying them back.
