#!/bin/bash
# Example usage script for the traffic-jam-session API
# This script demonstrates how to use the mutex locking API

API_URL="http://localhost:3000"

echo "=== Traffic Jam Session - API Usage Examples ==="
echo

# 1. Health Check
echo "1. Health Check"
curl -s "${API_URL}/health" | jq '.'
echo
echo

# 2. Lock a user
echo "2. Lock user 'user-123'"
curl -s -X POST "${API_URL}/lock/user/user-123" \
  -H "Content-Type: application/json" \
  -d '{"processId": "worker-1", "ttl": 60}' | jq '.'
echo
echo

# 3. Check user lock status
echo "3. Check lock status for user 'user-123'"
curl -s "${API_URL}/lock/user/user-123" | jq '.'
echo
echo

# 4. Try to lock the same user again (should fail)
echo "4. Try to lock user 'user-123' again with different process (should fail)"
curl -s -X POST "${API_URL}/lock/user/user-123" \
  -H "Content-Type: application/json" \
  -d '{"processId": "worker-2", "ttl": 60}' | jq '.'
echo
echo

# 5. Unlock the user
echo "5. Unlock user 'user-123'"
curl -s -X POST "${API_URL}/unlock/user/user-123" \
  -H "Content-Type: application/json" \
  -d '{"processId": "worker-1"}' | jq '.'
echo
echo

# 6. Lock a company with multiple users
echo "6. Lock company 'company-456' with users"
curl -s -X POST "${API_URL}/lock/company/company-456" \
  -H "Content-Type: application/json" \
  -d '{
    "processId": "batch-job-1",
    "userIds": ["user-201", "user-202", "user-203"],
    "ttl": 120
  }' | jq '.'
echo
echo

# 7. Check company lock status
echo "7. Check lock status for company 'company-456'"
curl -s "${API_URL}/lock/company/company-456" | jq '.'
echo
echo

# 8. Unlock the company
echo "8. Unlock company 'company-456'"
curl -s -X POST "${API_URL}/unlock/company/company-456" \
  -H "Content-Type: application/json" \
  -d '{
    "processId": "batch-job-1",
    "userIds": ["user-201", "user-202", "user-203"]
  }' | jq '.'
echo
echo

# 9. Lock a contract
echo "9. Lock contract 'contract-789'"
curl -s -X POST "${API_URL}/lock/contract/contract-789" \
  -H "Content-Type: application/json" \
  -d '{"processId": "service-a", "ttl": 45}' | jq '.'
echo
echo

# 10. Check contract lock status
echo "10. Check lock status for contract 'contract-789'"
curl -s "${API_URL}/lock/contract/contract-789" | jq '.'
echo
echo

# 11. Unlock the contract
echo "11. Unlock contract 'contract-789'"
curl -s -X POST "${API_URL}/unlock/contract/contract-789" \
  -H "Content-Type: application/json" \
  -d '{"processId": "service-a"}' | jq '.'
echo
echo

echo "=== All examples completed ==="
