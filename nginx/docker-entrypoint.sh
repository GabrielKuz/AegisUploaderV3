#!/bin/sh
set -e

echo "BUILD TYPE IS: [$BUILD_TYPE]"

if [ "$BUILD_TYPE" = "dev" ]; then
    envsubst '$DEV_BACKEND_URL' \
        < /etc/nginx/nginx.conf.template \
        > /etc/nginx/nginx.conf
    echo "Using dev backend URL: $DEV_BACKEND_URL"
elif [ "$BUILD_TYPE" = "production" ]; then
    envsubst '$PROD_BACKEND_URL' \
        < /etc/nginx/nginx.azure.conf.template \
        > /etc/nginx/nginx.conf
    echo "Using Azure nginx config"
    echo "Using prod backend URL: $PROD_BACKEND_URL"
fi

exec "$@"