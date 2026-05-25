FROM golang:1.26-alpine AS base

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

FROM base AS dev

RUN go install github.com/air-verse/air@latest

COPY . .

EXPOSE 8080

CMD ["air", "--build.cmd", "go build -o tmp/main cmd/unilibra/main.go", "--build.bin", "./tmp/main"]

FROM base AS build

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/unilibra ./cmd/unilibra

FROM alpine:3.22 AS production

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata \
  && adduser -D -H appuser \
  && mkdir -p /app/uploads \
  && chown -R appuser:appuser /app

COPY --from=build /bin/unilibra /app/unilibra

USER appuser

EXPOSE 8080

CMD ["/app/unilibra"]
