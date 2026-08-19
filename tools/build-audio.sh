#!/usr/bin/env bash
# Rigenera l'audio del gioco: sintesi in WAV, poi compressione in MP3.
# Richiede python3 con numpy e ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/2  Sintesi (tools/synth.py)"
python3 tools/synth.py

echo "2/2  Compressione MP3"
mkdir -p public/audio
for f in tools/audio-raw/sfx-*.wav; do
  name="$(basename "$f" .wav)"
  ffmpeg -y -loglevel error -i "$f" -codec:a libmp3lame -q:a 6 -ac 1 "public/audio/${name}.mp3"
done
for f in tools/audio-raw/music-*.wav; do
  name="$(basename "$f" .wav)"
  ffmpeg -y -loglevel error -i "$f" -codec:a libmp3lame -b:a 96k "public/audio/${name}.mp3"
done

echo "Fatto:"
du -sh public/audio
ls -1 public/audio/*.mp3 | wc -l | xargs echo "  file:"
