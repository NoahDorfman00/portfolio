#!/usr/bin/env bash
# Renders the social cards (link previews) for project pages from design/social-project.html.
# Each card is a 1200x630 JPEG. Flashcards, Artificial Italian and FIT 9to5 are not here:
# they use the card from their own site, which scripts/sync-images.sh pulls.
#
# Usage: scripts/social-cards.sh [slug ...]     (needs Chrome and python3; no slug = all)
# After changing a card, bump the ?v= on that page's og:image and twitter:image.

set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-}"
if [[ -z "$CHROME" ]]; then
    for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome google-chrome-stable chromium; do
        if command -v "$c" >/dev/null 2>&1 || [[ -x "$c" ]]; then CHROME="$c"; break; fi
    done
fi
[[ -n "$CHROME" ]] || { echo "Chrome not found (set CHROME=...)"; exit 1; }

PORT=8739
tmp="$(mktemp -d)"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
server=$!
disown
trap 'kill $server 2>/dev/null; rm -rf "$tmp"' EXIT
sleep 1

only=("$@")
wanted() {
    [[ ${#only[@]} -eq 0 ]] && return 0
    local s; for s in "${only[@]}"; do [[ "$s" == "$1" ]] && return 0; done; return 1
}

# card <slug> <out> <title, | for a line break> <sentence, [underlined phrase]> <picture> [position] [zoom]
card() {
    wanted "$1" || return 0
    local url
    url="$(python3 - "$PORT" "$3" "$4" "$5" "${6:-50% 50%}" "${7:-1}" <<'PY'
import sys, urllib.parse
port, title, dek, img, pos, zoom = sys.argv[1:]
print(f"http://localhost:{port}/design/social-project.html?" + urllib.parse.urlencode(
    dict(title=title, dek=dek, img=img, pos=pos, zoom=zoom), quote_via=urllib.parse.quote))
PY
)"
    rm -f "$tmp/card.png"
    "$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
        --window-size=1200,630 --virtual-time-budget=6000 \
        --screenshot="$tmp/card.png" "$url" >/dev/null 2>&1 \
        && sips -s format jpeg -s formatOptions 88 "$tmp/card.png" --out "$2" >/dev/null \
        && echo "card  $2" || echo "FAILED card $1"
}

P=assets/projects
card scope-gantry   $P/scope-gantry/social.jpg   "Scope|gantry" \
    "A microscope that hangs under my bench shelf and [slides to wherever the board is]." \
    /$P/scope-gantry/model.jpg "38% 55%" 1.25
card deskcal        $P/deskcal/social.jpg        "deskcal" \
    "A desk display that [counts down to my next meeting], in a 3D-printed oscilloscope." \
    /$P/deskcal/assembled.jpg "50% 40%"
card petlibro       $P/petlibro/social.jpg       "PetLibro|button" \
    "A one-button wall plug that [fixes both cat feeders' schedules] at once." \
    /$P/petlibro/installed-success.jpg "50% 50%" 1.35
card liftbook       $P/liftbook/social.jpg       "liftbook" \
    "A lifting log for iPhone that [works like a paper notebook]." \
    /$P/liftbook/feature.jpg "80% 100%" 1.4
card all-roads      $P/all-roads/social.jpg      "all|roads" \
    "Ranks real places by whoever has the worst trip, so the group [meets somewhere fair]." \
    /$P/all-roads/results.jpg "0% 50%"
card saving-starman $P/saving-starman/social.jpg "Saving|Starman" \
    "A [tilt-controlled space adventure] on a bare ARM microcontroller." \
    /$P/saving-starman/breadboard.jpg "62% 50%"
# The Race Board's social.jpg is its own site's image (see sync-images.sh), so this one is card.jpg.
card race-board     $P/race-board/card.jpg       "The Race|Board" \
    "Reads streamers' prestige [straight off their Twitch broadcasts] and ranks them live." \
    /$P/race-board/leaderboard.jpg "0% 0%"
card prints         assets/prints/social.jpg     "Prints" \
    "Things that came off my 3D printer, as [models you can turn over]." \
    /assets/prints/lifting-claude/scene-poster.webp "50% 50%"
