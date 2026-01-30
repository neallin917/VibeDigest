.PHONY: all install start test lint clean help
.PHONY: install-backend install-frontend
.PHONY: start-backend start-frontend start-dev start-prod
.PHONY: test-backend test-frontend
.PHONY: stop restart-dev rebuild-dev restart-prod deploy

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       - Install both backend and frontend dependencies"
	@echo "  make start-backend - Start the backend server (local)"
	@echo "  make start-frontend- Start the frontend development server"
	@echo "  make start-dev     - Start backend in Docker (Dev Mode, hot reload)"
	@echo "  make start-prod    - Start backend in Docker (Prod Mode, stable)"
	@echo "  make stop          - Stop all Docker containers"
	@echo "  make restart-dev   - Restart backend in Docker (quick, no rebuild)"
	@echo "  make rebuild-dev   - Rebuild backend in Docker (full rebuild)"
	@echo "  make restart-prod  - Restart backend in Docker (Prod Mode)"
	@echo "  make deploy        - Deploy to Production (Same as start-prod for now)"
	@echo "  make test          - Run all tests"
	@echo "  make lint          - Run formatters and linters"
	@echo "  make clean         - Clean up temporary files"

# --- Installation ---
install: install-backend install-frontend

install-backend:
	@echo "Installing backend dependencies..."
	pip install -r requirements.txt

install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# --- Execution ---
# --- Execution ---
start-backend:
	@echo "Starting backend..."
	cd backend && uvicorn main:app --reload --port 8000

start-frontend:
	@echo "Starting frontend..."
	cd frontend && npm run dev

# --- Docker Environment (Isolated) ---
# Dev: Builds from source, Hot Reloads
PROJ_DEV=vibedigest-dev
start-dev:
	@echo "Starting Docker (Dev Mode)... [Project: $(PROJ_DEV)]"
	COMPOSE_PROJECT_NAME=$(PROJ_DEV) docker-compose -f docker-compose.yml up --build -d

# Prod: Runs Immutable Image, No Build
PROJ_PROD=vibedigest-prod
start-prod:
	@echo "Starting Docker (Prod Mode)... [Project: $(PROJ_PROD)]"
	@echo "ℹ️  Using image: transcriber-backend:prod"
	COMPOSE_PROJECT_NAME=$(PROJ_PROD) docker-compose -f docker-compose.prod.yml up -d

# Release: Explicitly builds the production image
release-prod:
	@echo "Building Production Image..."
	docker build -t transcriber-backend:prod -f backend/Dockerfile .
	@echo "✅ New production image built: transcriber-backend:prod"
	@echo "Run 'make start-prod' to deploy."

deploy: release-prod start-prod

stop:
	@echo "Stopping all containers..."
	COMPOSE_PROJECT_NAME=$(PROJ_DEV) docker-compose down
	COMPOSE_PROJECT_NAME=$(PROJ_PROD) docker-compose -f docker-compose.prod.yml down

restart-dev:
	@echo "Restarting Docker (Dev Mode)... [Quick - no rebuild]"
	COMPOSE_PROJECT_NAME=$(PROJ_DEV) docker-compose down
	COMPOSE_PROJECT_NAME=$(PROJ_DEV) docker-compose up -d

rebuild-dev:
	@echo "Rebuilding Docker (Dev Mode)... [Full rebuild]"
	COMPOSE_PROJECT_NAME=$(PROJ_DEV) docker-compose down
	COMPOSE_PROJECT_NAME=$(PROJ_DEV) docker-compose up --build -d

restart-prod:
	@echo "Restarting Docker (Prod Mode)..."
	COMPOSE_PROJECT_NAME=$(PROJ_PROD) docker-compose -f docker-compose.prod.yml down
	COMPOSE_PROJECT_NAME=$(PROJ_PROD) docker-compose -f docker-compose.prod.yml up -d

# --- Testing ---
test: test-backend test-frontend

test-backend:
	@echo "Running backend tests..."
	export PYTHONPATH=$$(pwd)/backend && pytest -c backend/pytest.ini backend

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm run test

verify:
	@echo "Verifying LLM connection..."
	export PYTHONPATH=$$(pwd)/backend && backend/venv/bin/python3 backend/scripts/verify_llm_connection.py
	@echo "Verifying Workflow..."
	export PYTHONPATH=$$(pwd)/backend && backend/venv/bin/python3 backend/scripts/manual_test_workflow.py

# --- Quality Control ---
lint:
	@echo "Linting backend..."
	# assuming ruff or black if available, otherwise just echo
	@echo "Linting frontend..."
	cd frontend && npm run lint

# --- Utility ---
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	rm -rf backend/temp/*
	rm -rf backend/downloads/*
