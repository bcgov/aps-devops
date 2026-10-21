# pubsub-webhook

## AI Prompt

- Look for files in current directory only
- All code in single `main.ts` TypeScript file
- Use Deno runtime
- Use `jsr:@std/yaml` for YAML handling
- No environment variables unless explicitely mentioned in requirements
- Listen for SIGTERM and call deno exit
- Serve on port 8000

Database specs:

- Use SQLite database (`https://deno.land/x/sqlite`)
- Create database if it doesn't exist
- No environment variables for sqlite
- Database location: `./data/sqlite.db`

## Requirements

- want endpoints that provide CRUD for: Webhooks (conn_id:string, topic:string, webhook_url: string)
- on a configurable interval have it retrieve all the webhook records, get the topics and use npm:kafkajs to subscribe to all of the topics
- there will be multiple instances of this service, so it should only process each message once
- at the end of the interval gracefully close the connection before starting the next cycle again

## Running the API

```sh
deno run --no-prompt --allow-net --allow-read --allow-env --allow-write main.ts
```

### Testing

```sh
-- add a webhook
restish PUT http://localhost:8000/webhooks \
  'conn_id: 10, webhook_url: "http://localhost/go", topic: "abc"'

-- list webhooks
restish GET http://localhost:8000/webhooks
```

## Deployment

```sh
helm upgrade --install pubsub-webhook \
 --set fullnameOverride=pubsub-webhook \
 -f chart.yaml \
 --set-file "config[0].contents=main.ts" \
bcgov/generic-api
```
