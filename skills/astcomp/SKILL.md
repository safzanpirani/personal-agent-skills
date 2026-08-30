---
name: astcomp
description: Deobfuscate and verify JavaScript with a bundled CLI. Use when a user asks to make obfuscated JavaScript readable, recover string arrays or control flow, compare behavior, or improve mangled identifiers.
---

# astcomp

The skill includes its CLI at `scripts/astcomp.js`. Set `astcomp_skill_dir` to the directory that contains this file. Safzan's shared installation uses `/Users/safzan/.agents/skills/astcomp`.

## Choose an execution mode

Treat input as untrusted unless the user explicitly trusts its source.

- Use `--no-exec` for untrusted or unclear input. This mode leaves encoded string arrays in place.
- Use `--verify` for trusted input when behavioral verification matters. This mode executes the original and transformed programs.
- Use the skill's container image when untrusted input requires decoder execution. Docker must run without network access, secrets, or writable host mounts.

Never combine `--no-exec` with `--verify`. Never describe output as behaviorally verified unless astcomp reports `behaviour: identical`.

## Run the transform

Check `bun` and the bundled CLI before running a local command. Write output to a new path. Do not overwrite the input unless the user explicitly requests it.

Run the safe structural pass by default:

```bash
bun "$astcomp_skill_dir/scripts/astcomp.js" "$input_file" \
  --no-exec --report --out "$output_file"
```

Run the full local pass only for trusted input:

```bash
bun "$astcomp_skill_dir/scripts/astcomp.js" "$input_file" \
  --verify --report --out "$output_file"
```

Build and use the contained path when untrusted input needs decoder execution. Set `input_file` to an absolute path before running Docker.

```bash
docker build -f "$astcomp_skill_dir/assets/Dockerfile" \
  -t astcomp-skill "$astcomp_skill_dir"
docker run --rm --network none --memory 512m --pids-limit 128 \
  --read-only --security-opt no-new-privileges \
  -v "$input_file:/in/sample.js:ro" astcomp-skill /in/sample.js --report \
  > "$output_file"
```

Stop and use `--no-exec` when Docker is unavailable. Do not treat `node:vm` as a security boundary.

## Add identifier renaming

Add `--rename --provider heuristic` for offline renaming. The Anthropic provider sends code context to an external API. Use it only after the user approves that transfer and a key already exists in the environment. Never pass a key on the command line. Do not expose a key to untrusted input or its container.

Astcomp rolls back a rename batch when its alpha-equivalence gate fails. Report that rollback instead of presenting the unrenamed output as a successful rename.

## Report the result

Report these facts:

- the selected execution mode
- the output path
- the input and output byte counts
- the pass statistics and warnings
- the rename gate result when renaming ran
- the behavioral verdict when verification ran

Keep generated JavaScript on stdout or in the output file. Keep diagnostics on stderr.
