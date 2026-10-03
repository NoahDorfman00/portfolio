#!/usr/bin/env bash
# Pulls project images from each project's own public site, so restyles show up here
# without copying files by hand. Remote images are downloaded and shrunk; live pages
# are screenshotted with headless Chrome. Outputs overwrite the files the pages use.
#
# Usage: scripts/sync-images.sh            (needs ffmpeg and Chrome)
# Build photos (PetLibro), the Race Board detection frame, the all roads results
# screenshot, and the Claudio portrait are curated by hand and not synced.

set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-}"
if [[ -z "$CHROME" ]]; then
    for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome google-chrome-stable chromium; do
        if command -v "$c" >/dev/null 2>&1 || [[ -x "$c" ]]; then CHROME="$c"; break; fi
    done
fi
[[ -n "$CHROME" ]] || { echo "Chrome not found (set CHROME=...)"; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Flatten onto white (drops any alpha), cap the width, write a JPEG.
to_jpg() {
    local in="$1" out="$2" max="$3"
    ffmpeg -loglevel error -y -i "$in" -filter_complex \
        "color=white[bg];[bg][0]scale2ref[bg][img];[bg][img]overlay=shortest=1,scale='min($max,iw)':-2" \
        -frames:v 1 -q:v 3 "$out"
}

# asset <url> <out> <max width>
asset() {
    curl -fsSL "$1" -o "$tmp/src" && to_jpg "$tmp/src" "$2" "$3" && echo "asset $2" \
        || echo "FAILED asset $1"
}

# shot <url> <out> <width> <height>
shot() {
    "$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
        --window-size="$3,$4" --virtual-time-budget=8000 \
        --screenshot="$tmp/shot.png" "$1" >/dev/null 2>&1 \
        && to_jpg "$tmp/shot.png" "$2" "$3" && echo "shot  $2" \
        || echo "FAILED shot $1"
}

P=assets/projects

asset https://study.noahgdorfman.com/assets/social.png     $P/flashcards/social.jpg 1600
asset https://claudio.noahgdorfman.com/assets/social.png   $P/claudio/social.jpg    1600
asset https://fit9to5.com/assets/social.png                $P/fit9to5/social.jpg    1600
asset https://theraceboard.com/social.png                  $P/race-board/social.jpg 1600
for i in 1 2 3 4 5; do
    asset "https://liftbookapp.com/assets/images/preview$i.png" "$P/liftbook/screen-$i.jpg" 554
done

shot https://study.noahgdorfman.com                        $P/flashcards/home.jpg      1440 810
shot https://claudio.noahgdorfman.com                      $P/claudio/chat.jpg         1200 900
shot https://fit9to5.com                                   $P/fit9to5/home.jpg         1200 900
shot "https://fit9to5.com/macros?cw=180&tw=170"            $P/fit9to5/macros.jpg       1000 750
shot https://theraceboard.com                              $P/race-board/leaderboard.jpg 1440 810

# The homepage feature image: the first three liftbook screens side by side, 4:3.
ffmpeg -loglevel error -y -i $P/liftbook/screen-1.jpg -i $P/liftbook/screen-2.jpg -i $P/liftbook/screen-3.jpg \
    -filter_complex "[0][1][2]hstack=inputs=3,scale=1600:-2,pad=1600:1200:0:(oh-ih)/2:white" \
    -q:v 3 $P/liftbook/feature.jpg && echo "built $P/liftbook/feature.jpg"
