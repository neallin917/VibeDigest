#!/bin/bash
# Verify Milestone 2: Streaming & Persistence

BASE_URL="http://localhost:16081"
# Use a new task ID to avoid conflicts, or existing one?
# Let's create a new task + thread for clean state.
TASK_ID="00000000-0000-0000-0000-000000000002"

echo "--- 1. Create Mock Task ---"
docker exec vibedigest-dev-postgres-1 psql -U postgres -d postgres -c "INSERT INTO tasks (id, user_id, video_url, status) VALUES ('$TASK_ID', '00000000-0000-0000-0000-000000000001', 'http://test-stream.com', 'completed') ON CONFLICT (id) DO NOTHING;"

echo -e "\n--- 2. Create Thread ---"
RES=$(curl -s -X POST "$BASE_URL/api/threads" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"$TASK_ID\"}")
THREAD_ID=$(echo $RES | jq -r '.id')
echo "Thread ID: $THREAD_ID"

if [ "$THREAD_ID" == "null" ]; then
    echo "Failed to create thread"
    exit 1
fi

echo -e "\n--- 3. Send Message & Stream Response (curl -N) ---"
# We'll use curl -N to see streaming. 
# Input: {"messages": [{"role": "user", "content": "Hello, tell me a short joke."}]}
curl -N -X POST "$BASE_URL/api/threads/$THREAD_ID/stream" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello, tell me a short joke."}]}'

echo -e "\n\n--- 4. Verify Persistence (GET /messages) ---"
# Should now have the User message AND the AI response (if persistence works)
curl -s -X GET "$BASE_URL/api/threads/$THREAD_ID/messages" | jq .
