#!/bin/bash

# FFXIV Raid Planner - Development Server Script
# Kills existing servers and starts fresh frontend + backend

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT=5174
BACKEND_PORT=8001

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  FFXIV Raid Planner - Development Servers${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Kill existing servers
echo -e "\n${YELLOW}Stopping existing servers...${NC}"

# Kill process on frontend port
if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
    echo -e "  Killing frontend on port $FRONTEND_PORT"
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
fi

# Kill process on backend port
if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
    echo -e "  Killing backend on port $BACKEND_PORT"
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
fi

# Small delay to ensure ports are freed
sleep 1

echo -e "${GREEN}  Done${NC}"

# Create log directory
LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

# Start backend
echo -e "\n${YELLOW}Starting backend server...${NC}"
cd "$PROJECT_ROOT/backend"
if [ ! -d venv ]; then
    echo -e "  ${RED}ERROR: Backend venv not found. Run:${NC}"
    echo -e "    ${YELLOW}cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt${NC}"
    exit 1
fi
if [ -f venv/Scripts/activate ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi
uvicorn app.main:app --reload --port $BACKEND_PORT > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo -e "  ${GREEN}Backend started${NC} (PID: $BACKEND_PID, Port: $BACKEND_PORT)"
echo -e "  Log: $LOG_DIR/backend.log"

# Start frontend
echo -e "\n${YELLOW}Starting frontend server...${NC}"
cd "$PROJECT_ROOT/frontend"
pnpm dev --port $FRONTEND_PORT --strictPort > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo -e "  ${GREEN}Frontend started${NC} (PID: $FRONTEND_PID, Port: $FRONTEND_PORT)"
echo -e "  Log: $LOG_DIR/frontend.log"

# Wait for servers to be ready
echo -e "\n${YELLOW}Waiting for servers to be ready...${NC}"
sleep 3

# Check if servers are running
BACKEND_OK=false
FRONTEND_OK=false

if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
    BACKEND_OK=true
fi

if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
    FRONTEND_OK=true
fi

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Server Status${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if $BACKEND_OK; then
    echo -e "  ${GREEN}✓${NC} Backend:  http://localhost:$BACKEND_PORT"
else
    echo -e "  ${RED}✗${NC} Backend:  Failed to start (check $LOG_DIR/backend.log)"
fi

if $FRONTEND_OK; then
    echo -e "  ${GREEN}✓${NC} Frontend: http://localhost:$FRONTEND_PORT"
else
    echo -e "  ${RED}✗${NC} Frontend: Failed to start (check $LOG_DIR/frontend.log)"
fi

echo -e "\n${CYAN}Commands:${NC}"
echo -e "  View backend logs:  ${YELLOW}tail -f $LOG_DIR/backend.log${NC}"
echo -e "  View frontend logs: ${YELLOW}tail -f $LOG_DIR/frontend.log${NC}"
echo -e "  Stop servers:       ${YELLOW}$PROJECT_ROOT/dev.sh stop${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Handle stop command
if [ "$1" == "stop" ]; then
    echo -e "${YELLOW}Stopping servers...${NC}"
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}Servers stopped${NC}"
    exit 0
fi

# Handle logs command
if [ "$1" == "logs" ]; then
    tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
fi
