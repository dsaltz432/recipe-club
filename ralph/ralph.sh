#!/bin/bash

# Ralph Wiggum Autonomous Development Loop
# =========================================
# This script runs Claude Code in a continuous loop, each iteration with a fresh
# context window. It reads PROMPT.md and feeds it to Claude until all stories are
# complete or max iterations is reached.
#
# Usage: ./ralph.sh [options] <max_iterations>
# Example: ./ralph.sh 20

set -euo pipefail

# --- Resolve script directory (works even when called from project root) ---
RALPH_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Signal handling ---
CLAUDE_PID=""
cleanup() {
  echo -e "\n${RED:-}Interrupted. Exiting.${NC:-}"
  if [ -n "$CLAUDE_PID" ] && kill -0 "$CLAUDE_PID" 2>/dev/null; then
    kill -TERM "$CLAUDE_PID" 2>/dev/null
    wait "$CLAUDE_PID" 2>/dev/null
  fi
  exit 130
}
trap cleanup INT TERM

# --- Configuration ---
PRE_START_DELAY=${RALPH_START_DELAY:-3}        # seconds before first iteration
INTER_ITERATION_DELAY=${RALPH_ITER_DELAY:-2}   # seconds between iterations

# --- Color support ---
if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  CYAN=''
  NC=''
fi

# --- Help ---
show_help() {
  cat << EOF
Ralph Wiggum Autonomous Development Loop

USAGE:
  $0 [options] <max_iterations>

OPTIONS:
  -h, --help       Show this help message
  --dry-run        Validate files and show status without running iterations

ENVIRONMENT VARIABLES:
  RALPH_START_DELAY  Delay before first iteration in seconds (default: 3)
  RALPH_ITER_DELAY   Delay between iterations in seconds (default: 2)
  NO_COLOR           Set to any value to disable colored output

EXAMPLES:
  $0 20                          Run up to 20 iterations
  $0 --dry-run 10               Validate setup without running
  ./ralph/ralph.sh 15            Run from project root

REQUIREMENTS:
  - claude CLI installed and authenticated
  - git repository initialized
  - PROMPT.md, prd.json in the same directory as this script
EOF
}

# --- Parse arguments ---
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      break
      ;;
  esac
done

if [ -z "${1:-}" ]; then
  echo -e "${RED}Error: Missing required argument${NC}"
  echo ""
  echo "Usage: $0 [options] <max_iterations>"
  echo "Example: $0 20"
  echo ""
  echo "Run $0 --help for full usage information."
  exit 1
fi

MAX_ITERATIONS=$1

# --- Dependency check ---
for cmd in claude git; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}Error: Required command '${cmd}' not found${NC}"
    exit 1
  fi
done

# --- Verify required files ---
if [ ! -f "$RALPH_DIR/PROMPT.md" ]; then
  echo -e "${RED}Error: PROMPT.md not found in $RALPH_DIR${NC}"
  echo "Please run /create-prd first"
  exit 1
fi

if [ ! -f "$RALPH_DIR/prd.json" ]; then
  echo -e "${RED}Error: prd.json not found in $RALPH_DIR${NC}"
  echo "Please run /create-prd first"
  exit 1
fi

if [ ! -f "$RALPH_DIR/activity.md" ]; then
  echo -e "${YELLOW}Warning: activity.md not found, creating it...${NC}"
  cat > "$RALPH_DIR/activity.md" << 'ACTEOF'
# Project Build - Activity Log

## Codebase Patterns
<!-- Reusable patterns discovered during implementation go here -->

## Current Status
**Last Updated:** Not started
**Tasks Completed:** 0
**Current Task:** None

---

## Session Log

<!-- Agent will append dated entries here -->
ACTEOF
fi

# --- Git repo check ---
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo -e "${RED}Error: Must be inside a git repository${NC}"
  echo "Initialize one with: git init && git add -A && git commit -m 'initial commit'"
  exit 1
fi

# --- Git branch validation ---
if command -v jq &>/dev/null; then
  expected_branch=$(jq -r '.branchName // empty' "$RALPH_DIR/prd.json" 2>/dev/null)
  if [ -n "$expected_branch" ]; then
    current_branch=$(git branch --show-current 2>/dev/null || echo "")
    if [ -n "$current_branch" ] && [ "$current_branch" != "$expected_branch" ]; then
      echo -e "${RED}Error: On branch '${current_branch}', but prd.json expects '${expected_branch}'${NC}"
      echo "Switch branches with: git checkout $expected_branch"
      exit 1
    fi
  fi
fi


# --- Functions ---

