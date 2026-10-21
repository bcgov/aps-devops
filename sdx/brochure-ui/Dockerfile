# Production image for the SDX Brochure UI (Deno + React SSR)

FROM denoland/deno:alpine-2.8.0

WORKDIR /app

# Cache dependencies first so source-only changes don't bust the layer.
COPY deno.json deno.lock ./

# Application source. config*.yaml is intentionally NOT copied here — it is
# environment-specific, untracked in git, and supplied at deploy time
# (mounted over ./config.yaml by the Helm chart).
COPY main.ts types.ts verify.ts metrics-queries.yaml ./
COPY lib ./lib
COPY pages ./pages
COPY components ./components
COPY public ./public

# Bake BC Sans into public/fonts so containers never fetch fonts at startup.
# The fonts come from the pinned @bcgov/bc-sans npm package (byte-identical
# to the www2.gov.bc.ca web-font zip, which resets connections from GitHub
# runners). The checksum is the package's published npm integrity, in hex.
ARG BC_SANS_VERSION=2.1.2
ARG BC_SANS_SHA512=e3abc6f0d86f4ff2bf7c19e610f99dbe31d8753f7d2360d2e0dc173fa905070792184239c28ca6fc19d0fa9d8c202fcb09542eee780cd81dc011351767c820b1
RUN deno cache main.ts \
    && wget -qO /tmp/bc-sans.tgz \
       "https://registry.npmjs.org/@bcgov/bc-sans/-/bc-sans-${BC_SANS_VERSION}.tgz" \
    && echo "${BC_SANS_SHA512}  /tmp/bc-sans.tgz" | sha512sum -c - \
    && mkdir -p /tmp/bc-sans public/fonts \
    && tar -xzf /tmp/bc-sans.tgz -C /tmp/bc-sans \
    && cp /tmp/bc-sans/package/fonts/* public/fonts/ \
    && rm -rf /tmp/bc-sans /tmp/bc-sans.tgz \
    && chown -R deno:deno /app

USER deno

ENV PORT=5500
EXPOSE 5500

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "--allow-write", "main.ts"]
