#!/bin/bash
# 🚀 LCP Performance Test Script
# Tests Largest Contentful Paint on product pages using Lighthouse
# Usage: ./test-lcp-lighthouse.sh [url]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default test URL (product page with known LCP issue)
DEFAULT_URL="https://www.automecanik.com/pieces/radiateur-de-chauffage-467/renault-140/symbol-ii-140093/1-2-16v-9292.html"
URL="${1:-$DEFAULT_URL}"

# Output directory
OUTPUT_DIR="/opt/automecanik/app/scripts/lighthouse-reports"
mkdir -p "$OUTPUT_DIR"

# Timestamp for report
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/lcp-report-$TIMESTAMP.json"
HTML_REPORT="$OUTPUT_DIR/lcp-report-$TIMESTAMP.html"

echo -e "${BLUE}🔍 LCP Performance Test${NC}"
echo -e "URL: ${YELLOW}$URL${NC}"
echo ""

# Check if lighthouse is installed
if ! command -v lighthouse &> /dev/null; then
    echo -e "${YELLOW}⚠️  Lighthouse not found. Installing...${NC}"
    npm install -g lighthouse
fi

# Check if Chrome is available
CHROME_PATH=""
if command -v google-chrome &> /dev/null; then
    CHROME_PATH="google-chrome"
elif command -v chromium-browser &> /dev/null; then
    CHROME_PATH="chromium-browser"
elif command -v chromium &> /dev/null; then
    CHROME_PATH="chromium"
else
    echo -e "${RED}❌ Chrome/Chromium not found. Please install Chrome.${NC}"
    echo "   sudo apt install chromium-browser"
    exit 1
fi

echo -e "${BLUE}📊 Running Lighthouse audit (mobile, throttled)...${NC}"
echo ""

# Run Lighthouse with mobile settings and throttling
lighthouse "$URL" \
    --chrome-flags="--headless --no-sandbox --disable-gpu" \
    --only-categories=performance \
    --form-factor=mobile \
    --throttling.cpuSlowdownMultiplier=4 \
    --throttling.rttMs=150 \
    --throttling.throughputKbps=1638 \
    --screenEmulation.mobile=true \
    --screenEmulation.width=412 \
    --screenEmulation.height=823 \
    --output=json,html \
    --output-path="$OUTPUT_DIR/lcp-report-$TIMESTAMP" \
    2>/dev/null

# Extract key metrics using jq
if command -v jq &> /dev/null; then
    echo ""
    echo -e "${BLUE}📈 Performance Metrics:${NC}"
    echo "─────────────────────────────────────────"

    # LCP
    LCP=$(jq -r '.audits["largest-contentful-paint"].numericValue // 0' "$REPORT_FILE")
    LCP_DISPLAY=$(jq -r '.audits["largest-contentful-paint"].displayValue // "N/A"' "$REPORT_FILE")

    if (( $(echo "$LCP < 2500" | bc -l) )); then
        echo -e "LCP:  ${GREEN}$LCP_DISPLAY${NC} (Good < 2.5s)"
    elif (( $(echo "$LCP < 4000" | bc -l) )); then
        echo -e "LCP:  ${YELLOW}$LCP_DISPLAY${NC} (Needs Improvement < 4s)"
    else
        echo -e "LCP:  ${RED}$LCP_DISPLAY${NC} (Poor > 4s)"
    fi

    # FCP
    FCP=$(jq -r '.audits["first-contentful-paint"].displayValue // "N/A"' "$REPORT_FILE")
    echo -e "FCP:  $FCP"

    # TTFB
    TTFB=$(jq -r '.audits["server-response-time"].displayValue // "N/A"' "$REPORT_FILE")
    echo -e "TTFB: $TTFB"

    # Speed Index
    SI=$(jq -r '.audits["speed-index"].displayValue // "N/A"' "$REPORT_FILE")
    echo -e "SI:   $SI"

    # TBT
    TBT=$(jq -r '.audits["total-blocking-time"].displayValue // "N/A"' "$REPORT_FILE")
    echo -e "TBT:  $TBT"

    # CLS
    CLS=$(jq -r '.audits["cumulative-layout-shift"].displayValue // "N/A"' "$REPORT_FILE")
    echo -e "CLS:  $CLS"

    # Performance Score
    SCORE=$(jq -r '.categories.performance.score // 0' "$REPORT_FILE")
    SCORE_PERCENT=$(echo "$SCORE * 100" | bc)

    echo "─────────────────────────────────────────"
    if (( $(echo "$SCORE >= 0.9" | bc -l) )); then
        echo -e "Score: ${GREEN}${SCORE_PERCENT}%${NC} (Good)"
    elif (( $(echo "$SCORE >= 0.5" | bc -l) )); then
        echo -e "Score: ${YELLOW}${SCORE_PERCENT}%${NC} (Needs Improvement)"
    else
        echo -e "Score: ${RED}${SCORE_PERCENT}%${NC} (Poor)"
    fi

    # LCP Element
    echo ""
    echo -e "${BLUE}🎯 LCP Element:${NC}"
    LCP_ELEMENT=$(jq -r '.audits["largest-contentful-paint-element"].details.items[0].node.snippet // "N/A"' "$REPORT_FILE" 2>/dev/null)
    echo "$LCP_ELEMENT" | head -c 200
    echo ""

else
    echo -e "${YELLOW}⚠️  jq not installed. Install with: sudo apt install jq${NC}"
    echo "Raw report saved to: $REPORT_FILE"
fi

echo ""
echo -e "${GREEN}✅ Reports saved:${NC}"
echo "   JSON: $REPORT_FILE"
echo "   HTML: $HTML_REPORT"
echo ""
echo -e "${BLUE}💡 Tip: Open HTML report in browser for detailed analysis${NC}"
