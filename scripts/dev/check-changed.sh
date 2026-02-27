#!/usr/bin/env bash
set -euo pipefail

# Lint only changed JS/TS files versus a base ref for a faster local push loop.
# Override base with CHECK_CHANGED_BASE if needed.

resolve_base() {
  if [ -n "${CHECK_CHANGED_BASE:-}" ]; then
    printf '%s\n' "${CHECK_CHANGED_BASE}"
    return
  fi

  if git rev-parse --verify --quiet '@{upstream}' >/dev/null; then
    printf '%s\n' '@{upstream}'
    return
  fi

  if git show-ref --verify --quiet refs/remotes/origin/main; then
    printf '%s\n' 'origin/main'
    return
  fi

  if git rev-parse --verify --quiet HEAD~1 >/dev/null; then
    printf '%s\n' 'HEAD~1'
    return
  fi

  printf '%s\n' 'HEAD'
}

base_ref="$(resolve_base)"
echo "[check:changed] Base ref: ${base_ref}"

changed_files="$(
  git diff --name-only --diff-filter=ACMR "${base_ref}...HEAD" 2>/dev/null \
    | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' \
    || true
)"

if [ -z "${changed_files}" ]; then
  echo "[check:changed] No changed JS/TS files to lint."
  exit 0
fi

echo "[check:changed] Linting changed files:"
printf '%s\n' "${changed_files}"

# shellcheck disable=SC2086
npx eslint ${changed_files}

