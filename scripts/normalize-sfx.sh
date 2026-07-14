#!/usr/bin/env bash
set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Need ffmpeg. Install with: brew install ffmpeg" >&2
  exit 1
fi

audio_dir="assets/audio"
true_peak="-1.5"
loudness_range="7"

# Loudness groups preserve useful contrast while making each group consistent.
# Music loops and toppers are intentionally absent.
loud_files=(
  charge.mp3
  collision.mp3
  gunshot.mp3
  punch-kill.mp3
  punch.mp3
  super.mp3
)

standard_files=(
  block.m4a
  clash.mp3
  counterstab.mp3
  ready.mp3
  reload.mp3
  stab.mp3
  wiff.mp3
)

quiet_files=(
  curtains-close.m4a
  curtains-open.m4a
  lose_jingle.mp3
  starbust.mp3
  win_sound.mp3
)

normalize_group() {
  local target="$1"
  shift

  local file path extension temporary
  for file in "$@"; do
    path="$audio_dir/$file"
    if [ ! -f "$path" ]; then
      echo "Missing SFX: $path" >&2
      exit 1
    fi

    extension="${file##*.}"
    temporary="$(mktemp "${TMPDIR:-/tmp}/normalize-sfx.XXXXXX.$extension")"
    trap 'rm -f "$temporary"' RETURN

    ffmpeg -hide_banner -loglevel error -y \
      -i "$path" \
      -af "loudnorm=I=$target:TP=$true_peak:LRA=$loudness_range" \
      "$temporary"
    mv "$temporary" "$path"
    trap - RETURN
    echo "normalized $file ($target LUFS, $true_peak dBTP)"
  done
}

normalize_group -14 "${loud_files[@]}"
normalize_group -16 "${standard_files[@]}"
normalize_group -18 "${quiet_files[@]}"
