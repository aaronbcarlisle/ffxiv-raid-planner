#!/bin/bash

# FFXIV Raid Planner - Development Server Script
# Works on Windows (Git Bash/MSYS2) and Linux/macOS

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT=5174
BACKEND_PORT=8001

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Detect platform
IS_WINDOWS=false
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    IS_WINDOWS=true
fi

# --- Port/process utilities (cross-platform) ---

kill_port() {
    local port=$1
    if $IS_WINDOWS; then
        # Windows: use netstat + taskkill
        local pids
        pids=$(netstat -ano 2>/dev/null | grep ":${port} " | grep "LISTENING" | awk '{print $5}' | sort -u)
        if [ -n "$pids" ]; then
            for pid in $pids; do
                taskkill //F //PID "$pid" > /dev/null 2>&1 || true
            done
            return 0
        fi
    else
        # Unix: use lsof
        if command -v lsof &>/dev/null; then
            local pids
            pids=$(lsof -ti:"$port" 2>/dev/null)
            if [ -n "$pids" ]; then
                echo "$pids" | xargs kill -9 2>/dev/null || true
                return 0
            fi
        fi
    fi
    return 1
}

check_port() {
    local port=$1
    if $IS_WINDOWS; then
        netstat -ano 2>/dev/null | grep ":${port} " | grep -q "LISTENING"
    else
        if command -v lsof &>/dev/null; then
            lsof -ti:"$port" > /dev/null 2>&1
        else
            ss -tlnp 2>/dev/null | grep -q ":${port} "
        fi
    fi
}

check_http() {
    local url=$1
    curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200"
}

# --- Commands ---

stop_servers() {
    echo -e "${YELLOW}Stopping servers...${NC}"
    if kill_port $BACKEND_PORT; then
        echo -e "  ${GREEN}Backend stopped${NC}"
    else
        echo -e "  Backend not running"
    fi
    if kill_port $FRONTEND_PORT; then
        echo -e "  ${GREEN}Frontend stopped${NC}"
    else
        echo -e "  Frontend not running"
    fi
    sleep 1
    echo -e "${GREEN}Done${NC}"
}

# Handle stop command first (before starting anything)
if [ "$1" == "stop" ]; then
    stop_servers
    exit 0
fi

# Handle logs command
if [ "$1" == "logs" ]; then
    LOG_DIR="$PROJECT_ROOT/.logs"
    tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
    exit 0
fi

# --- Start servers ---

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  FFXIV Raid Planner - Development Servers${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Stop any existing servers
echo -e "\n${YELLOW}Stopping existing servers...${NC}"
kill_port $BACKEND_PORT 2>/dev/null && echo -e "  Killed backend on port $BACKEND_PORT" || true
kill_port $FRONTEND_PORT 2>/dev/null && echo -e "  Killed frontend on port $FRONTEND_PORT" || true
sleep 2
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
echo -e "  ${GREEN}Backend starting${NC} (PID: $BACKEND_PID, Port: $BACKEND_PORT)"
echo -e "  Log: $LOG_DIR/backend.log"

# Start frontend
echo -e "\n${YELLOW}Starting frontend server...${NC}"
cd "$PROJECT_ROOT/frontend"
pnpm dev --port $FRONTEND_PORT --strictPort > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo -e "  ${GREEN}Frontend starting${NC} (PID: $FRONTEND_PID, Port: $FRONTEND_PORT)"
echo -e "  Log: $LOG_DIR/frontend.log"

# Wait for servers with HTTP health checks (up to 15 seconds)
echo -e "\n${YELLOW}Waiting for servers...${NC}"
BACKEND_OK=false
FRONTEND_OK=false

for i in $(seq 1 15); do
    if ! $BACKEND_OK && check_http "http://localhost:$BACKEND_PORT/health"; then
        BACKEND_OK=true
    fi
    if ! $FRONTEND_OK && check_port $FRONTEND_PORT; then
        FRONTEND_OK=true
    fi
    if $BACKEND_OK && $FRONTEND_OK; then
        break
    fi
    sleep 1
done

# Status report
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
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
