FROM ubuntu:24.04

RUN apt-get update && \
    apt-get install -y \
      certbot \
      openssl \
      curl \
      jq && \
    rm -rf /var/lib/apt/lists/*

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

COPY renew.sh /renew.sh

RUN chmod +x /renew.sh

ENTRYPOINT ["/renew.sh"]