#!/bin/bash
#
# Design System Compliance Check
#
# Scans the codebase for raw HTML controls and hardcoded values that should
# use design system components and tokens.
#
# Usage: ./scripts/check-design-system.sh [OPTIONS]
#
# Options:
#   --strict      Exit with error code if violations are found (for CI)
#   --summary     Show summary by file instead of by pattern
#   --colors      Only check for hardcoded colors
#   --html        Only check for raw HTML elements
#   --all         Check everything (default)
#   --help        Show this help message
#
# Inline Ignore:
#   Add "// design-system-ignore" comment to ignore a specific line
#
# See docs/UI_COMPONENTS.md for the full component inventory.
#

# Note: Don't use set -e here - check_pattern returns violation count which would exit early

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/../src"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Options
STRICT_MODE=false
SUMMARY_MODE=false
CHECK_COLORS=true
CHECK_HTML=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --strict)
      STRICT_MODE=true
      shift
      ;;
    --summary)
      SUMMARY_MODE=true
      shift
      ;;
    --colors)
      CHECK_COLORS=true
      CHECK_HTML=false
      shift
      ;;
    --html)
      CHECK_COLORS=false
      CHECK_HTML=true
      shift
      ;;
    --all)
      CHECK_COLORS=true
      CHECK_HTML=true
      shift
      ;;
    --help)
      sed -n '2,21p' "$0" | sed 's/^#//' | sed 's/^ //'
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${BOLD}Design System Compliance Check${NC}"
echo "================================"
echo ""

# ============================================================================
# HTML ELEMENT PATTERNS
# ============================================================================
# Patterns to check with their recommended replacements
declare -A HTML_PATTERNS=(
  ['<input ']='Input, NumberInput, or Checkbox'
  ['<select ']='Select'
  ['<button ']='Button or IconButton'
  ['<label ']='Label'
  ['<textarea ']='TextArea'
)

# ============================================================================
# COLOR PATTERNS
# ============================================================================
# Hardcoded colors that should use design tokens
declare -A COLOR_PATTERNS=(
  # Accent colors
  ['#14b8a6']='text-accent or bg-accent'
  ['#2dd4bf']='text-accent-hover or bg-accent-hover'
  ['#0d7377']='text-accent-muted'

  # Role colors
  ['#5a9fd4']='text-role-tank'
  ['#5ad490']='text-role-healer'
  ['#d45a5a']='text-role-melee'
  ['#d4a05a']='text-role-ranged'
  ['#b45ad4']='text-role-caster'

  # Status colors
  ['#22c55e']='text-status-success'
  ['#eab308']='text-status-warning'
  ['#ef4444']='text-status-error'
  ['#3b82f6']='text-status-info'

  # Membership colors
  ['#a855f7']='text-membership-lead'
  ['#71717a']='text-membership-viewer'
  ['#f59e0b']='text-membership-linked'

  # Material colors
  ['#f97316']='text-material-tomestone'

  # Surface colors (common mistakes)
  ['#050508']='bg-surface-base'
  ['#0a0a0f']='bg-surface-raised'
  ['#0e0e14']='bg-surface-card'
  ['#121218']='bg-surface-elevated'
  ['#18181f']='bg-surface-overlay'

  # Text colors
  ['#f0f0f5']='text-primary'
  ['#a1a1aa']='text-secondary'
  ['#52525b']='text-muted'
)

# ============================================================================
# EXCLUSIONS
# ============================================================================
# Files to exclude (intentional exceptions) - use filename only
EXCLUDE_FILES=(
  "DesignSystem.tsx"    # Demo page showing all components
  "Input.tsx"           # The component itself
  "Select.tsx"          # The component itself
  "Checkbox.tsx"        # The component itself
  "Label.tsx"           # The component itself
  "TextArea.tsx"        # The component itself
  "NumberInput.tsx"     # The component itself
  "RadioGroup.tsx"      # The component itself
  "Button.tsx"          # The component itself
  "IconButton.tsx"      # The component itself
  "index.css"           # CSS definitions
  "tailwind.config.ts"  # Tailwind configuration
  "CodeBlock.tsx"       # Prism syntax highlighting needs hardcoded colors
  "loot-tables.ts"      # Floor color definitions
  "releaseNotes.ts"     # Color mentions in prose content
  "*.test.ts"           # Test files
  "*.test.tsx"          # Test files
)

# Directories to exclude
EXCLUDE_DIRS=(
  "primitives"   # Primitive components use raw HTML by design
  "node_modules" # Dependencies
  "__tests__"    # Test directories
)

# Build exclude args for grep
EXCLUDE_ARGS=""
for file in "${EXCLUDE_FILES[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$file"
done
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=$dir"
done

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Associative array to track violations by file
declare -A FILE_VIOLATIONS

