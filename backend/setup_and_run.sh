#!/usr/bin/env bash
# Setup backend on Ubuntu with Python 3.14.5, then run FastAPI.
set -euo pipefail

PYTHON_VERSION="3.14.5"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$ROOT/.venv"
PYENV_ROOT="${PYENV_ROOT:-$HOME/.pyenv}"

echo "==> Backend dir: $ROOT"
echo "==> Target Python: $PYTHON_VERSION"

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

echo "==> Installing system build deps (sudo)..."
sudo apt-get update -y
sudo apt-get install -y \
  build-essential curl git wget ca-certificates \
  libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev \
  libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev \
  libffi-dev liblzma-dev

# ---- pyenv ----
if [[ ! -d "$PYENV_ROOT" ]]; then
  echo "==> Installing pyenv..."
  curl -fsSL https://pyenv.run | bash
fi

export PYENV_ROOT
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

# Make pyenv available in future shells
if ! grep -q 'pyenv init' "$HOME/.bashrc" 2>/dev/null; then
  {
    echo ''
    echo '# pyenv'
    echo 'export PYENV_ROOT="$HOME/.pyenv"'
    echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"'
    echo 'eval "$(pyenv init -)"'
  } >> "$HOME/.bashrc"
fi

echo "==> Installing Python $PYTHON_VERSION via pyenv (may take a few minutes)..."
if ! pyenv versions --bare | grep -qx "$PYTHON_VERSION"; then
  pyenv install -s "$PYTHON_VERSION"
fi
pyenv local "$PYTHON_VERSION" 2>/dev/null || true
pyenv shell "$PYTHON_VERSION"

PY_BIN="$(pyenv which python)"
echo "==> Using: $PY_BIN"
"$PY_BIN" --version

echo "==> Recreating venv..."
rm -rf "$VENV"
"$PY_BIN" -m venv "$VENV"
# shellcheck disable=SC1091
source "$VENV/bin/activate"

python -m pip install --upgrade pip setuptools wheel
echo "==> Installing requirements..."
pip install -r "$ROOT/requirements.txt"

echo ""
echo "==> OK — Python $(python --version) | venv: $VENV"
echo "==> Starting API on http://0.0.0.0:8000 ..."
cd "$ROOT"
exec python run.py
