# Working agreement

- **Answer before building:** when asked what feature is next or how much work it
  needs, check the current build plan, relevant handoff and Git state, then answer.
  Begin implementation after an explicit request to implement it.
- **Keep one feature in this thread:** complete one approved numbered task at a
  time. Reuse accepted decisions and preserve unrelated changes. Create a new
  top-level thread only when the user requests one.
- **Use cheaper subagents for research and focused review:** when delegation
  saves work, select an available lower-cost model, preferring GPT-6 Luna when
  suitable. Give each subagent a bounded, read-only question, relevant paths and a
  concise output limit. Request findings with file/line references and concrete
  risks instead of source dumps or broad repository summaries.
- **Keep implementation accountable:** the main agent owns code changes,
  integration, security/domain decisions, verification and delivery. Verify
  material subagent findings against the source. Keep parallel implementation
  outside the default workflow unless explicitly requested.
- **Spend tokens on the task:** share only the context a subtask needs, reuse
  research already completed, batch independent reads and inspect relevant files
  before expanding the search. Use installed capabilities and existing project
  patterns before adding dependencies. Preserve required safety and quality checks.
- **Finish authorized work:** follow the linked development and GitHub workflows
  through the handoff and review PR without repeated confirmation for routine
  steps. Report genuine blockers and resolve approved work before handing back.
- **Report evidence plainly:** give concise progress updates and a final account
  of the change, checks, material limitations, PR and exact next task. Distinguish
  local results, remote CI and live provider/deployment evidence. For focused
  documentation edits, apply the development workflow's documentation-only
  validation exemption.
