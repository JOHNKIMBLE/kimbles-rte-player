FROM debian:trixie-slim AS songrec-builder

ENV DEBIAN_FRONTEND=noninteractive
ENV CARGO_HOME=/usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup
ENV PATH=/usr/local/cargo/bin:${PATH}

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    pkg-config \
    libasound2-dev \
    libglib2.0-dev \
    libsoup-3.0-dev \
    libssl-dev \
    libclang-dev \
    gettext \
    intltool \
    ca-certificates \
    && curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal --default-toolchain 1.87.0 \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install \
    --locked \
    --version 0.6.6 \
    --root /songrec-root \
    songrec \
    --no-default-features \
    --features ffmpeg

FROM node:20-trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    git \
    unzip \
    ca-certificates \
    libasound2 \
    libglib2.0-0 \
    libsoup-3.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY scripts ./scripts
RUN npm install --omit=dev

RUN mkdir -p /app/vendor/songrec/bin
COPY --from=songrec-builder /songrec-root/bin/songrec /app/vendor/songrec/bin/songrec

COPY src ./src

ENV PORT=8080
ENV DATA_DIR=/data
ENV DOWNLOAD_DIR=/downloads

VOLUME ["/data", "/downloads"]

EXPOSE 8080

CMD ["npm", "run", "start:server"]
