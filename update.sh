#!/bin/bash

if ! [ -x "$(command -v git)" ]
then
	echo "Install git to update"
	exit
fi

if [ -x "$(command -v git)" ]
then
    if [ -d ".git" ]
	then
		git config --local url."https://".insteadOf git://
		git config --local url."https://github.com/".insteadOf git@github.com:
		git config --local url."https://".insteadOf ssh://
		git pull --rebase --autostash
	else
		echo "Only able to update if you clone the repository (git clone https://github.com/teralomaniac/clewd.git)"
	fi
fi