check_pattern() {
  local pattern="$1"
  local replacement="$2"
  local category="$3"
  local case_flag="$4"  # Optional: -i for case insensitive

  # Use grep to find violations, excluding known exceptions
  # Also filter out:
  # - Lines with design-system-ignore comment
  # - JSDoc comment lines (starting with *)
  # - Single-line comments (starting with //)
  local grep_cmd="grep -rn $case_flag \"$pattern\" \"$SRC_DIR\" --include=\"*.tsx\" --include=\"*.ts\" $EXCLUDE_ARGS 2>/dev/null || true"
  local results=$(eval "$grep_cmd" | grep -v "design-system-ignore" | grep -v ':[[:space:]]*\*' | grep -v ':[[:space:]]*//' || true)

  if [[ -n "$results" ]]; then
    local count=$(echo "$results" | wc -l)
    total_violations=$((total_violations + count))

    if [[ "$SUMMARY_MODE" == true ]]; then
      # Track by file for summary mode
      while IFS= read -r line; do
        local file=$(echo "$line" | cut -d: -f1)
        local existing="${FILE_VIOLATIONS[$file]}"
        if [[ -z "$existing" ]]; then
          FILE_VIOLATIONS[$file]="$pattern"
        else
          FILE_VIOLATIONS[$file]="$existing, $pattern"
        fi
      done <<< "$results"
    else
      # Standard output by pattern
      echo -e "${YELLOW}Pattern: ${CYAN}$pattern${NC}"
      echo -e "  ${BOLD}Recommend:${NC} Use ${GREEN}$replacement${NC}"
      echo "  Found in:"
      echo "$results" | while read -r line; do
        local file_info=$(echo "$line" | cut -d: -f1-2)
        local content=$(echo "$line" | cut -d: -f3-)
        # Truncate long lines
        if [[ ${#content} -gt 60 ]]; then
          content="${content:0:60}..."
        fi
        echo -e "    ${BLUE}$file_info${NC}"
        echo -e "      ${content}"
      done
      echo ""
    fi

    return $count
  fi
  return 0
}

# ============================================================================
# MAIN CHECKS
# ============================================================================

total_violations=0
html_violations=0
color_violations=0

# Check HTML patterns
if [[ "$CHECK_HTML" == true ]]; then
  echo -e "${BOLD}Checking raw HTML elements...${NC}"
  echo ""

  for pattern in "${!HTML_PATTERNS[@]}"; do
    replacement="${HTML_PATTERNS[$pattern]}"
    check_pattern "$pattern" "$replacement" "html" ""
    html_violations=$((html_violations + $?))
  done
fi

# Check color patterns
if [[ "$CHECK_COLORS" == true ]]; then
  echo -e "${BOLD}Checking hardcoded colors...${NC}"
  echo ""

  for pattern in "${!COLOR_PATTERNS[@]}"; do
    replacement="${COLOR_PATTERNS[$pattern]}"
    # Case insensitive for hex colors
    check_pattern "$pattern" "$replacement" "color" "-i"
    color_violations=$((color_violations + $?))
  done
fi

# ============================================================================
# SUMMARY OUTPUT
# ============================================================================

if [[ "$SUMMARY_MODE" == true && ${#FILE_VIOLATIONS[@]} -gt 0 ]]; then
  echo -e "${BOLD}Violations by file:${NC}"
  echo ""
  for file in "${!FILE_VIOLATIONS[@]}"; do
    local patterns="${FILE_VIOLATIONS[$file]}"
    echo -e "  ${BLUE}$file${NC}"
    echo -e "    Patterns: ${YELLOW}$patterns${NC}"
  done
  echo ""
fi

echo "================================"

if [[ $total_violations -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✓ No design system violations found!${NC}"
  exit 0
else
  echo -e "${YELLOW}${BOLD}Total violations: $total_violations${NC}"

  if [[ "$CHECK_HTML" == true && "$CHECK_COLORS" == true ]]; then
    echo -e "  HTML elements: $html_violations"
    echo -e "  Hardcoded colors: $color_violations"
  fi

  echo ""
  echo -e "${BOLD}How to fix:${NC}"
  echo "  1. Review docs/UI_COMPONENTS.md for component alternatives"
  echo "  2. Use semantic color classes (text-role-tank, bg-accent, etc.)"
  echo "  3. Add '// design-system-ignore' comment for intentional exceptions"
  echo ""
  echo -e "${BOLD}Intentional exceptions (don't need fixing):${NC}"
  echo "  - Dropdown trigger buttons (Radix requires native button)"
  echo "  - Radix UI internal elements"
  echo "  - Test file assertions"
  echo ""
  echo "Run with --summary to see violations grouped by file."

  if [[ "$STRICT_MODE" == true ]]; then
    exit 1
  fi
fi
