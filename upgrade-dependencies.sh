#!/bin/bash

set -euo pipefail

SCRIPTS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cd "${SCRIPTS_DIR}"

. ./.env.development.local
export NPM_CONFIG_REGISTRY

[[ " $@ " =~ ' -c ' ]] && rm -rf ./bun.lock ./node_modules ./pnpm-lock.yaml

pnpm upgrade -L --lockfile-only &&
    bun i &&
    bun update

./modify-files-permissions.sh
