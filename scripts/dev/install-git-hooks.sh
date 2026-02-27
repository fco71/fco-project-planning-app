#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
chmod +x .githooks/pre-push

echo "Git hooks installed. core.hooksPath=$(git config --get core.hooksPath)"
echo "Enabled hooks: pre-commit, pre-push"
echo "Run 'npm run hooks:verify' to test hook setup."
