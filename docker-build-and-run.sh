#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# Load environments
. ./.env.production.local

# Build and run
DOCKER_IMAGE_REF="${DOCKER_IMAGE_NAME:?must be set}:${DOCKER_IMAGE_TAG:-latest}"
docker build \
    -t "${DOCKER_IMAGE_REF}" \
    --build-arg "NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY:?must be set}" \
    --pull \
    .

docker stop "${DOCKER_CONTAINER_NAME:?must be set}" || true
docker rm "${DOCKER_CONTAINER_NAME:?must be set}" || true
docker run \
    -d \
    -p "${DOCKER_CONTAINER_EXPOSE_HOST:?must be set}:${DOCKER_CONTAINER_EXPOSE_PORT:?must be set}:8000" \
    --name "${DOCKER_CONTAINER_NAME:?must be set}" \
    --restart=always \
    "${DOCKER_IMAGE_REF}"
