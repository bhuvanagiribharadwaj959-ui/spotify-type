FROM node:20-bullseye-slim

# Hugging face runs containers as user 1000 for security.
# The node image already has a built-in user 'node' with UID 1000.
USER node
ENV HOME=/home/node \
    PATH=/home/node/.local/bin:$PATH

WORKDIR $HOME/app

# Copy package files and install dependencies
COPY --chown=node package*.json ./
RUN npm ci

# Copy the rest of the app
COPY --chown=node . .

# Build Next.js
RUN npm run build

# Next.js standalone doesn't include public and static folders
# We need to copy them into the standalone folder
RUN cp -r public .next/standalone/ && \
    cp -r .next/static .next/standalone/.next/ && \
    mkdir -p .next/standalone/public/cache

EXPOSE 7860
ENV NODE_ENV=production
ENV PORT=7860
ENV HOST=0.0.0.0

WORKDIR $HOME/app/.next/standalone

# Start the standalone Next.js server
CMD ["node", "server.js"]
