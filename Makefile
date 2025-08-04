.PHONY: build up down logs fastapi nodejs push deploy

FASTAPI_IMAGE=kibwa14/plantmate_fastapi
NODEJS_IMAGE=kibwa14/plantmate_nodejs
TAG=latest

build:
	docker compose build --no-cache

run:
	docker compose up -d

stop:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps -a

img:
	docker compose images

rm:
	docker compose rm -f -v

rmi:
	docker image prune -a -f

push:
	docker push $(FASTAPI_IMAGE):$(TAG)
	docker push $(NODEJS_IMAGE):$(TAG)

deploy: build push