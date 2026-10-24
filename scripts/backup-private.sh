#!/usr/bin/env bash
# Encrypted backup of FunkSquish private business records.
#
#   npm run backup -- "<destination folder>"
#   e.g. npm run backup -- "/c/Users/ptrav/OneDrive/Personal Vault Backups"
#        npm run backup -- "/e/FunkSquish-Backups"          (USB drive E:)
#
# Creates  funksquish-private-YYYYMMDD-HHMMSS.tar.gz.gpg  (+ .sha256)
# Encrypted with AES-256 by GnuPG (included with Git for Windows).
# YOU type the passphrase when gpg asks — it is never stored anywhere.
# Original files are never moved or deleted.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  echo "Usage: npm run backup -- \"<destination folder>\"" >&2
  exit 1
fi
mkdir -p "$DEST"

# Refuse destinations inside the project (which is published to GitHub/Netlify).
case "$(cd "$DEST" && pwd)" in
  "$ROOT"/public*|"$ROOT"/src*|"$ROOT"/.next*|"$ROOT")
    echo "Refusing to write a backup inside the website project. Choose a folder outside it." >&2
    exit 1 ;;
esac

command -v gpg >/dev/null || { echo "gpg not found (it comes with Git for Windows)." >&2; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="funksquish-private-$STAMP.tar.gz.gpg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# What to back up: private records + original brand assets.
cd "$ROOT"
INCLUDE=(private assets/brand)
echo "Packing: ${INCLUDE[*]}"
tar -czf "$TMP/backup.tar.gz" "${INCLUDE[@]}"

echo
echo "Encrypting with AES-256. Choose a strong passphrase and store it in your password manager."
echo "(You'll be asked twice. Without it the backup cannot be opened — not even by Claude or Microsoft.)"
gpg --symmetric --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
    --no-symkey-cache --output "$DEST/$NAME" "$TMP/backup.tar.gz"

(cd "$DEST" && sha256sum "$NAME" > "$NAME.sha256")
echo
echo "Backup written:"
echo "  $DEST/$NAME"
echo "  $DEST/$NAME.sha256"
echo
echo "Tip: test it now with:  npm run backup:verify -- \"$DEST/$NAME\""
