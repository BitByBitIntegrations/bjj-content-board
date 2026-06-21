#!/bin/bash
# PreToolUse hook: Block edits to protected paths (generated files, dependencies, internals)
# Exit 0 = allow, Exit 2 = block with message
#
# CUSTOMIZE: Uncomment or add paths for your platform and project.

PROTECTED_PATHS=(
  # Universal
  ".git/"           # git internals

  # Web / Node.js
  "node_modules/"   # installed dependencies
  ".next/"          # Next.js build output
  "dist/"           # build output
  "src/generated/"  # Prisma client output (regenerate with `npx prisma generate`)

  # iOS / Swift
  # ".build/"         # Swift build output
  # "DerivedData/"    # Xcode derived data
  # "Pods/"           # CocoaPods dependencies
  # ".swiftpm/"       # Swift Package Manager
  # "SourcePackages/" # Xcode package cache

  # Python
  # "__pycache__/"    # Python bytecode cache
  # ".venv/"          # virtual environment
  # "site-packages/"  # installed packages
)

input=$(cat)

for pattern in "${PROTECTED_PATHS[@]}"; do
  if echo "$input" | grep -qF "\"$pattern"; then
    echo "BLOCKED: '$pattern' is a protected path. Edit this file directly only if you know what you're doing." >&2
    echo "  -> Create a wrapper, copy, or override file outside of '$pattern' instead." >&2
    exit 2
  fi
done

exit 0
