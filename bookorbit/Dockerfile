FROM ghcr.io/bookorbit/bookorbit:3.1.0

USER root

RUN apk add --no-cache \
      jq \
      openssl \
      postgresql18 \
      postgresql18-contrib \
      postgresql-pgvector

COPY run.sh /run.sh
RUN chmod 0755 /run.sh

ENV PGDATA=/data/postgres/pgdata \
    APP_DATA_PATH=/data/bookorbit-app \
    POSTGRES_HOST=127.0.0.1 \
    POSTGRES_PORT=5432 \
    POSTGRES_USER=bookorbit \
    POSTGRES_DB=bookorbit \
    HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production

EXPOSE 3000

CMD ["/run.sh"]
