# BookOrbit Home Assistant Add-on Repository

Home Assistant OS add-on packaging for the upstream BookOrbit self-hosted reading server.

**Independent community project. Not affiliated with or endorsed by BookOrbit.**

Current package:

- BookOrbit: **3.1.0**
- Home Assistant architectures: **aarch64**, **amd64**
- Web/API port: **3000**
- Database: **PostgreSQL 18 + pgvector**, embedded inside the add-on container

## Install in Home Assistant

Add:

`https://github.com/russellstokes-ai/book-orbit-HA`

under **Settings → Apps → App store → ⋮ → Repositories**.

Then install **BookOrbit** from the app store.

See [`bookorbit/README.md`](bookorbit/README.md) for setup details.

## Architecture

Home Assistant add-ons are single containers, while BookOrbit's official Docker Compose deployment normally uses separate BookOrbit and PostgreSQL containers. This wrapper keeps the official BookOrbit application image but installs PostgreSQL 18 and pgvector alongside it in the same add-on container. Both services use Home Assistant's persistent add-on `/data` storage.

## Licence and attribution

The wrapper scripts and Home Assistant packaging in this repository are provided under the MIT License. BookOrbit itself is an upstream project licensed separately under GNU AGPL v3 and remains subject to its upstream licence and notices.
