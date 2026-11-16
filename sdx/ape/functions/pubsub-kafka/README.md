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
 --set-file "config[1].contents=history.ts" \
bcgov/generic-api
```

Testing:

```sh
curl -v http://pubsub-kafka/localhost/messages
```

## Replay and access boundary

`GET /{topic}/messages?history=N` accepts an integer from 0 through 1000.
Omitting it, or using 0, streams new events only. Invalid, fractional, negative
or larger values return HTTP 400 before connecting a consumer. For an exact
topic, N is the maximum requested historical offset window **per partition**,
clamped to retained offsets, followed by live events; it is not a global count
or a retention guarantee. Wildcard requests do not replay history. Replay is
best effort and falls back to live streaming if offset lookup fails.

The history join listener is installed before starting the consumer. Validate
first-join replay and retained-offset behavior against the target broker; unit
tests cover parameter validation only.

This function exposes publish and subscribe operations without application
authentication. Keep it private and enforce the approved access policy at its
caller/network boundary. The catalogue proxies its configured topic through
an authenticated same-origin endpoint; catalogue environment selection does not
change that source.
