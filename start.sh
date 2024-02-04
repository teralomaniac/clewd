#!/bin/bash

if ! command -v npm &> /dev/null
then
    echo "Install nodejs"
fi

npm install --no-audit --fund false
chown -R $(whoami) lib/bin/*
chmod u+x lib/bin/*
chmod -R 777 $(pwd)
node clewd.js