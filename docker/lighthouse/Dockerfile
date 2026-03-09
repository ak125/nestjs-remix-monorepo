FROM node:22-slim

# Chromium + tools (glibc required, no Alpine)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium curl jq ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Lighthouse CLI
RUN npm install -g lighthouse && npm cache clean --force

# Supercronic (reliable cron for Docker)
ARG SUPERCRONIC_VERSION=v0.2.33
ARG SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64
ARG SUPERCRONIC_SHA=71b0d58cc53f6bd72571571b3c43e99eda23b9b8
RUN curl -fsSL "$SUPERCRONIC_URL" -o /usr/local/bin/supercronic && \
    echo "${SUPERCRONIC_SHA}  /usr/local/bin/supercronic" | sha1sum -c - && \
    chmod +x /usr/local/bin/supercronic

WORKDIR /app

COPY scripts/lighthouse-cron.sh /app/lighthouse-cron.sh
COPY docker/lighthouse/crontab /app/crontab
RUN chmod +x /app/lighthouse-cron.sh

ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_FLAGS="--no-sandbox --disable-gpu --disable-dev-shm-usage"

CMD ["supercronic", "/app/crontab"]
