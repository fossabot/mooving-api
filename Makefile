FORCE:

tslint: FORCE
	npm run tslint

jest: FORCE tsc
	npm run jest

tsc: FORCE
	npm run tsc

spellcheck: FORCE
	npm run spellcheck

pre-push: tslint tsc jest spellcheck

start-rider: SHELL = /bin/bash
start-rider: jest
	source ./local-env.sh &&\
	npm run start-rider

start-manager: SHELL = /bin/bash
start-manager: jest
	source ./local-env.sh &&\
	npm run start-ops

deploy:
	make -C k8s deploy
