---
name: see
description: Read an image or watch a video when you have no vision, or bulk-caption an image set. `see ocr` extracts text locally with the OS recogniser; `see ask` and bare `see IMAGE` send images to a vision model; `see video` watches local clips and supported links; `see caption` captions folders for training. Use for screenshots, diagrams, photos, charts, recordings, image or video URLs, OCR, visual questions, UI comparison, and media handed back by another tool.
---

# see

Global CLI (`~/Development/see`, on PATH). Takes a path, an http(s) URL, or `-` for stdin.
Full flags: `see --help`. MCP tools mirror it: `see_ocr`, `see_ask`, `see_video`,
`see_caption`, `see_info`, `see_ocr_backends`.

| you need | command |
| --- | --- |
| the words — logs, code, errors, docs, UI labels | `see ocr <src>` |
| meaning — what a photo shows, which button is disabled, what a chart implies | `see ask <src> [question]` |
| a video, or a link to one | `see video <file\|link> [question]` |
| image meaning or layout | `see ask <src> [question]` |
| pixel dimensions | `see info <src>` |
| captions for a folder of training images | `see caption <dir> --trigger "<tok>" --txt` |

`see ocr` is local, free and sub-second (Vision on macOS, Windows.Media.Ocr on Windows,
Tesseract on Linux) — try it first for plain text. `see ask` costs an API call and is the
only thing that understands what it is looking at; it needs no setup, and a "no API key"
error means `~/.config/see/key` is missing.

## Do not

- **Never write your own decoder.** No PIL, Sharp, base64 or pixel-forensics script.
  Use `see ocr` or `see ask`.
- **Never extract frames yourself.** No ffmpeg-into-a-contact-sheet, no captioning
  stills one by one. `see video` sends the video itself and hears the audio too.

## Video

`see video <file|link>` — or just `see <link>`, which routes a pasted YouTube, Instagram,
TikTok, X, Reddit or Vimeo URL to the same place. Downloads happen for you; do not run
yt-dlp yourself first.

- **Ask a question rather than taking the default.** The default walks the whole video with
  `[mm:ss]` timestamps and a full transcript — right for an unknown clip, wasteful when you
  want one fact.
- **Window it.** `--start 12:30 --end 14:00` on a long video is the difference between a
  cheap call and an expensive one. Both take `90`, `1:30` or `1m30s`.
- **`--fps`** defaults to 1. Raise it for fast action or a UI glitch; drop below 1 for a
  long talking-head video.
- Downloads and uploads are both cached, so a follow-up question about the same clip is
  nearly free — ask several narrow questions instead of one giant one.
- A private/age-gated YouTube link falls back to yt-dlp on its own. A logged-in Instagram
  post needs `--cookies-from chrome`; only reach for that after a plain run fails.

## Asking well

Say what you want back: `see ask err.png "transcribe the stack trace verbatim"`,
`see ask ui.png "list every button label top to bottom with its colour"`. With no
question you get a description plus every visible string in reading order — the right
first move on an unknown image.

For a large image, ask about a named region, for example "transcribe the panel in the lower right".

## Bulk captioning

Past a handful of images, never caption inline and never hand it back to the user.

- **It resumes.** Stems already in `--out` are skipped and the file is flushed after every
  image, so a crash or a later batch costs only the missing captions. Re-running the same
  command is also how you retry failures.
- **Report the shot-type histogram it prints.** Under ~20 full-body/wide frames, full-body
  identity does not train — say so before anyone spends a GPU hour.
- **The brief omits face/hair/build/age/ethnicity on purpose.** Those are constant across a
  character set and belong in the trigger token; naming them teaches the model the words
  instead of the subject. Do not "improve" it by adding them. `--extra` adds wardrobe/era
  context, `--prompt-file` replaces it, `--dry-run` shows both before spending.
- Backgrounded runs: grep the last line for `CAPTIONS_WRITTEN [0-9]+` — digits required,
  since the brief itself contains the bare marker — and check the exit code.

Repo: <https://github.com/safzanpirani/see>.
