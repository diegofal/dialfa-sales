#!/bin/bash
echo "============================================"
echo "   SPISA - Starting All Services"
echo "============================================"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting Backend API..."
./start-backend.sh &
BACKEND_PID=$!
sleep 5

echo "Starting Frontend App..."
./start-frontend.sh &
FRONTEND_PID=$!
sleep 3

echo ""
echo "============================================"
echo "   Services Started Successfully"
echo "============================================"
echo ""
echo "Backend API: http://localhost:5021"
echo "  • Swagger: http://localhost:5021/swagger"
echo "  • PID: $BACKEND_PID"
echo ""
echo "Frontend App: http://localhost:3000"
echo "  • Login: admin / admin123"
echo "  • PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop all services..."
echo ""

# Wait for both processes
wait



