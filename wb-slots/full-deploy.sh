#!/bin/bash

echo "========================================"
echo "   WB Slots Full Deployment"
echo "========================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Run system check
echo "Step 1: Running system check..."
if ! ./check-system.sh; then
    echo -e "${RED}❌ System check failed. Please fix the issues and try again.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}Step 2: System check passed! Continuing with deployment...${NC}"
echo

# Choose deployment mode
echo "Choose deployment mode:"
echo "1. Development (single replica, exposed ports)"
echo "2. Production (multiple replicas, load balanced)"
echo
read -p "Enter your choice (1-2): " mode

if [ "$mode" = "1" ]; then
    echo
    echo -e "${BLUE}🚀 Starting Development deployment...${NC}"
    echo
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        if [ -f "env.example" ]; then
            echo "Creating .env from env.example..."
            cp env.example .env
        else
            echo -e "${RED}❌ No environment file found!${NC}"
            exit 1
        fi
    fi
    
    # Build image
    echo "Building application image..."
    if ! docker build -t wb-slots-app:latest .; then
        echo -e "${RED}❌ Failed to build image${NC}"
        exit 1
    fi
    
    # Initialize swarm if needed
    if ! docker node ls >/dev/null 2>&1; then
        echo "Initializing Docker Swarm..."
        docker swarm init
    fi
    
    # Deploy development stack
    echo "Deploying development stack..."
    if ! docker stack deploy -c docker-stack-dev.yml wb-slots-dev; then
        echo -e "${RED}❌ Failed to deploy development stack${NC}"
        exit 1
    fi
    
    echo
    echo -e "${GREEN}✅ Development deployment completed!${NC}"
    echo
    echo -e "${BLUE}🌐 Access points:${NC}"
    echo "   App: http://localhost:3000"
    echo "   DB:  localhost:5432"
    echo "   Redis: localhost:6379"
    echo
    echo -e "${BLUE}📋 Management commands:${NC}"
    echo "   docker stack services wb-slots-dev"
    echo "   docker stack ps wb-slots-dev"
    echo "   docker service logs -f wb-slots-dev_app"
    echo "   docker stack rm wb-slots-dev"
    echo
    
elif [ "$mode" = "2" ]; then
    echo
    echo -e "${BLUE}🚀 Starting Production deployment...${NC}"
    echo
    
    # Check for production env file
    if [ ! -f "env.production" ]; then
        echo -e "${RED}❌ env.production file not found!${NC}"
        echo "Please create it from env.example and configure your settings."
        exit 1
    fi
    
    # Build image
    echo "Building application image..."
    if ! docker build -t wb-slots-app:latest .; then
        echo -e "${RED}❌ Failed to build image${NC}"
        exit 1
    fi
    
    # Initialize swarm if needed
    if ! docker node ls >/dev/null 2>&1; then
        echo "Initializing Docker Swarm..."
        docker swarm init
    fi
    
    # Deploy production stack
    echo "Deploying production stack..."
    if ! docker stack deploy -c docker-stack.yml --with-registry-auth wb-slots; then
        echo -e "${RED}❌ Failed to deploy production stack${NC}"
        exit 1
    fi
    
    echo
    echo -e "${GREEN}✅ Production deployment completed!${NC}"
    echo
    echo -e "${BLUE}🌐 Access points:${NC}"
    echo "   App: http://localhost (via Nginx)"
    echo "   Direct: http://localhost:3000"
    echo
    echo -e "${BLUE}📋 Management commands:${NC}"
    echo "   docker stack services wb-slots"
    echo "   docker stack ps wb-slots"
    echo "   docker service logs -f wb-slots_app"
    echo "   docker stack rm wb-slots"
    echo
    
else
    echo -e "${RED}Invalid choice. Please run the script again.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo
echo "Next steps:"
echo "1. Wait a few minutes for all services to start"
echo "2. Check the status with: docker stack services wb-slots$([ "$mode" = "1" ] && echo "-dev")"
echo "3. View logs with: docker service logs -f wb-slots$([ "$mode" = "1" ] && echo "-dev")_app"
echo "4. Access the application at the URLs shown above"
echo

# Show final status
echo "Current stack status:"
if [ "$mode" = "1" ]; then
    docker stack services wb-slots-dev
else
    docker stack services wb-slots
fi

echo
