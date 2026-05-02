#!/usr/bin/env bash
# Delete local worker/* branches already merged into main.
# Usage: ./tools/prune-worker-branches.sh
set -euo pipefail
git fetch --prune
git branch --merged main | grep '^  worker/' | xargs -r -n1 git branch -d
