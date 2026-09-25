# BookOrbit Home Assistant add-on

This add-on packages the upstream **BookOrbit 3.1.0** server for Home Assistant OS.

It is an independent community wrapper and is **not affiliated with or endorsed by the BookOrbit project**.

## What it contains

- Upstream `ghcr.io/bookorbit/bookorbit:3.1.0` application image
- PostgreSQL 18 in the same Home Assistant add-on container
- `pgvector`, `uuid-ossp`, `pg_trgm`, and `unaccent` database extensions
- Persistent application and database data under the Home Assistant add-on `/data` directory
- Access to Home Assistant `/media` and `/share`

## First start

1. Install and start the add-on.
2. Open the add-on log.
3. If you left `setup_token` blank, copy the generated **First-run setup token** from the log.
4. Select **Open Web UI**, or browse to `http://homeassistant.local:3000`.
5. Create the first BookOrbit administrator account.
6. In BookOrbit, add a library. The default browser root is `/media`.

## Add-on options

- `app_url`: URL BookOrbit should regard as its public URL. Default `http://homeassistant.local:3000`.
- `library_browse_root`: folder exposed by BookOrbit's library picker. Default `/media`. Set `/` if you need both `/media` and `/share` visible in the picker.
- `setup_token`: optional fixed first-run token. Leave blank to generate and persist one automatically.
- `puid` / `pgid`: UID/GID used by BookOrbit for application/file access. Defaults to `0` for Home Assistant media compatibility during testing.
- `node_memory_mb`: Node.js heap limit. Default `1536` MB, suitable for a 4 GB Pi 4 test installation.
- `log_level`: BookOrbit log level.
- `trust_proxy`: enable only when BookOrbit is deliberately placed behind a trusted reverse proxy.

## Data and backups

The add-on stores PostgreSQL data and BookOrbit-managed application data inside `/data`, so Home Assistant add-on backups include the server database and BookOrbit metadata. Your actual books remain in `/media` or `/share` and should be backed up separately.

## Updating BookOrbit

This wrapper deliberately pins the upstream BookOrbit version. Updating the add-on should be done by changing the upstream image tag and add-on version together, then testing database compatibility before release.

## Upstream

BookOrbit source: https://github.com/bookorbit/bookorbit

BookOrbit is licensed by its upstream authors under the GNU AGPL v3. This wrapper does not modify BookOrbit source code; it adds Home Assistant packaging and startup orchestration around the official upstream image.
