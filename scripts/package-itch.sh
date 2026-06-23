#!/usr/bin/env sh
set -eu

out_dir="dist/itch"

rm -rf "$out_dir"
mkdir -p "$out_dir"

cp index.html "$out_dir/index.html"
cp -R src "$out_dir/src"
cp -R assets "$out_dir/assets"

find "$out_dir" -name '.DS_Store' -delete
