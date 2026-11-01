FROM postgres:17-alpine
# Bake initialization into the image: Coolify need not preserve a checkout
# for repository-relative runtime bind mounts.
COPY ops/init-db.sh /docker-entrypoint-initdb.d/10-init.sh
RUN chmod 0644 /docker-entrypoint-initdb.d/10-init.sh
