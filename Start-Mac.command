#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 24 LTS, then reopen this launcher."
  read -r -p "Press Enter to close."
  exit 1
fi
node scripts/launch.mjs
read -r -p "Dear Diary stopped. Press Enter to close."
