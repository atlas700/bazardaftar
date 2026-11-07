# BazarDaftar

BazarDaftar is a Pashto-first business workspace for grain and mixed-goods wholesalers in Afghanistan.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working agreement

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

## Task guidance

<a id="project-rules"></a><a id="required-coding-workflow"></a>
<a id="quality-checks"></a><a id="feature-completion-and-review"></a>
<a id="agent-skills"></a><a id="design-and-styling-skills"></a>
<a id="issue-tracker"></a><a id="triage-labels"></a><a id="domain-docs"></a>

Read the linked instructions when their task applies; follow their links for
area-specific rules rather than loading every document.

- **Planning, implementation, code review, or validation:** read the
  [development workflow](docs/agents/development.md) and
  [task-specific skill requirements](docs/agents/skills.md).
- **App design or styling, including small style edits:** also read the
  [design and styling requirements](docs/agents/skills.md#design-and-styling).
- **Agent instruction documents:** use the
  [writing-for-agents skill](.agents/skills/writing-for-agents/SKILL.md).
- **Commits, pushes, or pull requests:** follow the
  [GitHub rules](docs/github-rules.md).
- **Issue tracking or triage:** see the [issue tracker](docs/agents/issue-tracker.md)
  and [triage labels](docs/agents/triage-labels.md).
- **Domain documentation:** follow the [single-context layout](docs/agents/domain.md).
