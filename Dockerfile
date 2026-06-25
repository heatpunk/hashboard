# Hashboard - StartOS service image
#
# Stage 1: build the Rust proxy (proxy-rs) as a static musl binary.
# rust:alpine uses musl libc by default → the resulting binary runs on any
# alpine-based image without a Rust toolchain.
FROM rust:alpine AS rust-build
WORKDIR /build
RUN apk add --no-cache musl-dev
COPY proxy-rs/ ./proxy-rs/
RUN cd proxy-rs && cargo build --release
# Locate and copy the binary (path includes the host triple)
RUN cp "$(find /build/proxy-rs/target/release -maxdepth 1 -name proxy-rs -type f)" /usr/local/bin/proxy-rs

# Stage 2: build the Vite/React UI to static assets
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: runtime — Node.js serves dist/ and reverse-proxies /api/* to :8081;
#           proxy-rs (Rust, asic-rs) handles the actual miner communication on :8081.
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=rust-build /usr/local/bin/proxy-rs /usr/local/bin/proxy-rs
RUN chmod +x /usr/local/bin/proxy-rs
ENV PORT=80
EXPOSE 80
CMD ["sh","-c","proxy-rs & node server/serve.cjs"]
