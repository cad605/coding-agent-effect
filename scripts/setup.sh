#!/bin/bash

bun install

git clone https://github.com/effect-ts/effect-smol.git --depth 1 .repos/effect

git clone https://github.com/kitlangton/effect-solutions --depth 1 .repos/effect-patterns

git clone https://github.com/codecrafters-io/build-your-own-claude-code --depth 1 .repos/challenge
