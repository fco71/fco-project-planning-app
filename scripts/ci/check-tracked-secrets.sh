#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: check-tracked-secrets.sh [--scope=all|changed|staged] [--base-ref=<branch>]

Options:
  --scope=all|changed|staged
                       Scan all tracked files (default), changed files, or staged files.
  --base-ref=<branch>  Base branch to diff against when scope is changed (for example: main).
USAGE
}

scope="all"
base_ref=""

for arg in "$@"; do
  case "${arg}" in
    --scope=all|--scope=changed|--scope=staged)
      scope="${arg#--scope=}"
      ;;
    --base-ref=*)
      base_ref="${arg#--base-ref=}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}"
      usage
      exit 2
      ;;
  esac
done

# Prevent accidental commit of real environment files.
allowed_env_regex='^\.env\.example$|^\.env\.offline$'

tracked_env_files="$(git ls-files | grep -E '^\.env($|\.)' || true)"
if [ -n "${tracked_env_files}" ]; then
  disallowed_env_files="$(printf '%s\n' "${tracked_env_files}" | grep -Ev "${allowed_env_regex}" || true)"
  if [ -n "${disallowed_env_files}" ]; then
    echo "Blocked: sensitive env files are tracked in git:"
    printf '%s\n' "${disallowed_env_files}"
    echo
    echo "Keep only .env.example and .env.offline in git."
    exit 1
  fi
fi

echo "Env file guard passed."

# Basic high-signal secret pattern scan over tracked files.
# Intentionally strict and focused to minimize false positives.
pattern_file="$(mktemp)"
files_file="$(mktemp)"
cleanup() {
  rm -f "${pattern_file}"
  rm -f "${files_file}"
}
trap cleanup EXIT

cat > "${pattern_file}" <<'PATTERNS'
AIza[0-9A-Za-z_-]{35}
-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----
ghp_[0-9A-Za-z]{36}
github_pat_[0-9A-Za-z_]{50,}
1//[0-9A-Za-z_-]{24,}
PATTERNS

if [ "${scope}" = "all" ]; then
  git ls-files -z > "${files_file}"
elif [ "${scope}" = "changed" ]; then
  if [ -z "${base_ref}" ]; then
    echo "Missing --base-ref for --scope=changed."
    exit 2
  fi

  remote_base="origin/${base_ref}"
  if ! git rev-parse --verify --quiet "${remote_base}" >/dev/null; then
    git fetch --no-tags origin "${base_ref}" >/dev/null 2>&1 || true
  fi

  merge_base="$(git merge-base HEAD "${remote_base}" 2>/dev/null || true)"
  if [ -z "${merge_base}" ]; then
    echo "Warning: could not resolve merge base with ${remote_base}; falling back to all tracked files."
    git ls-files -z > "${files_file}"
  else
    git diff --name-only --diff-filter=ACMR -z "${merge_base}...HEAD" > "${files_file}"
  fi
elif [ "${scope}" = "staged" ]; then
  git diff --cached --name-only --diff-filter=ACMR -z > "${files_file}"
else
  echo "Invalid --scope value: ${scope}"
  usage
  exit 2
fi

if [ ! -s "${files_file}" ]; then
  echo "Secret guard passed: no files to scan for scope=${scope}."
  exit 0
fi

matches="$(
  if command -v rg >/dev/null 2>&1; then
    xargs -0 rg -n -f "${pattern_file}" --color never --no-heading < "${files_file}" || true
  else
    xargs -0 grep -nE -f "${pattern_file}" < "${files_file}" || true
  fi
)"

if [ -n "${matches}" ]; then
  echo "Blocked: possible secrets detected in scope=${scope}:"
  printf '%s\n' "${matches}"
  echo
  echo "Remove or rotate leaked credentials before committing."
  exit 1
fi

echo "Secret guard passed: no high-risk patterns found (scope=${scope})."
