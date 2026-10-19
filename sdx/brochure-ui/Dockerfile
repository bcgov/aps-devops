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

# Bake BC Sans into public/fonts so containers start without reaching
# www2.gov.bc.ca. A failed download fails the build rather than every start.
RUN deno cache main.ts \
    && deno run --allow-net --allow-read --allow-env --allow-write lib/fonts.ts \
    && rm -rf /tmp/bcsansfont_web /tmp/bcsansfont_web.zip \
    && chown -R deno:deno /app

USER deno

ENV PORT=5500
EXPOSE 5500

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "--allow-write", "main.ts"]
