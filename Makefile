.PHONY: all install start test lint clean help
.PHONY: install-backend install-frontend
.PHONY: start-backend start-frontend start-dev start-prod
.PHONY: test-backend test-frontend
.PHONY: stop deploy

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       - Install both backend and frontend dependencies"
	@echo "  make start-backend - Start the backend server (local)"
	@echo "  make start-frontend- Start the frontend development server"
	@echo "  make start-dev     - Start backend in Docker (Dev Mode, hot reload)"
	@echo "  make start-prod    - Start backend in Docker (Prod Mode, stable)"
	@echo "  make stop          - Stop all Docker containers"
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
start-backend:
	@echo "Starting backend..."
	cd backend && uvicorn main:app --reload --port 8000

start-frontend:
	@echo "Starting frontend..."
	cd frontend && npm run dev

start-dev:
	@echo "Starting Docker (Dev Mode)..."
	docker-compose up --build

start-prod:
	@echo "Starting Production Build..."
	docker-compose -f docker-compose.prod.yml up --build -d

deploy: start-prod

stop:
	@echo "Stopping all containers..."
	docker-compose down
	docker-compose -f docker-compose.prod.yml down

# --- Testing ---
test: test-backend test-frontend

test-backend:
	@echo "Running backend tests..."
	pytest

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm run test

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