print_status() {
  local passed
  passed=$(grep -c '"passes": true' "$RALPH_DIR/prd.json" 2>/dev/null) || true
  local total
  total=$(grep -c '"passes"' "$RALPH_DIR/prd.json" 2>/dev/null) || true
  local remaining=$((total - passed))
  local branch=$(git branch --show-current 2>/dev/null || echo "unknown")
  local last_commit=$(git log --oneline -1 2>/dev/null || echo "no commits")

  echo -e "${CYAN}┌─────────────────────────────────┐${NC}"
  echo -e "${CYAN}│${NC}  Stories: ${GREEN}${passed}${NC} / ${total} passed (${YELLOW}${remaining} remaining${NC})"
  echo -e "${CYAN}│${NC}  Branch:  ${branch}"
  echo -e "${CYAN}│${NC}  Commit:  ${last_commit}"
  echo -e "${CYAN}└─────────────────────────────────┘${NC}"
}

all_stories_complete() {
  local remaining
  remaining=$(grep -c '"passes": false' "$RALPH_DIR/prd.json" 2>/dev/null) || true
  [ "$remaining" -eq 0 ]
}

# --- Header ---
echo -e "${BLUE}┌──────────────────────────────────┐${NC}"
echo -e "${BLUE}│   Ralph Wiggum Autonomous Loop   │${NC}"
echo -e "${BLUE}└──────────────────────────────────┘${NC}"
echo ""
echo -e "  Max iterations: ${GREEN}$MAX_ITERATIONS${NC}"
echo -e "  Completion:     ${GREEN}all stories pass in prd.json${NC}"
echo ""
print_status
echo ""

# --- Dry run ---
if [ "$DRY_RUN" = true ]; then
  echo -e "${GREEN}Dry run complete. Files validated, status shown above.${NC}"
  exit 0
fi

echo -e "${YELLOW}Starting in ${PRE_START_DELAY} seconds... Press Ctrl+C to abort${NC}"
sleep "$PRE_START_DELAY"
echo ""

# --- Main loop ---
for ((i=1; i<=MAX_ITERATIONS; i++)); do
  START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
  START_EPOCH=$(date +%s)

  echo -e "${BLUE}┌──────────────────────────────────┐${NC}"
  echo -e "${BLUE}│  Iteration $i of $MAX_ITERATIONS${NC}"
  echo -e "${BLUE}│  Started: ${START_TIME}${NC}"
  echo -e "${BLUE}└──────────────────────────────────┘${NC}"
  echo ""

  # Run Claude in background so the shell can receive Ctrl+C
  set +e
  claude -p "$(cat "$RALPH_DIR/PROMPT.md")" --output-format text 2>&1 &
  CLAUDE_PID=$!
  wait "$CLAUDE_PID"
  CLAUDE_EXIT=$?
  CLAUDE_PID=""
  set -e

  END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
  END_EPOCH=$(date +%s)
  DURATION=$(( END_EPOCH - START_EPOCH ))
  DURATION_MIN=$(( DURATION / 60 ))
  DURATION_SEC=$(( DURATION % 60 ))

  echo ""
  echo -e "${CYAN}  Finished: ${END_TIME} (${DURATION_MIN}m ${DURATION_SEC}s)${NC}"

  if [ $CLAUDE_EXIT -ne 0 ]; then
    echo -e "${RED}  Claude exited with code ${CLAUDE_EXIT}${NC}"
  fi

  echo ""

  # Print overall status after each iteration
  print_status
  echo ""

  # Check if all stories now pass in prd.json
  if all_stories_complete; then
    echo ""
    echo -e "${GREEN}┌──────────────────────────────────┐${NC}"
    echo -e "${GREEN}│     ALL TASKS COMPLETE!          │${NC}"
    echo -e "${GREEN}└──────────────────────────────────┘${NC}"
    echo ""
    echo -e "  Finished after ${GREEN}$i${NC} iteration(s)"
    echo ""
    print_status
    echo ""
    echo "  Next steps:"
    echo "    1. Review the completed work in your project"
    echo "    2. Check ralph/activity.md for the full progress log"
    echo "    3. Run tests to verify everything works"
    echo ""

    exit 0
  fi

  echo ""
  echo -e "${YELLOW}--- End of iteration $i ---${NC}"
  echo ""

  # Small delay between iterations
  sleep "$INTER_ITERATION_DELAY"
done

echo ""
echo -e "${RED}┌──────────────────────────────────┐${NC}"
echo -e "${RED}│   MAX ITERATIONS REACHED ($MAX_ITERATIONS)    │${NC}"
echo -e "${RED}└──────────────────────────────────┘${NC}"
echo ""
print_status
echo ""
echo "  Options:"
echo "    1. Run again with more iterations: ./ralph.sh 50"
echo "    2. Check ralph/activity.md to see current progress"
echo "    3. Check ralph/prd.json to see remaining stories"
echo ""

exit 1
