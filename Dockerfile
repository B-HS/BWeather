FROM oven/bun:1-debian AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/dist/index ./index
RUN chmod +x ./index
EXPOSE 3000
CMD ["./index"]
