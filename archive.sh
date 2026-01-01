#!/usr/bin/env bash

find . -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -exec echo -e "\n\n========== FILE: {} ==========" \; \
  -exec cat {} \;

