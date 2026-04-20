#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${ALPHA_RESEARCH_REPO_URL:-https://github.com/zenobia-pay/alpha-research.git}"
REPO_REF="${ALPHA_RESEARCH_REF:-codex/initial-substrate}"
INSTALL_ROOT="${ALPHA_RESEARCH_INSTALL_ROOT:-$HOME/.alpha-research/client}"
BIN_DIR="${ALPHA_RESEARCH_BIN_DIR:-$HOME/.local/bin}"
WRAPPER_PATH="${BIN_DIR}/alpha-research"

echo "Installing alpha-research CLI"
echo "  repo: ${REPO_URL}"
echo "  ref:  ${REPO_REF}"
echo "  dir:  ${INSTALL_ROOT}"

mkdir -p "$(dirname "${INSTALL_ROOT}")"
mkdir -p "${BIN_DIR}"

if [ -d "${INSTALL_ROOT}/.git" ]; then
  git -C "${INSTALL_ROOT}" fetch --all --tags
else
  rm -rf "${INSTALL_ROOT}"
  git clone "${REPO_URL}" "${INSTALL_ROOT}"
fi

git -C "${INSTALL_ROOT}" checkout "${REPO_REF}"

cd "${INSTALL_ROOT}"
npm install
npm run build -w @alpha-datasets/cli

cat > "${WRAPPER_PATH}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
node "${INSTALL_ROOT}/apps/cli/dist/index.js" "\$@"
EOF

chmod +x "${WRAPPER_PATH}"

echo
echo "alpha-research CLI installed at ${WRAPPER_PATH}"
echo
echo "If '${BIN_DIR}' is not on your PATH, add this to your shell profile:"
echo "  export PATH=\"${BIN_DIR}:\$PATH\""
echo
echo "Then verify with:"
echo "  alpha-research help"
