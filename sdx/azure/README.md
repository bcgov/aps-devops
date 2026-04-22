# Edge Server in Azure

![alt text](./sdx_edge_architecture.png)

## Deployment

### Terraform

See PROMPT.md

### Prepare bootstrap token

Bootstrap will initially fail, but retrieve the public ip from `kong_lb_ip`.

```sh
terraform apply -target azurerm_public_ip.kong_lb

export IP="20.63.46.159"
export EDGE_ID="azure01"
export DOMAIN="${EDGE_ID}.servers.sdx"

step ca token $DOMAIN \
  --san $DOMAIN \
  --san $IP > token
```

### AKS Admin

```sh
az aks get-credentials --resource-group sdx-edge-rg --name sdx-edge-aks

kubectl create serviceaccount admin --namespace default

kubectl create clusterrolebinding admin \
  --clusterrole=cluster-admin \
  --serviceaccount=default:admin

kubectl -n default create token admin

```

### AKS Dashboard

```sh
helm repo add kubernetes-dashboard https://github.io

helm upgrade --install kubernetes-dashboard kubernetes-dashboard/kubernetes-dashboard --create-namespace --namespace kubernetes-dashboard

kubectl -n kubernetes-dashboard port-forward svc/kubernetes-dashboard-kong-proxy 8443:443

```

> Check logs

### Verify Edge Server

Successful terraform completion produces output like:

```sh
aks_cluster_name = "sdx-edge-aks"
aks_get_credentials = "az aks get-credentials --resource-group sdx-edge-rg --name sdx-edge-aks"
edge_domain = "azure01.servers.sdx"
helm_release_status = "deployed"
kong_lb_ip = "20.63.46.159"
resource_group_name = "sdx-edge-rg"
```

Run the following to check connectivity to the SDX Edge Server:

```sh
curl -v -k --resolve ${DOMAIN}:443:${IP} \
  https://${DOMAIN}
```

## Diagrams

```text
can you create an architecture diagram as a PNG based on the terraform resources that were created using Azure icons, VNet + subnet layout and ingress flow down to pod-level detail
```
