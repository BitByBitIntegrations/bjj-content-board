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
  # "generated/"      # code-generated files (Prisma, GraphQL codegen)

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

# Overnight strict mode (armed by /overnight): CI/CD workflows are locked.
# A workflow edited on a branch runs on that branch's push — with repo secrets.
# Workflow changes are a daytime job, reviewed by the founder.

if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/overnight/ACTIVE" ] || [ -f ".claude/overnight/ACTIVE" ]; then
  if echo "$input" | grep -qF ".github/workflows/"; then
    echo "BLOCKED: .github/workflows/ is locked during /overnight — CI/CD changes run with repo secrets." >&2
    echo "  -> Add it as a decision in the morning report instead." >&2
    exit 2
  fi
fi

for pattern in "${PROTECTED_PATHS[@]}"; do
  if echo "$input" | grep -qF "\"$pattern"; then
    echo "BLOCKED: '$pattern' is a protected path. Edit this file directly only if you know what you're doing." >&2
    echo "  -> Create a wrapper, copy, or override file outside of '$pattern' instead." >&2
    exit 2
  fi
done

exit 0
