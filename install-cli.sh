#!/bin/bash

set -e  # Exit on any error
trap 'echo -e "\033[0;31mAn error occurred. Installation aborted.\033[0m"; exit 1' ERR

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[38;2;2;128;175m'
YELLOW='\033[1;33m'
NOCOLOR='\033[0m'

log() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NOCOLOR} $1"
}

log "${BLUE}==================================================${NOCOLOR}"
log "${GREEN}             DeBros CLI Installer                 ${NOCOLOR}"
log "${BLUE}==================================================${NOCOLOR}"

# Check Node.js installation
if ! command -v node &> /dev/null; then
    log "${RED}Node.js is not installed. Please install Node.js 18 or later.${NOCOLOR}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [[ $NODE_VERSION -lt 18 ]]; then
    log "${RED}Node.js version $NODE_VERSION is too old. Please install Node.js 18 or later.${NOCOLOR}"
    exit 1
fi

log "${GREEN}Using Node.js $(node -v)${NOCOLOR}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log "${YELLOW}Warning: Docker is not installed. Some DeBros CLI features require Docker.${NOCOLOR}"
    log "${YELLOW}Please install Docker to use all CLI features: https://docs.docker.com/get-docker/${NOCOLOR}"
else
    log "${GREEN}Docker is installed: $(docker --version)${NOCOLOR}"
fi

# Check if IPFS is installed
if ! command -v ipfs &> /dev/null; then
    log "${YELLOW}Warning: IPFS is not installed. Some DeBros CLI features require IPFS.${NOCOLOR}"
    log "${YELLOW}Would you like to install IPFS now?${NOCOLOR}"
    read -rp "Install IPFS? (yes/no) [Default: yes]: " INSTALL_IPFS
    INSTALL_IPFS="${INSTALL_IPFS:-yes}"
    
    if [[ "$INSTALL_IPFS" == "yes" ]]; then
        log "${CYAN}Installing IPFS...${NOCOLOR}"
        
        # Detect platform
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            PLATFORM="linux"
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            PLATFORM="darwin"
        else
            log "${RED}Unsupported platform: $OSTYPE${NOCOLOR}"
            exit 1
        fi
        
        # Detect architecture
        ARCH=$(uname -m)
        if [[ "$ARCH" == "x86_64" ]]; then
            ARCH="amd64"
        elif [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
            ARCH="arm64"
        else
            log "${RED}Unsupported architecture: $ARCH${NOCOLOR}"
            exit 1
        fi
        
        # Download and install IPFS
        TMP_DIR=$(mktemp -d)
        IPFS_VERSION="0.27.0"
        IPFS_ARCHIVE="kubo_v${IPFS_VERSION}_${PLATFORM}-${ARCH}.tar.gz"
        IPFS_URL="https://dist.ipfs.tech/kubo/v${IPFS_VERSION}/${IPFS_ARCHIVE}"
        
        log "${CYAN}Downloading IPFS from $IPFS_URL${NOCOLOR}"
        curl -L -o "$TMP_DIR/$IPFS_ARCHIVE" "$IPFS_URL"
        
        log "${CYAN}Extracting IPFS...${NOCOLOR}"
        tar -xzf "$TMP_DIR/$IPFS_ARCHIVE" -C "$TMP_DIR"
        
        log "${CYAN}Installing IPFS to /usr/local/bin${NOCOLOR}"
        sudo mv "$TMP_DIR/kubo/ipfs" /usr/local/bin/
        
        # Clean up
        rm -rf "$TMP_DIR"
        
        # Initialize IPFS
        log "${CYAN}Initializing IPFS...${NOCOLOR}"
        ipfs init
        
        log "${GREEN}IPFS installed successfully!${NOCOLOR}"
    fi
else
    log "${GREEN}IPFS is installed: $(ipfs --version)${NOCOLOR}"
fi

# Install DeBros CLI
log "${CYAN}Installing DeBros CLI...${NOCOLOR}"

# Check for package manager preference
if command -v pnpm &> /dev/null; then
    PM="pnpm"
elif command -v yarn &> /dev/null; then
    PM="yarn"
else
    PM="npm"
fi

log "${CYAN}Using package manager: $PM${NOCOLOR}"

# Install the CLI
if [[ "$PM" == "pnpm" ]]; then
    pnpm install -g @debros/cli
elif [[ "$PM" == "yarn" ]]; then
    yarn global add @debros/cli
else
    npm install -g @debros/cli
fi

# Verify installation
if command -v debros &> /dev/null; then
    CLI_VERSION=$(debros --version)
    log "${GREEN}DeBros CLI installed successfully: $CLI_VERSION${NOCOLOR}"
    
    # Create config directory
    mkdir -p "$HOME/.debros"
    
    log "${BLUE}==================================================${NOCOLOR}"
    log "${GREEN}          DeBros CLI Installation Complete        ${NOCOLOR}"
    log "${BLUE}==================================================${NOCOLOR}"
    log "${GREEN}To start using the CLI, run:${NOCOLOR}"
    log "${CYAN}debros init${NOCOLOR}"
    log "${BLUE}==================================================${NOCOLOR}"
    log "${GREEN}Common commands:${NOCOLOR}"
    log "${CYAN}  debros upload <folder>${NOCOLOR} - Upload an app to the network"
    log "${CYAN}  debros list${NOCOLOR} - List network nodes and deployments"
    log "${CYAN}  debros domain check <name>${NOCOLOR} - Check domain availability"
    log "${BLUE}==================================================${NOCOLOR}"
else
    log "${RED}Failed to install DeBros CLI. Please try installing manually:${NOCOLOR}"
    log "${CYAN}npm install -g @debros/cli${NOCOLOR}"
    exit 1
fi