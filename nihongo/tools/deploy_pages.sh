#!/usr/bin/env bash
# Build the static site and publish it to the `gh-pages` branch as a single fresh commit
# (no history, so the 45 MB of audio never piles up in the repository).
#
#   bash nihongo/tools/deploy_pages.sh
#
# One-time GitHub setting: Settings → Pages → Build and deployment →
#   Source: "Deploy from a branch" → Branch: gh-pages / (root)
# The site is then at https://<user>.github.io/<repo>/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE="${REMOTE:-origin}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
python3 "$ROOT/nihongo/build.py" --site "$TMP/site" >/dev/null
cd "$TMP/site"
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-Michi deploy}" -c user.email="${GIT_AUTHOR_EMAIL:-michi-deploy@users.noreply.github.com}" commit -q -m "Deploy Michi $(date -u +%Y-%m-%dT%H:%MZ)"
git push -f "$(git -C "$ROOT" remote get-url "$REMOTE")" gh-pages:gh-pages
echo "Deployed. If Pages is enabled for the gh-pages branch it updates in about a minute."
