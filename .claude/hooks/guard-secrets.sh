#!/usr/bin/env bash
# PreToolUse hook: prevents committing files that likely contain secrets.
# Runs before Edit and Write operations.
# Exit 0 = allow, Exit 2 = block with message.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

# Block writes to .env files
case "$BASENAME" in
  .env|.env.local|.env.production|.env.development|.env.staging|.env.*)
    echo "BLOCKED: Cannot modify $BASENAME — environment files must not be edited by AI."
    echo "Create a .env.local.example instead with placeholder values."
    exit 2
    ;;
esac

# Block writes to certificate and key files
case "$BASENAME" in
  *.pem|*.key|*.p12|*.pfx|*.jks|*.keystore)
    echo "BLOCKED: Cannot modify $BASENAME — certificate/key files must not be edited by AI."
    exit 2
    ;;
  credentials.json|service-account.json|serviceAccountKey.json|gcp-key.json)
    echo "BLOCKED: Cannot modify $BASENAME — credential files must not be edited by AI."
    exit 2
    ;;
  id_rsa|id_ed25519|id_ecdsa|*.pub)
    echo "BLOCKED: Cannot modify $BASENAME — SSH key files must not be edited by AI."
    exit 2
    ;;
esac

# Block writes to iOS config files with secrets
case "$BASENAME" in
  *.xcconfig)
    # Allow .xcconfig.example files
    if echo "$FILE_PATH" | grep -q '\.example'; then
      exit 0
    fi
    echo "BLOCKED: Cannot modify $BASENAME — xcconfig files may contain secrets."
    echo "Create a .xcconfig.example instead."
    exit 2
    ;;
esac

exit 0
