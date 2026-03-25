#!/bin/bash

bun install

git clone https://github.com/effect-ts/effect-smol.git --depth 1 .repos/effect

git clone https://github.com/kitlangton/effect-solutions --depth 1 .repos/effect-patterns

git clone https://github.com/Effectful-Tech/clanka --depth 1 .repos/effect-coding-agent
