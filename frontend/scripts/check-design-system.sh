#!/bin/bash
#
# Design System Compliance Check
#
# Scans the codebase for raw HTML controls that should use design system components.
# Run this script to identify files that need migration.
#
# Usage: ./scripts/check-design-system.sh [--strict]
#
# Options:
#   --strict  Exit with error code if violations are found (for CI)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/../src"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

STRICT_MODE=false
if [[ "$1" == "--strict" ]]; then
  STRICT_MODE=true
fi

echo "Design System Compliance Check"
echo "=============================="
echo ""

# Patterns to check with their recommended replacements
declare -A PATTERNS=(
  ['<input ']='Input, NumberInput, or Checkbox'
  ['<select ']='Select'
  ['<button ']='Button or IconButton'
  ['<label ']='Label'
  ['<textarea ']='TextArea'
)

# Files/patterns to exclude (intentional exceptions)
EXCLUDE_PATTERNS=(
  "DesignSystem.tsx"  # Demo page showing all components
  "components/primitives"  # Primitive components themselves
  "components/ui/Input.tsx"
  "components/ui/Select.tsx"
  "components/ui/Checkbox.tsx"
  "components/ui/Label.tsx"
  "components/ui/TextArea.tsx"
  "components/ui/NumberInput.tsx"
  "components/ui/RadioGroup.tsx"
  "node_modules"
)

# Build exclude args for grep
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=*$pattern*"
done

total_violations=0

for pattern in "${!PATTERNS[@]}"; do
  replacement="${PATTERNS[$pattern]}"

  # Use grep to find violations, excluding known exceptions
  results=$(grep -rn "$pattern" "$SRC_DIR" --include="*.tsx" --include="*.ts" $EXCLUDE_ARGS 2>/dev/null || true)

  if [[ -n "$results" ]]; then
    count=$(echo "$results" | wc -l)
    total_violations=$((total_violations + count))

    echo -e "${YELLOW}Pattern: $pattern${NC}"
    echo -e "  Recommend: Use ${GREEN}$replacement${NC} component"
    echo "  Found in:"
    echo "$results" | while read -r line; do
      # Extract just filename:line number
      file_info=$(echo "$line" | cut -d: -f1-2)
      echo "    - $file_info"
    done
    echo ""
  fi
done

echo "=============================="
if [[ $total_violations -eq 0 ]]; then
  echo -e "${GREEN}No design system violations found!${NC}"
  exit 0
else
  echo -e "${YELLOW}Total violations: $total_violations${NC}"
  echo ""
  echo "Note: Some violations may be intentional exceptions:"
  echo "  - Dropdown trigger buttons (Radix requires native button)"
  echo "  - Complex drag-and-drop components with specialized styling"
  echo "  - Icon-only close buttons in error messages"
  echo ""
  echo "Review each violation to determine if migration is appropriate."

  if [[ "$STRICT_MODE" == true ]]; then
    exit 1
  fi
fi
