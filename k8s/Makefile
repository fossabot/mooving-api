MINIKUBE_IP=$(shell minikube ip)
PROJECT=<GCP_PROJECT>

FORCE:

build: TIMESTAMP=$(shell date +%y%m%d-%H%M -u)
build: FORCE
	@echo Building with timestamp $(TIMESTAMP)

	docker build . -f Dockerfile.nginx -t nginx:$(TIMESTAMP)
	docker tag nginx:$(TIMESTAMP) gcr.io/$(PROJECT)/nginx:$(TIMESTAMP)
	docker tag nginx:$(TIMESTAMP) gcr.io/$(PROJECT)/nginx:latest
	docker push gcr.io/$(PROJECT)/nginx:$(TIMESTAMP)

	docker build ../. -f Dockerfile -t api:$(TIMESTAMP)
	docker tag api:$(TIMESTAMP) gcr.io/$(PROJECT)/api:$(TIMESTAMP)
	docker tag api:$(TIMESTAMP) gcr.io/$(PROJECT)/api:latest
	docker push gcr.io/$(PROJECT)/api:$(TIMESTAMP)

local-deploy: TIMESTAMP=$(shell date +%y%m%d-%H%M -u)
local-deploy: FORCE
	echo Building Local with timestamp $(TIMESTAMP)
	eval "$$(minikube docker-env)" &&\
		docker build . -f Dockerfile.nginx -t gcr.io/$(PROJECT)/nginx:$(TIMESTAMP) &&\
		docker build ../. -f Dockerfile -t gcr.io/$(PROJECT)/api:$(TIMESTAMP)

	ks show local -o json --ext-str IMAGE_VERSION=$(TIMESTAMP) \
		-c namespace \
		-c rider-deployment \
		-c owner-deployment \
		-c owner-service \
		-c owner-ingress \
		-c rider-service \
		-c rider-ingress \
		-c get-dav-city-ingress > dist/deploy.json

	kubectl apply -f dist/deploy.json

proxy-dev:
	kubectl port-forward -n mooving deployment/api-driver 3005:3005

setup-minikube-docker-registry:
	# https://blog.hasura.io/sharing-a-local-registry-for-minikube-37c7240d0615/
	kubectl create -f https://gist.githubusercontent.com/coco98/b750b3debc6d517308596c248daf3bb1/raw/6efc11eb8c2dce167ba0a5e557833cc4ff38fa7c/kube-registry.yaml
	kubectl port-forward --namespace kube-system $(kubectl get po -n kube-system | grep kube-registry-v0 | \awk '{print $1;}') 5000:5000

create-static-ips-gcp:
	gcloud --project=$(PROJECT) compute addresses create api-rider --global
	gcloud --project=$(PROJECT) compute addresses create api-owner --global
	gcloud --project=$(PROJECT) compute addresses create get-dav-city --global
