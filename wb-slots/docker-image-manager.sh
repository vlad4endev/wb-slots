#!/bin/bash

echo "========================================"
echo "   WB Slots Docker Image Manager"
echo "========================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

while true; do
    echo "Choose an action:"
    echo "1. Build image"
    echo "2. Build development image"
    echo "3. Build production image"
    echo "4. Push image to registry"
    echo "5. Pull image from registry"
    echo "6. Run image"
    echo "7. Run development image"
    echo "8. Stop and remove container"
    echo "9. View logs"
    echo "10. Execute shell in container"
    echo "11. Clean up images"
    echo "12. Run tests"
    echo "13. Backup data"
    echo "14. Update image"
    echo "15. Exit"
    echo
    read -p "Enter your choice (1-15): " choice

    case $choice in
        1)
            echo
            echo -e "${BLUE}🔨 Building Docker image...${NC}"
            if docker build -t wb-slots-app:latest .; then
                echo -e "${GREEN}✅ Image built successfully!${NC}"
            else
                echo -e "${RED}❌ Build failed!${NC}"
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        2)
            echo
            echo -e "${BLUE}🔨 Building development image...${NC}"
            if docker build -t wb-slots-app:dev --target builder .; then
                echo -e "${GREEN}✅ Development image built successfully!${NC}"
            else
                echo -e "${RED}❌ Build failed!${NC}"
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        3)
            echo
            echo -e "${BLUE}🔨 Building production image...${NC}"
            if docker build -t wb-slots-app:prod --target runner .; then
                echo -e "${GREEN}✅ Production image built successfully!${NC}"
            else
                echo -e "${RED}❌ Build failed!${NC}"
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        4)
            echo
            echo -e "${BLUE}📤 Pushing image to registry...${NC}"
            read -p "Enter registry URL (e.g., your-registry.com): " registry
            if [ -z "$registry" ]; then
                echo -e "${RED}❌ Registry URL is required!${NC}"
            else
                docker tag wb-slots-app:latest "$registry/wb-slots:latest"
                if docker push "$registry/wb-slots:latest"; then
                    echo -e "${GREEN}✅ Image pushed successfully!${NC}"
                else
                    echo -e "${RED}❌ Push failed!${NC}"
                fi
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        5)
            echo
            echo -e "${BLUE}📥 Pulling image from registry...${NC}"
            read -p "Enter registry URL (e.g., your-registry.com): " registry
            if [ -z "$registry" ]; then
                echo -e "${RED}❌ Registry URL is required!${NC}"
            else
                if docker pull "$registry/wb-slots:latest"; then
                    echo -e "${GREEN}✅ Image pulled successfully!${NC}"
                else
                    echo -e "${RED}❌ Pull failed!${NC}"
                fi
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        6)
            echo
            echo -e "${BLUE}🚀 Running Docker container...${NC}"
            if docker run -d --name wb-slots-app -p 3000:3000 wb-slots-app:latest; then
                echo -e "${GREEN}✅ Container started successfully!${NC}"
                echo -e "${BLUE}🌐 Application available at: http://localhost:3000${NC}"
            else
                echo -e "${RED}❌ Failed to start container!${NC}"
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        7)
            echo
            echo -e "${BLUE}🚀 Running development container...${NC}"
            if docker run -d --name wb-slots-app-dev -p 3000:3000 -v "$(pwd):/app" wb-slots-app:dev; then
                echo -e "${GREEN}✅ Development container started successfully!${NC}"
                echo -e "${BLUE}🌐 Application available at: http://localhost:3000${NC}"
            else
                echo -e "${RED}❌ Failed to start development container!${NC}"
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        8)
            echo
            echo -e "${BLUE}🛑 Stopping and removing container...${NC}"
            docker stop wb-slots-app wb-slots-app-dev 2>/dev/null
            docker rm wb-slots-app wb-slots-app-dev 2>/dev/null
            echo -e "${GREEN}✅ Containers stopped and removed!${NC}"
            echo
            read -p "Press Enter to continue..."
            ;;
        9)
            echo
            echo -e "${BLUE}📋 Container logs:${NC}"
            echo "Choose container:"
            echo "1. wb-slots-app"
            echo "2. wb-slots-app-dev"
            echo
            read -p "Enter choice (1-2): " container
            if [ "$container" = "1" ]; then
                docker logs -f wb-slots-app
            elif [ "$container" = "2" ]; then
                docker logs -f wb-slots-app-dev
            else
                echo -e "${RED}Invalid choice!${NC}"
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        10)
            echo
            echo -e "${BLUE}🐚 Executing shell in container...${NC}"
            echo "Choose container:"
            echo "1. wb-slots-app"
            echo "2. wb-slots-app-dev"
            echo
            read -p "Enter choice (1-2): " container
            if [ "$container" = "1" ]; then
                docker exec -it wb-slots-app sh
            elif [ "$container" = "2" ]; then
                docker exec -it wb-slots-app-dev sh
            else
                echo -e "${RED}Invalid choice!${NC}"
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        11)
            echo
            echo -e "${BLUE}🧹 Cleaning up Docker images...${NC}"
            echo "This will remove all wb-slots-app images. Continue? (y/N)"
            read -p "Enter y to confirm: " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                docker rmi wb-slots-app:latest wb-slots-app:dev wb-slots-app:prod 2>/dev/null
                docker system prune -f
                echo -e "${GREEN}✅ Cleanup completed!${NC}"
            else
                echo "Cleanup cancelled."
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        12)
            echo
            echo -e "${BLUE}🧪 Running tests...${NC}"
            echo "Choose test type:"
            echo "1. Unit tests"
            echo "2. Integration tests"
            echo "3. E2E tests"
            echo
            read -p "Enter choice (1-3): " test_type
            if [ "$test_type" = "1" ]; then
                docker run --rm wb-slots-app:latest npm test
            elif [ "$test_type" = "2" ]; then
                docker run --rm wb-slots-app:latest npm run test:integration
            elif [ "$test_type" = "3" ]; then
                docker run --rm wb-slots-app:latest npm run test:e2e
            else
                echo -e "${RED}Invalid choice!${NC}"
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        13)
            echo
            echo -e "${BLUE}💾 Creating backup...${NC}"
            backup_name="wb-slots-backup-$(date +%Y%m%d_%H%M%S)"
            echo "Creating backup: $backup_name"

            # Backup database
            docker exec wb-slots-postgres pg_dump -U postgres wb_slots > "${backup_name}-database.sql" 2>/dev/null

            # Backup Redis
            docker exec wb-slots-redis redis-cli BGSAVE >/dev/null 2>&1
            docker cp wb-slots-redis:/data/dump.rdb "${backup_name}-redis.rdb" 2>/dev/null

            echo -e "${GREEN}✅ Backup created: $backup_name${NC}"
            echo
            read -p "Press Enter to continue..."
            ;;
        14)
            echo
            echo -e "${BLUE}🔄 Updating image...${NC}"
            echo "This will pull the latest image and update the running container."
            read -p "Enter registry URL (e.g., your-registry.com): " registry
            if [ -z "$registry" ]; then
                echo -e "${RED}❌ Registry URL is required!${NC}"
            else
                echo "Pulling latest image..."
                if docker pull "$registry/wb-slots:latest"; then
                    echo "Stopping current container..."
                    docker stop wb-slots-app 2>/dev/null
                    docker rm wb-slots-app 2>/dev/null

                    echo "Starting updated container..."
                    docker run -d --name wb-slots-app -p 3000:3000 "$registry/wb-slots:latest"

                    echo -e "${GREEN}✅ Update completed!${NC}"
                else
                    echo -e "${RED}❌ Update failed!${NC}"
                fi
            fi
            echo
            read -p "Press Enter to continue..."
            ;;
        15)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Please try again.${NC}"
            echo
            ;;
    esac
done
