#!/bin/bash

if [[ "$1" == "load" && -n "$2" ]]; then

    # load environment
    echo "loading environment: $2"
    temp_file=$(mktemp)
    node ./dist/index.js "$@" > "$temp_file"

    # source environment
    cat $temp_file
    source "$temp_file"
    rm "$temp_file"

else
    echo "$1 $2 $3"
    exec node ./dist/index.js "$@"
fi