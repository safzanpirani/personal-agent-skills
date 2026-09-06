---
name: dlss5-feeder-nr
description: Runs still images and videos through the DLSS 5 Neural Rendering feeder on Safzan's Windows RTX host, validates the output, and optionally builds comparisons. Use when the user asks to run DLSS 5, DLSS-NR, Neural Rendering, or the DLSS5 feeder on media through `main`.
---

# DLSS 5 feeder NR

Run the verified offline feeder on `main`. Read the `fleet` skill before remote work. Read `agent-safe` before inspecting private or potentially explicit media. Read `sxs` before building comparisons.

## Fixed runtime

- Host: `main`
- Wrapper: `F:\dlss5-video-filter\src\scripts\run_dlss5_video_filter.ps1`
- Client: `F:\dlss5-video-filter\client\dlss5-filter-client.exe`
- Runtime: `F:\dlss5-video-filter\runtime`
- Work root: `F:\dlss5-video-filter\work`

The host needs a logged-in interactive Windows session. Use `fleet spawn`, because the hidden D3D12 swapchain cannot initialize in the SSH service session.

## Workflow

1. Run `fleet --help` once when flags are uncertain.
2. Probe the source with `ffprobe` or `file`. Record its SHA-256 without opening private media.
3. Verify the client, host executable, wrapper, DLLs, add-on, and `ReShade.ini` on `main`.
4. Set `[RenoDX.DLSS5] NRIntensity=1.0` for 100% unless the user requests another normalized value from `0.0` through `1.0`. Preserve `EnableHooks=2`.
5. Create a unique directory under the work root. Transfer the source with `fleet cp`. Verify the remote SHA-256.
6. Launch the wrapper with `fleet spawn main '<PowerShell command>'`.
7. Wait with `fleet jobs wait main:<id> --timeout <seconds>`. Read the complete log with `fleet jobs log`.
8. Require exit code zero, `full_decode=true`, the expected dimensions and frame count, and a remote SHA-256.
9. Pull the output with `fleet cp main:<remote-output> <local-output>`. Verify that both hashes match.
10. Build an `sxs` sheet when requested. Inspect only media that the user authorized the agent to view.

## Wrapper command

```powershell
& "F:\dlss5-video-filter\src\scripts\run_dlss5_video_filter.ps1" `
  -InputPath "F:\dlss5-video-filter\work\<run>\input.<ext>" `
  -OutputPath "F:\dlss5-video-filter\work\<run>\output.<ext>" `
  -RuntimeDir "F:\dlss5-video-filter\runtime" `
  -ClientExe "F:\dlss5-video-filter\client\dlss5-filter-client.exe" `
  -WorkDir "F:\dlss5-video-filter\work\<run>\raw" `
  -WarmupFrames 180
```

Use PNG for a one-frame source. Use MP4 for HEVC NVENC delivery. Use MKV for a lossless FFV1 working master.

## Video guidance

- Pass `-MotionScript F:\dlss5-video-filter\src\scripts\make_farneback_motion.py` to estimate optical flow.
- Pass `-DepthNpz <path> -DepthConverter F:\dlss5-video-filter\src\scripts\depth_npz_to_dlss.py` when Video Depth Anything output exists.
- State `constant depth` or `zero motion vectors` when those inputs are absent.
- Do not claim game-equivalent reconstruction. Decoded video lacks engine motion, jitter, exposure, and disocclusion data.

## Evidence boundary

A successful exit and full decode prove structural output. They do not prove visual quality, watermark removal, correct temporal behavior, or identity preservation. Report runtime activation evidence separately from visual judgment. Keep source media, outputs, raw frames, and logs out of Git.
