# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o whisper-hub-server cmd/server/main.go

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata ffmpeg wget
WORKDIR /root/

# Create non-root user
RUN addgroup -g 1001 appuser && \
    adduser -D -s /bin/sh -u 1001 -G appuser appuser

# Create temp directory with proper permissions
RUN mkdir -p /tmp/whisper-hub && \
    chown -R appuser:appuser /tmp/whisper-hub

# Copy the binary and web assets from builder stage
COPY --from=builder /app/whisper-hub-server .
COPY --from=builder /app/web ./web

# Change ownership to non-root user
RUN chown -R appuser:appuser . && \
    chown -R appuser:appuser ./web

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --timeout=5 --output-document=- http://localhost:8080/health || exit 1

# Run the application
CMD ["./whisper-hub-server"]