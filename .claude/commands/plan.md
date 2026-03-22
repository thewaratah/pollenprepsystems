Use the `prep-orchestrator` sub-agent to plan this task without writing any code.

Task to plan: $ARGUMENTS

The orchestrator will:
1. Read the relevant venue CLAUDE.md(s)
2. Break the task into a TodoWrite list
3. Identify which specialist agents are needed and in what order
4. Identify parallel opportunities (Sakura + Waratah changes that can run simultaneously)
5. Return a written plan with agent dispatch sequence — no files edited, no code written
