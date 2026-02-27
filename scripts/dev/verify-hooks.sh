#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

hooks_path="$(git config --get core.hooksPath || true)"
if [ "${hooks_path}" != ".githooks" ]; then
  echo "Hooks are not using repo-managed path."
  echo "Expected: .githooks"
  echo "Actual:   ${hooks_path:-<unset>}"
  echo "Run: npm run hooks:install"
  exit 1
fi

for hook in .githooks/pre-commit .githooks/pre-push; do
  if [ ! -x "${hook}" ]; then
    echo "Missing executable hook: ${hook}"
    echo "Run: npm run hooks:install"
    exit 1
  fi
done

echo "[hooks:verify] Running pre-commit..."
bash .githooks/pre-commit

echo "[hooks:verify] Running pre-push (fast mode)..."
PRE_PUSH_FAST=1 PRE_PUSH_HINT_THRESHOLD=999999 bash .githooks/pre-push

echo "[hooks:verify] OK"
