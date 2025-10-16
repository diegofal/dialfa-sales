# SPISA Backend API Dockerfile
# Multi-stage build for .NET 8

# Stage 1: Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files and restore dependencies
COPY ["src/Spisa.WebApi/Spisa.WebApi.csproj", "Spisa.WebApi/"]
COPY ["src/Spisa.Application/Spisa.Application.csproj", "Spisa.Application/"]
COPY ["src/Spisa.Domain/Spisa.Domain.csproj", "Spisa.Domain/"]
COPY ["src/Spisa.Infrastructure/Spisa.Infrastructure.csproj", "Spisa.Infrastructure/"]

RUN dotnet restore "Spisa.WebApi/Spisa.WebApi.csproj"

# Copy source code
COPY src/ .

# Build
WORKDIR "/src/Spisa.WebApi"
RUN dotnet build "Spisa.WebApi.csproj" -c Release -o /app/build

# Stage 2: Publish stage
FROM build AS publish
RUN dotnet publish "Spisa.WebApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Create non-root user for security
RUN useradd -m -u 1000 spisa && chown -R spisa:spisa /app
USER spisa

# Copy published app
COPY --from=publish --chown=spisa:spisa /app/publish .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Run the application
ENTRYPOINT ["dotnet", "Spisa.WebApi.dll"]


