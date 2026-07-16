#!/bin/sh
set -e

echo "BUILD TYPE IS: [$BUILD_TYPE]"

if [ "$BUILD_TYPE" = "dev" ]; then
    envsubst '$DEV_BACKEND_URL' \
        < /etc/nginx/nginx.conf.template \
        > /etc/nginx/nginx.conf
    echo "Using dev backend URL: $DEV_BACKEND_URL"
else
    envsubst '$PROD_BACKEND_URL' \
        < /etc/nginx/nginx.conf.template \
        > /etc/nginx/nginx.conf
    echo "Using prod backend URL: $PROD_BACKEND_URL"
fi

exec "$@"