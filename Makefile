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
	export SDK_DEBUG_LOG=true  &&\
	source ./local-env.sh &&\
	npm run start-rider

start-manager: SHELL = /bin/bash
start-manager: jest
	export SDK_DEBUG_LOG=true  &&\
	source ./local-env.sh &&\
	npm run start-ops

local-deploy:
	make -C k8s local-deploy
