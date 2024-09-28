#!/bin/bash

SCRIPT_DIR=$(dirname "$(realpath "${BASH_SOURCE[0]}")")
exec node $SCRIPT_DIR/dist/index.js "$@"