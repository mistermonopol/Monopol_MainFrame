#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres \
  --set=app_password="$APP_DB_PASSWORD" --set=health_password="$HEALTH_DB_PASSWORD" <<'SQL'
CREATE ROLE life_app LOGIN PASSWORD :'app_password';
CREATE ROLE life_health LOGIN PASSWORD :'health_password';
CREATE DATABASE life;
REVOKE ALL ON DATABASE life FROM PUBLIC;
GRANT CONNECT ON DATABASE life TO life_app, life_health;
SQL
psql -v ON_ERROR_STOP=1 --username postgres --dbname life <<'SQL'
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA core AUTHORIZATION life_app;
CREATE SCHEMA health AUTHORIZATION life_health;
ALTER ROLE life_app IN DATABASE life SET search_path = core;
ALTER ROLE life_health IN DATABASE life SET search_path = health;
SQL
