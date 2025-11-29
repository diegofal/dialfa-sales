# SPISA Frontend Dockerfile
# Multi-stage build for Next.js 14

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set placeholder DATABASE_URL for Prisma generate
# Railway will provide the real DATABASE_URL at runtime
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"

# Generate Prisma Client
RUN npx prisma generate

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build arguments for Next.js public env vars
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js application
RUN npm run build

# Stage 3: Runner (Production)
FROM node:20-alpine AS runner
WORKDIR /app

# Install necessary packages for Prisma
RUN apk add --no-cache openssl libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set to production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create bin directory and copy Prisma CLI binary (required for migrations)
RUN mkdir -p ./node_modules/.bin
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Copy startup script with logging
COPY server-with-logs.js ./

# Set ownership and make Prisma binary executable
RUN chown -R nextjs:nodejs /app && \
    chmod +x ./node_modules/.bin/prisma

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))" || exit 1

# Environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server-with-logs.js"]


