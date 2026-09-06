---
name: agent-controller-review
description: Audits and hardens long-lived subprocess controllers that combine JSON-RPC, persistent run state, live control, and terminal interfaces. Use when reviewing agent runtimes, app-server wrappers, process lifecycle handling, stale-state recovery, steering, interrupts, provider adapters, or TUI event synchronization.
---

# Agent Controller Review

Use this skill as a controller-specific layer over the repository's normal
review or diagnosis workflow. Follow the user's authority: report only during a
read-only review, and apply confident fixes when the user requests remediation.

## Quick start

1. Read repository instructions, architecture docs, protocol schemas, and the
   supported child-process version before judging behavior.
2. Map the CLI, controller, child stdin/stdout/stderr, RPC correlation, control
   channel, persisted state, and TUI as separate boundaries.
3. Write the lifecycle states and allowed transitions. Mark which component
   owns each transition and which IDs or generations authorize each mutation.
4. Build a deterministic fake-child or fake-server loop before changing code.
5. Audit every failure seam below, then verify the real user-facing surface.

## Invariant audit

### Transport and protocol

- Bound stdin writes and RPC calls. Never hold a shared write lock across an
  operation without a deadline or cancellation path.
- Correlate responses by protocol ID. Accept every valid ID representation that
  the protocol permits. Reject unsupported server-initiated requests promptly.
- Treat EOF, malformed messages, write failure, timeout, and child exit as
  terminal for pending RPCs. Preserve private stderr for diagnosis.
- Validate protocol changes against generated schemas or authoritative docs.
  Assert exact requests in tests, including omitted fields.

### Lifecycle and concurrency

- Make terminal state monotonic. Let cancellation, interrupt, watchdog expiry,
  transport failure, and normal completion race without double settlement.
- Drain stdout processing before treating process exit as complete.
- Version live mutations with the active session, thread, turn, or generation.
  Reject stale commands instead of converting them into new work.
- Correlate lifecycle notifications with the root session and active turn.
  Allow nested item events to update timelines without changing root state.
- Gate asynchronous refresh work before destroying UI resources.

### Processes and persistence

- Terminate the full process tree, including descendants that ignore graceful
  termination. Keep platform behavior behind explicit process helpers.
- Claim reusable run directories atomically. Preserve prior evidence when a
  claim fails, and distinguish a dead controller from a terminal run.
- Create private directories, files, and sockets with owner-only permissions.
- Keep public or control state content-redacted. Store prompts, completions,
  tool text, and stderr only in private artifacts.
- Append accepted, rejected, and rolled-back decisions so recovery can explain
  what happened without reconstructing intent from the final snapshot.

### Adapters and UI

- Resolve trusted executables deliberately. Treat announced URLs, paths, and
  capabilities as untrusted protocol input.
- Invalidate an adapter after transport corruption or ambiguous settlement.
- Key editable TUI state by session and turn. Do not let selection changes send
  a draft or action to a different run.
- Verify visible behavior in a real PTY at representative dimensions. Compare
  installed assets with checkout assets when a global install is under test.

## Regression matrix

Use a fake child to observe requests and inject blocked writes, malformed
responses, EOF, delayed settlement, duplicate notifications, ignored signals,
descendant processes, stale state, and temporary control-channel errors. Assert
the returned error, persisted terminal state, pending-call rejection, socket
cleanup, process-tree death, and ordered output when each claim applies.

Run focused race tests repeatedly. Then run the repository's full tests, race
detector, static analysis, build, formatting checks, and supported-platform
compile checks. Treat source checks, fake-server tests, PTY behavior, installed
artifacts, and live protocol runs as separate evidence.

## Trigger examples

- "Review and fix the JSON-RPC wrapper whose interrupt sometimes hangs."
- "Audit run-directory ownership and stale-controller recovery."
- "Find races between nested lifecycle events and the terminal dashboard."

## Report

Report numbered findings with severity and file/line evidence. List applied
fixes, deferred decisions, exact verification commands and results, remaining
limitations, and commit or push status.
