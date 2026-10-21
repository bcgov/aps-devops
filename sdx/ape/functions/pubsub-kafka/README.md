# PubSub Kafka

## Design decisions

- Unique group ID per connection (kafka-controller-<uuid>) so each client independently receives all partitions rather than competing for them
- fromBeginning: false so it only streams messages arriving after the connection opens
- Client disconnect is detected via req.signal which triggers consumer cleanup
- Errors are sent as event: error SSE frames before closing
- have the get messages take a query parameter to specify how many historical messages to return,  
  rather than unspecified where it brings new ones only

### node-rdkafka

```
node-rdkafka ships native .node binaries (compiled C++), and Deno 2.x
  doesn't support loading those regardless of flags.
```

## Development

```sh
KAFKA_BROKERS=kafka:9092 deno run \
  --allow-net --allow-env main.ts
```

## Deployment

```sh
helm upgrade --install pubsub-kafka \
 --set fullnameOverride=pubsub-kafka \
 -f chart.yaml \
 --set-file "config[0].contents=main.ts" \
bcgov/generic-api
```

Testing:

```sh
curl -v http://pubsub-kafka/localhost/messages
```
