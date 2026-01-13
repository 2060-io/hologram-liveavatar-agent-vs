# ═══════════════════════════════════════════════════════════════════════════
# LiveAvatar Agent Dockerfile
# Multi-stage build for Node.js bot server
# ═══════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────
# Stage 1: Node.js Dependencies
# ───────────────────────────────────────────────────────────────────────────
FROM node:24-slim AS node-deps

WORKDIR /app

# Install pnpm
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# ───────────────────────────────────────────────────────────────────────────
# Stage 2: TypeScript Build
# ───────────────────────────────────────────────────────────────────────────
FROM node:24-slim AS node-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and install all deps (including devDependencies)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

# Build TypeScript
RUN pnpm run build

# ───────────────────────────────────────────────────────────────────────────
# Stage 3: Production Runtime
# ───────────────────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime

# Install curl for health checks
RUN apt-get update && apt-get install -y \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ───────────────────────────────────────────────────────────────────────────
# Copy Node.js application
# ───────────────────────────────────────────────────────────────────────────
COPY --from=node-deps /app/node_modules ./node_modules
COPY --from=node-builder /app/build ./build
COPY package.json ./

# Copy static assets
COPY public/ ./public/

# ───────────────────────────────────────────────────────────────────────────
# Create non-root user for security
# ───────────────────────────────────────────────────────────────────────────
RUN groupadd -g 1001 liveavatar && \
    useradd -m -u 1001 -g liveavatar -s /bin/bash liveavatar && \
    chown -R liveavatar:liveavatar /app

USER liveavatar

# ───────────────────────────────────────────────────────────────────────────
# Runtime configuration
# ───────────────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=4001

EXPOSE 4001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4001/health || exit 1

CMD ["node", "build/bot.js"]
