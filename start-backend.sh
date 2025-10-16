#!/bin/bash
echo "============================================"
echo "   SPISA - Starting Backend API"
echo "============================================"
echo ""

cd backend/src/Spisa.WebApi
echo "Backend directory: $(pwd)"
echo ""
echo "Starting .NET 8 API..."
echo "URL: http://localhost:5021"
echo "Swagger: http://localhost:5021/swagger"
echo ""
echo "Press Ctrl+C to stop"
echo ""

dotnet run




