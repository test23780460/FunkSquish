#!/usr/bin/env bash
# Verify or restore an encrypted FunkSquish backup.
#
#   npm run backup:verify  -- "<file.tar.gz.gpg>"            (lists contents, restores nothing)
#   npm run backup:restore -- "<file.tar.gz.gpg>" "<target>" (extracts into an EMPTY target folder)
#
# Restoring never overwrites the current project — it extracts into a new folder you choose,
# so you can compare and copy back what you need.
set -euo pipefail

MODE="${1:-}"; FILE="${2:-}"; TARGET="${3:-}"
[[ -f "$FILE" ]] || { echo "Backup file not found: $FILE" >&2; exit 1; }

if [[ -f "$FILE.sha256" ]]; then
  (cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256") || { echo "Checksum mismatch — file may be damaged." >&2; exit 1; }
fi

case "$MODE" in
  verify)
    echo "Enter the backup passphrase to list its contents:"
    gpg --no-symkey-cache --decrypt "$FILE" | tar -tzf - ;;
  restore)
    [[ -n "$TARGET" ]] || { echo "Give a target folder." >&2; exit 1; }
    mkdir -p "$TARGET"
    [[ -z "$(ls -A "$TARGET")" ]] || { echo "Target folder must be empty: $TARGET" >&2; exit 1; }
    echo "Enter the backup passphrase to restore into $TARGET:"
    gpg --no-symkey-cache --decrypt "$FILE" | tar -xzf - -C "$TARGET"
    echo "Restored into $TARGET (contains private/ and assets/brand/)." ;;
  *)
    echo "Usage: verify <file> | restore <file> <empty-target-folder>" >&2; exit 1 ;;
esac
