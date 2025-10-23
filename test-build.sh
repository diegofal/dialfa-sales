#!/bin/bash
# Test the frontend build to reproduce Railway errors

echo "==================================="
echo "SPISA Frontend Build Test"
echo "==================================="
echo ""
echo "This script will attempt to build the frontend"
echo "using Docker Compose to reproduce the Railway build error."
echo ""

echo "Choose an option:"
echo "1. Test Build Only (reproduce error)"
echo "2. Development Mode (after fix)"
echo "3. Production Build (after fix)"
echo "4. Clean build cache and test"
echo ""
read -p "Enter choice (1-4): " CHOICE

case $CHOICE in
    1)
        echo ""
        echo "Building frontend in production mode..."
        echo "This should fail with TypeScript error if bug exists."
        echo ""
        
        if docker compose --profile build-test build frontend-build-test; then
            echo ""
            echo "==================================="
            echo "BUILD SUCCEEDED!"
            echo "==================================="
            echo "The bug has been fixed."
            echo ""
        else
            echo ""
            echo "==================================="
            echo "BUILD FAILED - Bug Reproduced!"
            echo "==================================="
            echo "See DOCKER_BUILD_DEBUG_GUIDE.md for solutions"
            echo ""
        fi
        ;;
    2)
        echo ""
        echo "Starting development mode..."
        echo ""
        docker compose up -d postgres
        sleep 5
        docker compose --profile dev up frontend-dev
        ;;
    3)
        echo ""
        echo "Building and starting production mode..."
        echo ""
        docker compose up -d postgres
        sleep 5
        docker compose --profile prod up --build frontend-prod
        ;;
    4)
        echo ""
        echo "Cleaning Docker build cache..."
        echo ""
        docker builder prune -f
        echo ""
        echo "Building frontend..."
        echo ""
        
        if docker compose --profile build-test build --no-cache frontend-build-test; then
            echo ""
            echo "BUILD SUCCEEDED!"
            echo "The bug has been fixed."
            echo ""
        else
            echo ""
            echo "BUILD FAILED - Bug Reproduced!"
            echo "See DOCKER_BUILD_DEBUG_GUIDE.md for solutions"
            echo ""
        fi
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""

