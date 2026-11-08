# Database CA certificate

Put the **CA certificate of your managed database** here as `aiven-ca.pem`:

1. Aiven Console -> your MySQL service -> **Overview** -> *CA certificate* -> download (`ca.pem`).
2. Save it as `apps/api/certs/aiven-ca.pem`.

It is public information (it only lets the client verify the server, it is not a secret and not a private key), so it is the one
`.pem` file that `.gitignore` allows. **Never put a private key here.** The Dockerfile copies this folder into the image at
`/app/apps/api/certs`, and `DATABASE_URL` points to it with `sslaccept=strict&sslcert=/app/apps/api/certs/aiven-ca.pem`.
Aiven signs every project with its own CA, so a connection without this file fails with "self-signed certificate in certificate chain"
(and Prisma's default `accept_invalid_certs` would encrypt but not verify the server).
