
mkdir C:\certs -ErrorAction SilentlyContinue

mkcert `
  -cert-file C:\certs\localhost-fullchain.pem `
  -key-file C:\certs\localhost-key.pem `
  localhost 127.0.0.1 ::1