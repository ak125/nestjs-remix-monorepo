#!/bin/bash

# 🧪 Script de Test Complet - Service Enhanced
# Validation automatique de toutes les fonctionnalités

echo "🚀 Testing Enhanced Search Service"
echo "=================================="

BASE_URL="http://localhost:3000/api/search-enhanced"
TESTS_PASSED=0
TESTS_FAILED=0

# Function pour tester et valider
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" = "$expected_status" ]; then
        echo "✅ PASS ($response)"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL ($response, expected $expected_status)"
        ((TESTS_FAILED++))
    fi
}

# Function pour tester avec validation JSON
test_json_endpoint() {
    local name="$1"
    local url="$2"
    local jq_filter="$3"
    local expected="$4"
    
    echo -n "Testing $name... "
    
    result=$(curl -s "$url" | jq -r "$jq_filter" 2>/dev/null)
    
    if [ "$result" = "$expected" ]; then
        echo "✅ PASS ($result)"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL ($result, expected $expected)"
        ((TESTS_FAILED++))
    fi
}

echo "1. Health Checks"
echo "---------------"
test_endpoint "Enhanced Health" "$BASE_URL/health" "200"
test_json_endpoint "Health Status" "$BASE_URL/health" ".status" "operational"

echo -e "\n2. Search Functionality" 
echo "----------------------"
test_endpoint "Basic Search" "$BASE_URL/search?query=filtre" "200"
test_endpoint "Brand Search" "$BASE_URL/search?query=BMW" "200"
test_endpoint "Empty Query" "$BASE_URL/search?query=" "200"

echo -e "\n3. Search Results Quality"
echo "------------------------"
test_json_endpoint "Results Count Filtre" "$BASE_URL/search?query=filtre&limit=5" ".items | length" "5"
test_json_endpoint "Results Total BMW" "$BASE_URL/search?query=BMW" ".total > 0" "true"
test_json_endpoint "No Results Test" "$BASE_URL/search?query=xyz123nonexistent" ".total" "0"

echo -e "\n4. Performance Tests"
echo "-------------------"
echo -n "Testing Response Time... "
response_time=$(curl -s "$BASE_URL/search?query=filtre" | jq -r '.executionTime')
if [ "$response_time" -lt 100 ]; then
    echo "✅ PASS (${response_time}ms < 100ms)"
    ((TESTS_PASSED++))
else
    echo "❌ FAIL (${response_time}ms >= 100ms)"
    ((TESTS_FAILED++))
fi

echo -e "\n5. Autocomplete Tests"
echo "--------------------"
test_endpoint "Autocomplete Basic" "$BASE_URL/autocomplete?q=fil" "200"
test_json_endpoint "Autocomplete Count" "$BASE_URL/autocomplete?q=fil" ".suggestions | length" "4"
test_json_endpoint "Autocomplete Content" "$BASE_URL/autocomplete?q=bosch" ".suggestions[0]" "bosch filtre"

echo -e "\n6. Metrics Tests"
echo "---------------"
test_endpoint "Metrics Endpoint" "$BASE_URL/metrics" "200"
test_json_endpoint "Success Rate" "$BASE_URL/metrics" ".successfulSearches > 0" "true"
test_json_endpoint "Total Searches" "$BASE_URL/metrics" ".totalSearches > 0" "true"

echo -e "\n7. Load Test (Concurrent Requests)"
echo "----------------------------------"
echo -n "Testing 5 concurrent requests... "

# Lancer 5 requêtes en parallèle et mesurer
start_time=$(date +%s%N)
for i in {1..5}; do
    curl -s "$BASE_URL/search?query=test$i" > /dev/null &
done
wait
end_time=$(date +%s%N)

total_time=$(( (end_time - start_time) / 1000000 )) # Convert to ms

if [ "$total_time" -lt 1000 ]; then
    echo "✅ PASS (${total_time}ms for 5 concurrent requests)"
    ((TESTS_PASSED++))
else
    echo "❌ FAIL (${total_time}ms for 5 concurrent requests)"
    ((TESTS_FAILED++))
fi

echo -e "\n8. Final Metrics Check"
echo "---------------------"
final_metrics=$(curl -s "$BASE_URL/metrics")
total_searches=$(echo "$final_metrics" | jq -r '.totalSearches')
success_rate=$(echo "$final_metrics" | jq -r '(.successfulSearches/.totalSearches*100 | round)')

echo "📊 Final Statistics:"
echo "   Total Searches: $total_searches"
echo "   Success Rate: $success_rate%"
echo "   Average Response: $(echo "$final_metrics" | jq -r '.averageResponseTime')ms"

echo -e "\n🏁 Test Results Summary"
echo "======================="
echo "✅ Tests Passed: $TESTS_PASSED"
echo "❌ Tests Failed: $TESTS_FAILED"
echo "📊 Success Rate: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ALL TESTS PASSED! Service Enhanced is production ready! 🚀"
    exit 0
else
    echo -e "\n⚠️  Some tests failed. Check the results above."
    exit 1
fi