# Component inventory maintenance

Reviewed 22 October 2026. This is a source inventory, not a deployment attestation.
The user has requested that the shared component list remain current. Reconcile
confirmed changes here and in `assets/master-components.json` as proposal research
reveals them; preserve IDs, distinguish logical APIs from separately deployed
services, and record uncertainty rather than guessing. A proposed component may
be registered with `status: planned`; remove that status only after implementation
is verified. Include new nodes in reusable views only when relevant.

## Evidence for this revision

- `feeder`: `bcgov/api-services-portal`, `feeds/README.md`, `feeds/index.js` and
  `feeds/kong/` establish gateway/platform synchronization as a separate component.
- `edge_image`: `bcgov/aps-devops`, `sdx/image/Dockerfile`, and
  `bcgov-c/api-serv-infra`, `terraform/modules/sdx/kong-cp.tf`, show the SDX
  access-point image serves the CP as well as edges. Preserve the existing ID.
- `deployment`: the same Terraform module plus `terraform/workspaces/gold/`
  and `terraform/workspaces/sdx/` define the relevant module and tier boundaries;
  the previous APSTST-only template label was too narrow.
- `cp_chart`: [APS-5052](https://dpdd.atlassian.net/browse/APS-5052) proposes
  `sdx/chart/sdx-kong-cp`. It is planned, absent from the inspected checkout,
  and must not be described as implemented or deployed. The proposal binds it
  to the same image build as the edge chart while allowing independent promotion.

Local checkout evidence may lag remote implementation. This review refreshes the
entries above; it does not certify every existing entry or external owner.
