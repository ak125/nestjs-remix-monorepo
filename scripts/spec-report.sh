#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Specification Coverage Report${NC}"
echo "================================"
echo ""

# Create reports directory if it doesn't exist
mkdir -p .spec/reports

REPORT_FILE=".spec/reports/coverage-$(date +%Y%m%d-%H%M%S).md"

# Start report
cat > "$REPORT_FILE" << 'EOF'
# 📊 Specification Coverage Report

**Generated:** $(date +"%Y-%m-%d %H:%M:%S")

## Summary

EOF

# Count specs by type
FEATURE_COUNT=$(find .spec/features -name "*.md" 2>/dev/null | wc -l || echo "0")
ARCH_COUNT=$(find .spec/architecture -name "*.md" 2>/dev/null | wc -l || echo "0")
API_COUNT=$(find .spec/api \( -name "*.yaml" -o -name "*.yml" \) 2>/dev/null | wc -l || echo "0")
TYPE_COUNT=$(find .spec/types -name "*.ts" 2>/dev/null | wc -l || echo "0")
WORKFLOW_COUNT=$(find .spec/workflows -name "*.md" 2>/dev/null | wc -l || echo "0")

TOTAL=$((FEATURE_COUNT + ARCH_COUNT + API_COUNT + TYPE_COUNT + WORKFLOW_COUNT))

# Add counts to report
cat >> "$REPORT_FILE" << EOF

| Specification Type | Count |
|--------------------|-------|
| Features           | $FEATURE_COUNT |
| Architecture (ADR) | $ARCH_COUNT |
| API Specifications | $API_COUNT |
| Type Schemas       | $TYPE_COUNT |
| Workflows          | $WORKFLOW_COUNT |
| **TOTAL**          | **$TOTAL** |

## Details

### Features (${FEATURE_COUNT})

EOF

# List feature specs
if [ "$FEATURE_COUNT" -gt 0 ]; then
    while IFS= read -r file; do
        TITLE=$(grep "^title:" "$file" | head -1 | sed 's/title: *//;s/"//g' || basename "$file")
        STATUS=$(grep "^status:" "$file" | head -1 | sed 's/status: *//;s/"//g' || echo "unknown")
        echo "- [$STATUS] $TITLE" >> "$REPORT_FILE"
    done < <(find .spec/features -name "*.md" 2>/dev/null)
else
    echo "*No feature specifications found*" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

### Architecture Decisions (${ARCH_COUNT})

EOF

# List architecture specs
if [ "$ARCH_COUNT" -gt 0 ]; then
    while IFS= read -r file; do
        TITLE=$(grep "^title:" "$file" | head -1 | sed 's/title: *//;s/"//g' || basename "$file")
        STATUS=$(grep "^status:" "$file" | head -1 | sed 's/status: *//;s/"//g' || echo "unknown")
        echo "- [$STATUS] $TITLE" >> "$REPORT_FILE"
    done < <(find .spec/architecture -name "*.md" 2>/dev/null)
else
    echo "*No architecture decisions found*" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

### API Specifications (${API_COUNT})

EOF

# List API specs
if [ "$API_COUNT" -gt 0 ]; then
    while IFS= read -r file; do
        TITLE=$(basename "$file")
        echo "- $TITLE" >> "$REPORT_FILE"
    done < <(find .spec/api \( -name "*.yaml" -o -name "*.yml" \) 2>/dev/null)
else
    echo "*No API specifications found*" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

### Type Schemas (${TYPE_COUNT})

EOF

# List type schemas
if [ "$TYPE_COUNT" -gt 0 ]; then
    while IFS= read -r file; do
        TITLE=$(basename "$file")
        echo "- $TITLE" >> "$REPORT_FILE"
    done < <(find .spec/types -name "*.ts" 2>/dev/null)
else
    echo "*No type schemas found*" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

### Workflows (${WORKFLOW_COUNT})

EOF

# List workflow specs
if [ "$WORKFLOW_COUNT" -gt 0 ]; then
    while IFS= read -r file; do
        TITLE=$(grep "^title:" "$file" | head -1 | sed 's/title: *//;s/"//g' || basename "$file")
        STATUS=$(grep "^status:" "$file" | head -1 | sed 's/status: *//;s/"//g' || echo "unknown")
        echo "- [$STATUS] $TITLE" >> "$REPORT_FILE"
    done < <(find .spec/workflows -name "*.md" 2>/dev/null)
else
    echo "*No workflow specifications found*" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << 'EOF'

## Code Coverage Analysis

### Backend Modules

EOF

# Count backend modules and calculate coverage
BACKEND_MODULES=$(find backend/src/modules -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l || echo "0")
BACKEND_COVERED=0

# Try to identify covered modules from feature specs
if [ "$FEATURE_COUNT" -gt 0 ]; then
    while IFS= read -r file; do
        COVERED_MODULES=$(grep -oP "modules:\s*\[\K[^\]]*" "$file" 2>/dev/null | tr ',' '\n' | wc -l || echo "0")
        BACKEND_COVERED=$((BACKEND_COVERED + COVERED_MODULES))
    done < <(find .spec/features -name "*.md" 2>/dev/null)
