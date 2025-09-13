#!/bin/bash

echo "========================================"
echo "   WB Slots System Check"
echo "========================================"
echo

ERRORS=0

echo "Checking system requirements..."
echo

# Check Docker
echo "[1/6] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    ((ERRORS++))
else
    echo "✅ Docker is installed"
    docker --version
fi

# Check Docker Compose
echo
echo "[2/6] Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available"
    ((ERRORS++))
else
    echo "✅ Docker Compose is available"
    docker compose version
fi

# Check available memory
echo
echo "[3/6] Checking available memory..."
TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
if [ "$TOTAL_MEM" -lt 4 ]; then
    echo "⚠️  Warning: Only ${TOTAL_MEM}GB RAM available (recommended: 4GB+)"
else
    echo "✅ Available memory: ${TOTAL_MEM}GB"
fi

# Check available disk space
echo
echo "[4/6] Checking available disk space..."
FREE_SPACE=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
if [ "$FREE_SPACE" -lt 10 ]; then
    echo "⚠️  Warning: Only ${FREE_SPACE}GB free space (recommended: 10GB+)"
else
    echo "✅ Available disk space: ${FREE_SPACE}GB"
fi

# Check required files
echo
echo "[5/6] Checking required files..."
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found"
    ((ERRORS++))
else
    echo "✅ Dockerfile found"
fi

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found"
    ((ERRORS++))
else
    echo "✅ docker-compose.yml found"
fi

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    ((ERRORS++))
else
    echo "✅ package.json found"
fi

# Check environment files
echo
echo "[6/6] Checking environment configuration..."
if [ ! -f ".env" ]; then
    if [ ! -f "env.example" ]; then
        echo "❌ No environment file found"
        ((ERRORS++))
    else
        echo "⚠️  .env file not found, but env.example exists"
        echo "   Run: cp env.example .env"
    fi
else
    echo "✅ .env file found"
fi

if [ ! -f "env.production" ]; then
    echo "⚠️  env.production not found (needed for production deployment)"
else
    echo "✅ env.production found"
fi

echo
echo "========================================"
echo "   System Check Results"
echo "========================================"

if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! System is ready for deployment."
    echo
    echo "Next steps:"
    echo "1. Configure .env file if needed"
    echo "2. Run ./quick-deploy.sh to start deployment"
    echo "3. Or run ./deploy-stack.sh for manual deployment"
else
    echo "❌ $ERRORS error(s) found. Please fix them before deployment."
    echo
    echo "Common solutions:"
    echo "- Install Docker: https://docs.docker.com/engine/install/"
    echo "- Start Docker service: sudo systemctl start docker"
    echo "- Add user to docker group: sudo usermod -aG docker \$USER"
    echo "- Copy env.example to .env and configure it"
    echo "- Ensure you have at least 4GB RAM and 10GB free disk space"
fi

echo
