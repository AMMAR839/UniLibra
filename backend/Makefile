# --- Makefile UniLibra ---

# Definisi nama target agar tidak bentrok dengan nama folder/file
.PHONY: up down logs test clean

# Menyalakan server dengan mode watch (Live Reload)
up:
	docker compose --env-file .env -f deployments/docker-compose.yml up --build --watch

# Mematikan server dan membersihkan container
down:
	docker compose --env-file .env -f deployments/docker-compose.yml down

# Melihat log backend secara realtime
logs:
	docker logs -f unilibra-backend

# Menjalankan unit test di dalam folder controllers
test:
	go test ./internal/app/controllers/ -v

# Mematikan lalu menyalakan ulang dari nol
restart: down up
