#!/bin/bash

set -e
git fetch https://github.com/kiki-core-stack/base-backend main
git merge FETCH_HEAD
