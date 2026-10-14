#!/usr/bin/env bash
# ==============================================================================
# RoomCommerce — Host Tooling & Modal CLI Bootstrapper
# File: scripts/setup-host-tools.sh
# Purpose: Resolves BUG-002 & TASK-002 by ensuring python3, pip3, and the Modal CLI
#          are properly installed and configured in the host environment.
# ==============================================================================

set -euo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}=== RoomCommerce Host Tooling & Modal CLI Bootstrapper ===${RESET}\n"

# 1. Verify Python 3
echo -n "Checking Python 3... "
if command -v python3 >/dev/null 2>&1; then
    PY_VERSION=$(python3 --version 2>&1)
    echo -e "${GREEN}Found (${PY_VERSION})${RESET}"
else
    echo -e "${RED}NOT FOUND${RESET}"
    echo -e "${RED}Error: python3 is required. Please install Python 3.11+ via homebrew or python.org.${RESET}"
    exit 1
fi

# 2. Verify pip3
echo -n "Checking pip3... "
if python3 -m pip --version >/dev/null 2>&1; then
    PIP_VERSION=$(python3 -m pip --version 2>&1 | awk '{print $1, $2}')
    echo -e "${GREEN}Found (${PIP_VERSION})${RESET}"
else
    echo -e "${YELLOW}pip not found, attempting bootstrap via ensurepip...${RESET}"
    python3 -m ensurepip --user || true
fi

# 3. Check for Modal CLI
echo -n "Checking Modal CLI (python3 -m modal)... "
if python3 -m modal --version >/dev/null 2>&1; then
    MODAL_VER=$(python3 -m modal --version 2>&1)
    echo -e "${GREEN}Found (${MODAL_VER})${RESET}"
else
    echo -e "${YELLOW}NOT FOUND${RESET}"
    echo -e "${CYAN}Installing modal via 'python3 -m pip install --user modal'...${RESET}"
    python3 -m pip install --user --upgrade modal

    if python3 -m modal --version >/dev/null 2>&1; then
        MODAL_VER=$(python3 -m modal --version 2>&1)
        echo -e "${GREEN}Successfully installed ${MODAL_VER}!${RESET}"
    else
        echo -e "${RED}Installation finished, but 'python3 -m modal' could not be executed.${RESET}"
        echo -e "${YELLOW}Tip: Ensure your Python user bin directory (e.g. ~/Library/Python/3.x/bin) is in your PATH.${RESET}"
    fi
fi

# 4. Check Node.js and pnpm
echo -n "Checking Node.js... "
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node --version)
    echo -e "${GREEN}Found (${NODE_VER})${RESET}"
else
    echo -e "${YELLOW}Warning: node not found in PATH.${RESET}"
fi

echo -n "Checking pnpm... "
if command -v pnpm >/dev/null 2>&1; then
    PNPM_VER=$(pnpm --version)
    echo -e "${GREEN}Found (v${PNPM_VER})${RESET}"
else
    echo -e "${YELLOW}Warning: pnpm not found in PATH.${RESET}"
fi

echo -e "\n${BOLD}${GREEN}=== Host Tooling Check Complete ===${RESET}"
echo -e "${BOLD}Next Operational Steps:${RESET}"
echo -e "  1. Authenticate with Modal Cloud:"
echo -e "     ${CYAN}python3 -m modal setup${RESET}"
echo -e "  2. Deploy the serverless GPU pipeline:"
echo -e "     ${CYAN}pnpm gpu:deploy${RESET}  (or: ${CYAN}python3 -m modal deploy workers/gpu-runner/modal_app.py${RESET})"
echo -e "  3. Copy the returned HTTPS endpoint URL to ${BOLD}MODAL_API_ENDPOINT${RESET} in your .env / SSM.\n"
