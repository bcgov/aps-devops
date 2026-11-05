FROM denoland/deno:alpine-2.8.0
WORKDIR /app
COPY deno.json main.ts index.html auth.js ./
COPY server ./server
RUN mkdir /app/data && chown -R deno:deno /app
USER deno
EXPOSE 8000
CMD ["task", "start"]
