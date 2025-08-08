#!/bin/sh

set -ex
cd backend

# Fail fast en prod si variables critiques manquantes
if [ "$NODE_ENV" = "production" ]; then
	if [ -z "$SESSION_SECRET" ]; then
		echo "SESSION_SECRET manquant en production" >&2
		exit 1
	fi
fi

npm run start