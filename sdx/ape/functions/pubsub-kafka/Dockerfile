FROM denoland/deno:2.7.10

WORKDIR /app

COPY main.ts .

RUN deno cache main.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "main.ts"]
