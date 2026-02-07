#!/bin/bash
cd /opt/automecanik/app/backend
rm -rf dist tsconfig.tsbuildinfo
node --max-old-space-size=6144 ./node_modules/typescript/bin/tsc --build
echo "Build completed with exit code: $?"
