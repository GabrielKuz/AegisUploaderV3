#!/bin/sh
# set -e

# envsubst '$BACKEND_URL' \
#     < /etc/nginx/nginx.conf.template \
#     > /etc/nginx/nginx.conf

# exec "$@"

set -e

echo "BACKEND_URL IS: [$BACKEND_URL]"

envsubst '$BACKEND_URL' \
    < /etc/nginx/nginx.conf.template \
    > /etc/nginx/nginx.conf

exec "$@"