FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY scripts ./scripts
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8080
ENV DATA_DIR=/data
ENV DOWNLOAD_DIR=/downloads

VOLUME ["/data", "/downloads"]

EXPOSE 8080

CMD ["npm", "run", "start:server"]
