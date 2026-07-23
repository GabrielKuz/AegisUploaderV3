#!/bin/bash

set -euo pipefail

DOMAIN="dataportal.aiscorp.com"

RENEW_LOG=$(mktemp)

certbot renew --deploy-hook "echo renewed" > "$RENEW_LOG" 2>&1

if grep -q "renewed" "$RENEW_LOG"; then
    echo "Renewal detected. Updating Key Vault."

    openssl pkcs12 \
      -export \
      -out /tmp/site.pfx \
      -inkey "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" \
      -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" \
      -password pass:

    az keyvault certificate import \
      --vault-name agw-cert-keyvault \
      --name appgw-cert \
      --file /tmp/site.pfx \
      --password ""

else
    echo "No renewal needed. Skipping Key Vault update."
fi