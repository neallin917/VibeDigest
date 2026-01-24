#!/bin/bash
# ==============================================
# Backend Health Check Script
# ==============================================
# Checks if the backend is running before starting frontend dev server.
# Usage: ./scripts/check-backend.sh [port]

set -e

# Default port from root .env or fallback
DEFAULT_PORT=16081
PORT="${1:-$DEFAULT_PORT}"
URL="http://localhost:${PORT}/health"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  VibeDigest Backend Health Check"
echo "=========================================="
echo ""

# Check if port is in use
if ! lsof -i :${PORT} > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Nothing is listening on port ${PORT}${NC}"
    echo ""
    echo "Backend is NOT running!"
    echo ""
    echo "To start the backend:"
    echo "  cd backend && uv run uvicorn main:app --port ${PORT} --reload"
    echo ""
    echo "Or with Docker:"
    echo "  docker compose up -d"
    echo ""
    exit 1
fi

# Try to hit health endpoint
echo "Checking backend at http://localhost:${PORT}..."

if curl -s -f -o /dev/null "http://localhost:${PORT}/health" 2>/dev/null; then
    echo -e "${GREEN}Backend is healthy and running on port ${PORT}${NC}"
    echo ""
    exit 0
elif curl -s -f -o /dev/null "http://localhost:${PORT}/" 2>/dev/null; then
    echo -e "${YELLOW}Backend is running on port ${PORT} (no /health endpoint)${NC}"
    echo ""
    exit 0
else
    echo -e "${YELLOW}WARNING: Port ${PORT} is in use but backend may not be responding${NC}"
    echo ""
    echo "Process on port ${PORT}:"
    lsof -i :${PORT} | head -5
    echo ""
    exit 0
fi
