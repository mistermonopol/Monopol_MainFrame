#!/bin/sh
# Run daily from the repository root. The private age key must live off-server.
set -eu
: "${AGE_RECIPIENT:?Set AGE_RECIPIENT to an age public recipient}"
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tmp="backups/.life-$stamp.partial"
trap 'rm -f "$tmp"' EXIT
# First check pg_dump separately; a pipeline must never disguise a failed dump.
dump=$(mktemp)
trap 'rm -f "$tmp" "$dump"' EXIT
chmod 600 "$dump"
if [ -n "${BACKUP_STACK_ID:-}" ]; then
    # Coolify container names may change on redeploy. Select our explicit label,
    # and refuse ambiguous or missing matches rather than backing up another DB.
    container=$(docker ps -q --filter "label=de.monopol.everything.backup=$BACKUP_STACK_ID")
    case "$container" in
        ''|*[!0-9a-f]*) echo 'Expected exactly one running Everything database for BACKUP_STACK_ID' >&2; exit 1 ;;
    esac
    docker exec "$container" pg_dump -U postgres -d life -Fc > "$dump"
else
    docker compose exec -T db pg_dump -U postgres -d life -Fc > "$dump"
fi
age -r "$AGE_RECIPIENT" -o "$tmp" "$dump"
mv "$tmp" "backups/life-$stamp.dump.age"
find backups -maxdepth 1 -type f -name 'life-*.dump.age' -mtime +6 -delete
