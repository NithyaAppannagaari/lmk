#!/usr/bin/env bash
set -e

REPO="https://github.com/NithyaAppannagaari/lmk.git"
INSTALL_DIR="$HOME/.lmk"
API_URL="https://zoological-smile-production-0bc2.up.railway.app/v1"

echo ""
echo "  installing lmk..."
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found. Install it from https://nodejs.org (v18+) and re-run."
  exit 1
fi

NODE_VERSION=$(node -e "process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "old")
if [ "$NODE_VERSION" = "old" ]; then
  echo "  ✗ Node.js v18+ required. Current: $(node --version)"
  exit 1
fi

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  updating existing install..."
  git -C "$INSTALL_DIR" pull --quiet
else
  git clone --quiet "$REPO" "$INSTALL_DIR"
fi

# Install dependencies
cd "$INSTALL_DIR/apps/cli"
npm install --silent

# Link as global command
npm link --silent 2>/dev/null || sudo npm link --silent

# Set production API URL
node -e "
  import('./src/config.js').then(m => {
    m.default.set('apiUrl', '$API_URL');
  });
"

echo "  ✓ lmk installed"
echo ""
echo "  Get started:"
echo "    lmk auth login   — create your account"
echo "    lmk --llm        — fetch LLM news"
echo "    lmk --chat       — personalize your feed"
echo "    lmk --help       — all options"
echo ""
