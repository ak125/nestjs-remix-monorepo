#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Validating Specifications${NC}"
echo "================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if .spec directory exists
if [ ! -d ".spec" ]; then
    echo -e "${RED}❌ Error: .spec directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ .spec directory found${NC}"

# Validate directory structure
echo ""
echo -e "${BLUE}Checking directory structure...${NC}"

REQUIRED_DIRS=("features" "architecture" "api" "types" "workflows" "templates")
MISSING_DIRS=()

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d ".spec/$dir" ]; then
        MISSING_DIRS+=("$dir")
    fi
done

if [ ${#MISSING_DIRS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All required directories present${NC}"
else
    echo -e "${RED}❌ Missing directories: ${MISSING_DIRS[*]}${NC}"
    exit 1
fi

# Validate spec files metadata
echo ""
echo -e "${BLUE}Validating spec file metadata...${NC}"

# Find all markdown spec files (excluding templates and README)
SPEC_FILES=$(find .spec -name "*.md" -not -path ".spec/templates/*" -not -name "README.md" 2>/dev/null || true)

if [ -z "$SPEC_FILES" ]; then
    echo -e "${YELLOW}ℹ️  No spec files found yet (this is OK for initial setup)${NC}"
else
    ERRORS=0
    CHECKED=0
    
    while IFS= read -r file; do
        CHECKED=$((CHECKED + 1))
        echo -n "  Checking: $file ... "
        
        # Check for YAML frontmatter
        if ! head -n 1 "$file" | grep -q "^---$"; then
            echo -e "${RED}❌ Missing YAML frontmatter${NC}"
            ERRORS=$((ERRORS + 1))
            continue
        fi
        
        # Check for required fields
        MISSING_FIELDS=()
        for field in title status version; do
            if ! grep -q "^$field:" "$file"; then
                MISSING_FIELDS+=("$field")
            fi
        done
        
        if [ ${#MISSING_FIELDS[@]} -gt 0 ]; then
            echo -e "${RED}❌ Missing fields: ${MISSING_FIELDS[*]}${NC}"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${GREEN}✅${NC}"
        fi
    done <<< "$SPEC_FILES"
    
    if [ $ERRORS -gt 0 ]; then
        echo ""
        echo -e "${RED}❌ Found $ERRORS validation error(s) in $CHECKED file(s)${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ All $CHECKED spec file(s) have valid metadata${NC}"
    fi
fi

# Validate OpenAPI specs
echo ""
echo -e "${BLUE}Validating OpenAPI specifications...${NC}"

API_SPECS=$(find .spec/api -name "*.yaml" -o -name "*.yml" 2>/dev/null || true)

if [ -z "$API_SPECS" ]; then
    echo -e "${YELLOW}ℹ️  No OpenAPI specs found yet${NC}"
else
    if command_exists openapi-spec-validator; then
        ERRORS=0
        CHECKED=0
        
        while IFS= read -r spec; do
            CHECKED=$((CHECKED + 1))
            echo -n "  Validating: $spec ... "
            
            if openapi-spec-validator "$spec" >/dev/null 2>&1; then
                echo -e "${GREEN}✅${NC}"
            else
                echo -e "${RED}❌${NC}"
                ERRORS=$((ERRORS + 1))
            fi
        done <<< "$API_SPECS"
        
        if [ $ERRORS -gt 0 ]; then
            echo ""
            echo -e "${RED}❌ Found $ERRORS invalid OpenAPI spec(s)${NC}"
            exit 1
        else
            echo -e "${GREEN}✅ All $CHECKED OpenAPI spec(s) are valid${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  openapi-spec-validator not installed, skipping validation${NC}"
        echo -e "${YELLOW}   Install with: pip install openapi-spec-validator${NC}"
    fi
fi

# Validate TypeScript schemas
echo ""
echo -e "${BLUE}Validating TypeScript schemas...${NC}"

TS_SCHEMAS=$(find .spec/types -name "*.ts" 2>/dev/null || true)

if [ -z "$TS_SCHEMAS" ]; then
    echo -e "${YELLOW}ℹ️  No TypeScript schemas found yet${NC}"
else
    if command_exists npx; then
        ERRORS=0
        CHECKED=0
        
        while IFS= read -r schema; do
            CHECKED=$((CHECKED + 1))
            echo -n "  Type-checking: $schema ... "
            
            if npx tsc --noEmit --skipLibCheck "$schema" >/dev/null 2>&1; then
                echo -e "${GREEN}✅${NC}"
            else
                echo -e "${RED}❌${NC}"
                ERRORS=$((ERRORS + 1))
            fi
        done <<< "$TS_SCHEMAS"
        
        if [ $ERRORS -gt 0 ]; then
            echo ""
            echo -e "${RED}❌ Found $ERRORS TypeScript schema error(s)${NC}"
            exit 1
        else
            echo -e "${GREEN}✅ All $CHECKED TypeScript schema(s) are valid${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  npx not found, skipping TypeScript validation${NC}"
    fi
fi

# Summary
echo ""
echo "================================"
echo -e "${GREEN}✅ Validation completed successfully!${NC}"
echo ""
