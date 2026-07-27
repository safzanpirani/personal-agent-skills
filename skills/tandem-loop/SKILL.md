---
name: tandem-loop
description: Run one task through a multi-model plan → work → check loop using opencode as the harness (e.g. Kimi plans, DeepSeek implements, Kimi verifies, repeat until done). Use when the user wants to use two or more models in tandem on a single task, a planner/worker/reviewer split, a cheap-worker + smart-checker setup, autonomous looping without handover, or asks "can I use multiple models together / chain models / model A plans and model B runs".
---

# Tandem loop (planner / worker / reviewer)

One task, three roles, two models, no human handover:

1. **Planner** (default `opencode/kimi-k2.7-code`) — reads the repo, emits an ordered plan + acceptance checks. Never edits.
2. **Worker** (default `opencode/deepseek-v4-pro`) — implements the plan, runs the checks, reports.
3. **Reviewer** (same model as planner) — independently verifies against real repo state, ends with `VERDICT: DONE` or `VERDICT: CONTINUE`.

On `CONTINUE`, the review is fed back into the next planning round. Loops until `DONE` or max rounds.

## Run it

```bash
~/.claude/skills/tandem-loop/tandem.sh "add rate limiting to the /api/chat route with tests"
```

Options:

| flag | default | meaning |
|---|---|---|
| `--planner MODEL` | `opencode/kimi-k2.7-code` | plan model, `provider/model` |
| `--worker MODEL` | `opencode/deepseek-v4-pro` | implementation model |
| `--reviewer MODEL` | = planner | verification model |
| `--rounds N` | 5 | max plan/work/check cycles |
| `--dir PATH` | cwd | repo to work in |

Env equivalents: `TANDEM_PLANNER`, `TANDEM_WORKER`, `TANDEM_REVIEWER`, `TANDEM_ROUNDS`.

`opencode models | grep -iE 'kimi|deepseek'` lists the available ids (deepseek/kimi are served by several providers — `opencode/*`, `deepseek/*`, `baseten/*`, `crofai/*`, `fireworks/*`).

## Artifacts

Everything lands in `.tandem/<timestamp>/` inside the target repo: `task.md`, `plan-N.md`, `work-N.md`, `review-N.md`, `stderr.log`, `status`. Read `review-N.md` first when a run ends without DONE — it says exactly what remained. Exit codes: `0` done, `2` max rounds exhausted.

## Native opencode agents (interactive alternative)

The same loop ships as native opencode agents in this skill's `opencode-agents/`
dir — copy them into `~/.config/opencode/agents/` (or a project's
`.opencode/agents/`) to drive the loop inside an opencode TUI session instead of
the script:

```bash
cp opencode-agents/*.md ~/.config/opencode/agents/
```


- `@tandem` — primary orchestrator; state the task, it runs plan→work→check rounds via the subagents until DONE.
- `@tandem-planner` (kimi, read-only), `@tandem-worker` (deepseek, edits), `@tandem-reviewer` (kimi, read-only) — the roles, usable standalone too.

Edit the `model:` line in each `.md` to swap models. The shell script is the headless/batch path; the agents are the interactive path — same plan→work→check idea.

## Notes

- Each `opencode run` is stateless; continuity comes from the repo itself plus the plan/review files passed in the prompts. That keeps roles from inheriting each other's rationalizations — the reviewer sees the code, not the worker's session.
- Runs with `--auto` (auto-approves permissions), so point it at a repo with a clean git state you can `git diff` / reset.
- Swap in any two models — this is not Kimi/DeepSeek-specific. A common variant is an expensive planner with a cheap fast worker.
- For a stricter check, set `--reviewer` to a *third* model so review isn't the same weights that wrote the plan.
