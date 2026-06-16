FROM node:20-bullseye-slim

# Install Python and FFmpeg (required for yt-dlp)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Hugging face runs containers as user 1000 for security.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy package files and install dependencies
COPY --chown=user package*.json ./
RUN npm ci

# Copy requirements and create venv
COPY --chown=user requirements.txt .
RUN python3 -m venv .venv
RUN .venv/bin/pip install --no-cache-dir --upgrade -r requirements.txt

# Copy the rest of the app
COPY --chown=user . .

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

# The python script needs .venv which is in $HOME/app/.venv
# The route.ts runs: path.join(process.cwd(), '.venv', 'bin', 'python')
# BUT process.cwd() will be $HOME/app/.next/standalone now!
# So it will look for .next/standalone/.venv!
# Let's copy .venv into standalone as well so the path works perfectly
RUN cp -r $HOME/app/.venv .venv
# Also copy the python script itself into standalone because it runs: path.join(process.cwd(), 'fetch_song_data.py')
RUN cp $HOME/app/fetch_song_data.py ./

# Start the standalone Next.js server
CMD ["node", "server.js"]
