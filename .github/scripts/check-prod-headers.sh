#!/usr/bin/env bash
# Production security-header regression check.
# Used by the `prod-headers` job in .github/workflows/security.yml.
#
# Pass URL via env var: URL=https://cambiafiguritas.web.app/ bash check-prod-headers.sh
set -u

URL="${URL:-https://cambiafiguritas.web.app/}"
HDR=$(curl -sIL "$URL")

fail=0
need() {
    local name="$1"
    if ! grep -qi "^${name}:" <<<"$HDR"; then
        echo "FAIL: missing $name header"
        fail=1
    fi
}

need "strict-transport-security"
need "x-content-type-options"
need "x-frame-options"
need "referrer-policy"
need "permissions-policy"

# CSP: accept enforcing or report-only.
if ! grep -qiE "^content-security-policy(-report-only)?:" <<<"$HDR"; then
    echo "FAIL: missing content-security-policy(-report-only)"
    fail=1
fi

if [ "$fail" -eq 0 ]; then
    echo "PASS: production headers OK at $URL"
else
    echo "---"
    echo "Headers seen:"
    echo "$HDR"
    exit 1
fi
