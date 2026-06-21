#!/bin/bash
# Guard: warn when too many direct file reads happen in sequence.
# Triggers on Read tool calls. Counts source file reads via a temp counter.
# After 5 reads, warns to delegate remaining reads to explorer subagent.
#
# This is a soft warning (exit 0), not a block.
#
# CUSTOMIZE: Update the file extension pattern below for your platform.
# Web:  '\.(ts|tsx|js|jsx)$'
# iOS:  '\.(swift|m|h)$'
# Python: '\.py$'

FILE_EXTENSIONS='\.(ts|tsx|js|jsx|swift|m|h|py|go|rs|java|kt)$'

PPID_COUNTER="/tmp/claude-read-counter-${PPID}"

# Read current count
if [ -f "$PPID_COUNTER" ]; then
  COUNT=$(cat "$PPID_COUNTER")
else
  COUNT=0
fi

# Get the tool input
TOOL_INPUT=$(cat)
TOOL_NAME=$(echo "$TOOL_INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | sed 's/.*"tool_name":"//;s/"//')

# Only count Read tool calls for code files
if [ "$TOOL_NAME" = "Read" ]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/.*"file_path":"//;s/"//')

  if echo "$FILE_PATH" | grep -qE "$FILE_EXTENSIONS"; then
    COUNT=$((COUNT + 1))
    echo "$COUNT" > "$PPID_COUNTER"

    if [ "$COUNT" -eq 5 ]; then
      echo "Context budget: 5 code files read directly. Delegate further reads to explorer subagents to keep main context lean." >&2
    elif [ "$COUNT" -gt 5 ] && [ $((COUNT % 3)) -eq 0 ]; then
      echo "Context budget: $COUNT code files read directly. Main context is getting heavy — use explorer subagents." >&2
    fi
  fi
fi

exit 0
