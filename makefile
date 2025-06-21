FRONTEND_DIR = ./web
BACKEND_DIR = .

.PHONY: all build-frontend start-backend clean

all: build-frontend start-backend

build-frontend:
	@echo "Building frontend..."
	@cd $(FRONTEND_DIR) && export NODE_OPTIONS="--max_old_space_size=16384 --optimize-for-size" && bun install && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$$(cat ../VERSION) bun run build

start-backend:
	@echo "Starting backend dev server..."
	@cd $(BACKEND_DIR) && go run main.go &

clean:
	@echo "Cleaning build artifacts..."
	@cd $(FRONTEND_DIR) && rm -rf dist node_modules/.vite
