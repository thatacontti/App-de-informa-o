SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install up down restart logs ps build seed migrate migrate-deploy studio test test-e2e typecheck lint format clean

help:
	@echo "Painel V27 · Grupo Catarina"
	@echo ""
	@echo "  make install         pnpm install (workspace)"
	@echo "  make up              docker compose up -d (web · postgres · redis · nginx)"
	@echo "  make down            docker compose down"
	@echo "  make restart         restart all services"
	@echo "  make logs            tail logs from all services"
	@echo "  make ps              list running services"
	@echo "  make build           rebuild web image"
	@echo "  make migrate         prisma migrate dev (creates migration)"
	@echo "  make migrate-deploy  prisma migrate deploy (production)"
	@echo "  make seed            prisma db seed"
	@echo "  make studio          prisma studio"
	@echo "  make test            run vitest in all packages"
	@echo "  make test-e2e        run playwright e2e suite"
	@echo "  make typecheck       tsc --noEmit across the workspace"
	@echo "  make lint            eslint across the workspace"
	@echo "  make format          prettier --write ."
	@echo "  make clean           remove node_modules and build artifacts"

install:
	pnpm install

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

build:
	docker compose build web

migrate:
	pnpm --filter web prisma migrate dev

migrate-deploy:
	pnpm --filter web prisma migrate deploy

seed:
	pnpm --filter web prisma db seed

studio:
	pnpm --filter web prisma studio

test:
	pnpm -r test

test-e2e:
	pnpm --filter web test:e2e

typecheck:
	pnpm -r typecheck

lint:
	pnpm -r lint

format:
	pnpm format

clean:
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/web/.next apps/web/dist packages/*/dist
	rm -rf coverage playwright-report test-results