fi

BACKEND_PERCENT=0
if [ "$BACKEND_MODULES" -gt 0 ]; then
    BACKEND_PERCENT=$((BACKEND_COVERED * 100 / BACKEND_MODULES))
fi

cat >> "$REPORT_FILE" << EOF
**Total Backend Modules:** $BACKEND_MODULES  
**Modules Documented:** $BACKEND_COVERED  
**Coverage:** $BACKEND_PERCENT%

EOF

cat >> "$REPORT_FILE" << 'EOF'

### Frontend Routes

EOF

# Count frontend routes and calculate coverage
FRONTEND_ROUTES=$(find frontend/app/routes -name "*.tsx" 2>/dev/null | wc -l || echo "0")
FRONTEND_COVERED=0

# Try to identify covered routes from feature specs
if [ "$FEATURE_COUNT" -gt 0 ]; then
    while IFS= read -r file; do
        COVERED_ROUTES=$(grep -oP "routes:\s*\[\K[^\]]*" "$file" 2>/dev/null | tr ',' '\n' | wc -l || echo "0")
        FRONTEND_COVERED=$((FRONTEND_COVERED + COVERED_ROUTES))
    done < <(find .spec/features -name "*.md" 2>/dev/null)
fi

FRONTEND_PERCENT=0
if [ "$FRONTEND_ROUTES" -gt 0 ]; then
    FRONTEND_PERCENT=$((FRONTEND_COVERED * 100 / FRONTEND_ROUTES))
fi

cat >> "$REPORT_FILE" << EOF
**Total Frontend Routes:** $FRONTEND_ROUTES  
**Routes Documented:** $FRONTEND_COVERED  
**Coverage:** $FRONTEND_PERCENT%

EOF

cat >> "$REPORT_FILE" << 'EOF'

### Packages

EOF

# Count packages
PACKAGES=$(find packages -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l || echo "0")
echo "**Total Packages:** $PACKAGES" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << 'EOF'

### Overall Coverage

EOF

# Calculate overall coverage
TOTAL_CODE_UNITS=$((BACKEND_MODULES + FRONTEND_ROUTES))
TOTAL_DOCUMENTED=$((BACKEND_COVERED + FRONTEND_COVERED))
OVERALL_PERCENT=0

if [ "$TOTAL_CODE_UNITS" -gt 0 ]; then
    OVERALL_PERCENT=$((TOTAL_DOCUMENTED * 100 / TOTAL_CODE_UNITS))
fi

cat >> "$REPORT_FILE" << EOF
**Total Code Units:** $TOTAL_CODE_UNITS (modules + routes)  
**Units Documented:** $TOTAL_DOCUMENTED  
**Overall Coverage:** $OVERALL_PERCENT%

EOF

# Add coverage chart
cat >> "$REPORT_FILE" << 'EOF'

#### Coverage by Type

EOF

# ASCII bar chart
BACKEND_BAR=$(printf '█%.0s' $(seq 1 $((BACKEND_PERCENT / 5))))
FRONTEND_BAR=$(printf '█%.0s' $(seq 1 $((FRONTEND_PERCENT / 5))))
OVERALL_BAR=$(printf '█%.0s' $(seq 1 $((OVERALL_PERCENT / 5))))

cat >> "$REPORT_FILE" << EOF
\`\`\`
Backend:  [$BACKEND_BAR] $BACKEND_PERCENT%
Frontend: [$FRONTEND_BAR] $FRONTEND_PERCENT%
Overall:  [$OVERALL_BAR] $OVERALL_PERCENT%
\`\`\`

EOF

cat >> "$REPORT_FILE" << 'EOF'

## Recommendations

EOF

# Add recommendations
if [ "$TOTAL" -eq 0 ]; then
    cat >> "$REPORT_FILE" << 'EOF'
- 🚀 **Start creating specifications** using templates in `.spec/templates/`
- 📝 **Begin with critical features** like authentication, payments, cart
- 🏗️ **Document key architecture decisions** that guide development
EOF
elif [ "$FEATURE_COUNT" -eq 0 ]; then
    echo "- 📝 **Create feature specifications** for user-facing functionality" >> "$REPORT_FILE"
fi

if [ "$API_COUNT" -eq 0 ]; then
    echo "- 🔌 **Document API contracts** using OpenAPI specifications" >> "$REPORT_FILE"
fi

if [ "$ARCH_COUNT" -eq 0 ]; then
    echo "- 🏗️ **Record architecture decisions** using ADR template" >> "$REPORT_FILE"
fi

# Finish report
cat >> "$REPORT_FILE" << 'EOF'

---

*Generated by spec-report.sh*
EOF

# Display report
echo -e "${GREEN}✅ Report generated: $REPORT_FILE${NC}"
echo ""
cat "$REPORT_FILE"
echo ""
echo -e "${BLUE}Full report saved to: $REPORT_FILE${NC}"

# Create latest symlink
ln -sf "$(basename "$REPORT_FILE")" .spec/reports/latest.md
echo -e "${BLUE}Latest report: .spec/reports/latest.md${NC}"
echo ""
