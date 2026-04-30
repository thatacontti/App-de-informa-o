SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install up up-deps down restart logs ps build build-all worker-logs migrate migrate-deploy seed studio test test-e2e test-e2e-update typecheck lint format clean smoke-prod release-rollback

help:
	@echo "Painel V27 · Grupo Catarina"
	@echo ""
	@echo "  make install            pnpm install (workspace)"
	@echo "  make up                 docker compose up -d (postgres · redis · web · worker · nginx)"
	@echo "  make up-deps            docker compose up -d postgres redis  (deps only — useful for dev)"
	@echo "  make down               docker compose down"
	@echo "  make restart            restart all services"
	@echo "  make logs               tail logs from all services"
	@echo "  make worker-logs        tail BullMQ worker logs"
	@echo "  make ps                 list running services"
	@echo "  make build              rebuild web image"
	@echo "  make build-all          rebuild web + worker images"
	@echo "  make migrate            prisma migrate dev (creates migration)"
	@echo "  make migrate-deploy     prisma migrate deploy (production)"
	@echo "  make seed               prisma db seed"
	@echo "  make studio             prisma studio"
	@echo "  make test               vitest across all packages"
	@echo "  make test-e2e           playwright e2e suite"
	@echo "  make test-e2e-update    refresh visual regression baselines"
	@echo "  make typecheck          tsc --noEmit across the workspace"
	@echo "  make lint               eslint"
	@echo "  make format             prettier --write ."
	@echo "  make smoke-prod         curl /healthz + /painel/v27/login on the running stack"
	@echo "  make release-rollback   git revert HEAD + redeploy via make build && make up"
	@echo "  make clean              remove node_modules and build artifacts"

install:
	pnpm install

up:
	docker compose up -d

up-deps:
	docker compose up -d postgres redis

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=200

worker-logs:
	docker compose logs -f --tail=200 worker

ps:
	docker compose ps

build:
	docker compose build web

build-all:
	docker compose build web worker

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

test-e2e-update:
	pnpm --filter web exec playwright test e2e/visual --update-snapshots

typecheck:
	pnpm -r typecheck

lint:
	pnpm -r lint

format:
	pnpm format

smoke-prod:
	@echo "→ /healthz"
	curl -fsS -o /dev/null -w "  HTTP %{http_code}\n" http://localhost/healthz
	@echo "→ /painel/v27/login"
	curl -fsS -o /dev/null -w "  HTTP %{http_code}\n" http://localhost/painel/v27/login

release-rollback:
	@echo "→ revert HEAD"
	git revert --no-edit HEAD
	@echo "→ rebuild + redeploy"
	docker compose build web worker
	docker compose up -d web worker

clean:
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/web/.next apps/web/dist packages/*/dist
	rm -rf coverage playwright-report test-results
