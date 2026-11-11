# Production image for the SDX Brochure UI (Deno + React SSR)

# Build-time assets: the client bundle and BC Sans. Both are the same on
# every architecture, so this stage runs once on the build host's own
# platform and both image platforms copy its output. CI builds arm64 under
# QEMU, where deno and esbuild intermittently crash with SIGILL; running
# them natively here keeps them out of emulation.
FROM --platform=$BUILDPLATFORM denoland/deno:alpine-2.8.0 AS assets

WORKDIR /app

COPY deno.json deno.lock ./
COPY types.ts ./
COPY lib ./lib
COPY components ./components
COPY client ./client
COPY scripts ./scripts

# Bundle the B.C. Design System client islands (client/entry.tsx) into
# public/js/client.js - see scripts/build-client.ts. Needs --allow-run since
# esbuild's Go binary runs as a subprocess; only used at build time, not by
# the running server.
#
# Bake BC Sans into public/fonts so containers never fetch fonts at startup.
# The fonts come from the pinned @bcgov/bc-sans npm package (byte-identical
# to the www2.gov.bc.ca web-font zip, which resets connections from GitHub
# runners). The checksum is the package's published npm integrity, in hex.
ARG BC_SANS_VERSION=2.1.2
ARG BC_SANS_SHA512=e3abc6f0d86f4ff2bf7c19e610f99dbe31d8753f7d2360d2e0dc173fa905070792184239c28ca6fc19d0fa9d8c202fcb09542eee780cd81dc011351767c820b1
RUN deno task build:client \
    && wget -qO /tmp/bc-sans.tgz \
       "https://registry.npmjs.org/@bcgov/bc-sans/-/bc-sans-${BC_SANS_VERSION}.tgz" \
    && echo "${BC_SANS_SHA512}  /tmp/bc-sans.tgz" | sha512sum -c - \
    && mkdir -p /tmp/bc-sans public/fonts \
    && tar -xzf /tmp/bc-sans.tgz -C /tmp/bc-sans \
    && cp /tmp/bc-sans/package/fonts/* public/fonts/

FROM denoland/deno:alpine-2.8.0

WORKDIR /app

# Cache dependencies first so source-only changes don't bust the layer.
COPY deno.json deno.lock ./

# Application source. config*.yaml is intentionally NOT copied here — it is
# environment-specific, untracked in git, and supplied at deploy time
# (mounted over ./config.yaml by the Helm chart). client/ and scripts/ are
# only needed by the assets stage; the server loads the bundled
# public/js/client.js instead.
COPY main.ts types.ts verify.ts metrics-queries.yaml ./
COPY lib ./lib
COPY pages ./pages
COPY components ./components
COPY public ./public
COPY --from=assets /app/public/js ./public/js
COPY --from=assets /app/public/fonts ./public/fonts

RUN deno cache main.ts \
    && chown -R deno:deno /app

USER deno

ENV PORT=5500
EXPOSE 5500

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "--allow-write", "main.ts"]
