---
name: sxs
description: Build and verify labeled comparison sheets for images and videos with the installed sxs CLI. Use for render comparisons, frame-progress comparisons, and contact sheets.
---

# sxs

Run `sxs` from the repository root. Write generated sheets under a local scratch or comparison directory.

Use a labeled row for image comparisons:

```sh
sxs before.png after.png -o .scratch/comparisons/before-after.png
```

Use fractional frame sampling for video comparisons:

```sh
sxs short.mp4 long.mp4 --frames 5 -o .scratch/comparisons/videos.png
```

Use a grid for render directories:

```sh
sxs grid outputs/run-name --cols 5 -o .scratch/comparisons/run-name.png
```

Use `--json` when another tool needs layout metadata. Verify output dimensions with `ffprobe` when media content must remain unopened. Never open or preview explicit reference images or renders.

The source repository lives at `/Users/safzan/Development/sxs`. Run `bun link` there if the command is missing from `PATH`.
