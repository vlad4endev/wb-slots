#!/bin/bash

echo "========================================"
echo "   WB Slots Docker Stack Deployment"
echo "========================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker version >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Check if Docker Swarm is initialized
if ! docker node ls >/dev/null 2>&1; then
    echo -e "${YELLOW}🔧 Initializing Docker Swarm...${NC}"
    docker swarm init
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to initialize Docker Swarm${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker Swarm initialized${NC}"
fi

# Check if env.production exists
if [ ! -f "env.production" ]; then
    echo -e "${RED}❌ env.production file not found!${NC}"
    echo "Please create env.production file with your production settings."
    exit 1
fi

# Build the application image
echo -e "${BLUE}🔨 Building application image...${NC}"
docker build -t wb-slots-app:latest .
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build application image${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Application image built successfully${NC}"

# Deploy the stack
echo -e "${BLUE}🚀 Deploying Docker Stack...${NC}"
docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to deploy Docker Stack${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker Stack deployed successfully!${NC}"
echo
echo -e "${BLUE}📊 Stack Status:${NC}"
docker stack services wb-slots

echo
echo -e "${BLUE}🌐 Application will be available at:${NC}"
echo "   http://localhost (via Nginx)"
echo "   http://localhost:3000 (direct access)"
echo
echo -e "${BLUE}📋 Useful commands:${NC}"
echo "   docker stack services wb-slots"
echo "   docker stack ps wb-slots"
echo "   docker service logs wb-slots_app"
echo "   docker stack rm wb-slots"
echo
