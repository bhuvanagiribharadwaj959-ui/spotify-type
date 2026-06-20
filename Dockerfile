FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-bullseye-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"

USER node

# Copy public assets and static files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node /app/.next/standalone ./
COPY --from=builder --chown=node /app/.next/static ./.next/static

EXPOSE 7860

# Override the system-set HOSTNAME environment variable (which is overridden by HF to the container name)
# to bind to all IPv4 interfaces (0.0.0.0) so loopback and internal health checks succeed.
CMD ["node", "-e", "process.env.HOSTNAME = '0.0.0.0'; require('./server.js');"]
