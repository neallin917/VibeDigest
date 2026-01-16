#!/bin/bash
# Verify Milestone 1: Chat Threads API

BASE_URL="http://localhost:16081"
TASK_ID="00000000-0000-0000-0000-000000000000" # Dummy Task ID

echo "--- 1. Create Mock Task (Direct DB) ---"
docker exec vibedigest-dev-postgres-1 psql -U postgres -d postgres -c "INSERT INTO tasks (id, user_id, video_url, status) VALUES ('$TASK_ID', '00000000-0000-0000-0000-000000000001', 'http://test.com', 'completed') ON CONFLICT (id) DO NOTHING;"

echo -e "\n--- DEBUG: Check Tasks Table ---"
docker exec vibedigest-dev-postgres-1 psql -U postgres -d postgres -c "SELECT id, user_id FROM tasks;"

echo -e "\n--- 2. Create Thread (POST /api/threads) ---"
CREATE_RES=$(curl -v -X POST "$BASE_URL/api/threads" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"$TASK_ID\"}")
echo "Response: $CREATE_RES"
THREAD_ID=$(echo $CREATE_RES | jq -r '.id')
echo "Created Thread ID: $THREAD_ID"

if [ "$THREAD_ID" == "null" ]; then
    echo "Failed to create thread."
    exit 1
fi

echo -e "\n--- 3. List Threads (GET /api/threads) ---"
curl -s -X GET "$BASE_URL/api/threads?task_id=$TASK_ID" | jq .

echo -e "\n--- 4. Update Thread Title (PATCH /api/threads/$THREAD_ID) ---"
curl -s -X PATCH "$BASE_URL/api/threads/$THREAD_ID" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Verification Chat"}' | jq .

echo -e "\n--- 5. Soft Delete Thread (DELETE /api/threads/$THREAD_ID) ---"
curl -s -X DELETE "$BASE_URL/api/threads/$THREAD_ID"
echo "Deleted."

echo -e "\n--- 6. Verify Deletion (GET /api/threads) ---"
# Should be empty or not contain the thread
curl -s -X GET "$BASE_URL/api/threads?task_id=$TASK_ID" | jq .

echo -e "\n--- 7. Verify History (GET /api/threads/$THREAD_ID/messages) ---"
curl -s -X GET "$BASE_URL/api/threads/$THREAD_ID/messages" | jq .

echo -e "\n--- Verification Complete ---"
