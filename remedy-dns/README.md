# Remedy DNS preparation (APS-5029)

Offline prototype for reviewing an adapted DNS export and preparing a new record.
The proposed ticket criteria still need team agreement. This is not a Remedy
adapter: it does not authenticate, query Remedy, submit requests or change DNS.
Python 3 standard library only; no dependencies or credentials required.

## Example workflow

Obtain a current export from the operator-approved inventory and adapt it to the
JSON record array below. The actual export source/format has not been established.
Obtain an approved owned-domain list separately; a user-created list is not proof
of ownership. Use only the selected domain's records in the inventory.

`owned.json` (illustrative reserved test domain):
```json
["example.test"]
```
`inventory.json`:
```json
[{"name":"existing.example.test","type":"A","value":"192.0.2.1","ttl":300}]
```
`record.json`:
```json
{"name":"new.example.test","type":"CNAME","value":"existing.example.test","ttl":300}
```

From this folder:
```sh
python3 remedy_dns.py extract --domain example.test --owned-domains owned.json --inventory inventory.json
python3 remedy_dns.py preview --domain example.test --owned-domains owned.json --inventory inventory.json --record record.json
python3 -m unittest -v
```

`extract` validates and normalizes the supplied JSON export; it does not discover
records. Names must be fully qualified ASCII hostnames. A, AAAA and CNAME are a
provisional subset, not confirmed provider capabilities. TTL is optional and its
provider limits remain unconfirmed. Other fields/types fail closed. Duplicate
records and CNAME conflicts in the inventory fail. New entries with an existing
name/type require operator review (including legitimate multi-address additions).

Output goes to stdout; errors go to stderr with exit code 2. No files are written
by the tool. Review output before saving it; it can contain internal DNS details.
Do not add secrets or customer data to fixtures or source control.

The preview fingerprint identifies normalized record content only. It is not a
Remedy idempotency key, request ID or proof of submission. Before manual request
creation, check inventory freshness and pending requests through the approved
process. Record the resulting Remedy ID/status separately. On a timeout, look up
that request before retrying; do not interpret request submission as provisioning.
Verify fulfillment using the authoritative inventory. This prototype cannot test
service errors, retries or fulfillment until a supported integration is established.

## Audit and decisions required

Local audit on 2026-10-16, base aps-devops `e854c51`: no Remedy client or Gold DNS
request workflow found across the six local repositories. aps-devops contains
SDX Bruno organization onboarding requests and Azure private-DNS infrastructure;
neither establishes the Remedy DNS process. No relevant Remedy connector was
returned by plugin discovery. No external access was attempted or verified.

Before an adapter or approved nonproduction trial:

- Confirm Remedy URL/service, supported API or export/import mechanism and authentication/secret source with an operator.
- Confirm authoritative inventory, ownership evidence, export schema and freshness requirements.
- Agree record types, TTL limits, customer/environment metadata, required request fields and approval workflow.
- Confirm how to query pending requests, identify duplicates and recover uncertain submissions.
- Agree test domain and authorized request, then capture request ID, fulfillment evidence and onboarding time saved.

Until then, use the existing operator workflow for submission. No live trial,
external permissions change, production deployment or measured time saving has
been completed as part of this prototype.
