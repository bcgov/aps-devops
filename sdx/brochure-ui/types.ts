export interface SubsystemAccess {
  member: { email?: string; name?: string };
  roles: string[];
}

export interface Subsystem {
  name: string;
  clientId: string;
  organization: { name: string; title: string; description?: string };
  member: { memberClass: string; memberId: string };
  description?: string;
  access?: SubsystemAccess[];
}

export interface Organization {
  name: string;
  title: string;
  description?: string;
  member: { memberClass: string; memberId: string };
  publicBodyId?: string;
}

export interface Scope {
  name: string;
  description?: string;
}

export interface ServiceOperation {
  operationId?: string;
  method: string;
  path: string;
  summary?: string;
  scopes: Scope[];
  tags?: string[];
}

export interface Service {
  name: string;
  title: string;
  /** SDX environment the service is published in (e.g. "dev", "test", "prod", "lab", "sbx"). */
  environment?: string;
  version: string;
  specVersion?: string | null;
  summary?: string;
  description?: string;
  subsystem: {
    name: string;
    description?: string;
    clientId: string;
    organization: { name: string };
    member: { memberClass: string; memberId: string };
  };
  operations: ServiceOperation[];
}

export interface ScopeService {
  name: string;
  /** Explicit SDX environment the service is published in (e.g. "dev", "test", "prod", "lab", "sbx"). */
  environment?: string;
  specVersion?: string | null;
  version?: string;
  subsystem?: {
    name: string;
    description?: string;
    clientId: string;
    organization?: { name: string };
    member?: { memberClass: string; memberId: string };
    gateway?: { id: string };
  };
  operationIds: string[];
}

/** A resource scope: granting it gives access to the listed service operations. */
export interface ResourceScope {
  name: string;
  description?: string;
  namespace?: string;
  resourceType?: string;
  action?: string;
  services: ScopeService[];
}

export interface EnvironmentConfig {
  /** Short environment id used in data-env attributes and keyset suffixes (e.g. "dev"). */
  id: string;
  /** Human-readable label shown in the environment filter (e.g. "Dev"). */
  label: string;
  /**
   * Base URL of the keyset registry for this environment, e.g.
   * `https://…/keysets`. The org and subsystem JWKS used to verify entity
   * signatures are fetched from `<org_keysets_url>/<keysetId>/.well-known/jwks.json`.
   */
  org_keysets_url?: string;
  /** JWKS source URLs published for this environment on the trust registry. */
  jwks_urls?: string[];
}

export interface SiteConfig {
  site: { title: string; description: string; subtitle: string };
  support_url: string;
  /** Ordered list of SDX environments to surface in the UI. */
  environments?: EnvironmentConfig[];
  /** Environment selected by default — used when the visitor has made no
   * explicit choice (e.g. an anonymous, not-logged-in user). */
  defaultEnvironment?: string;
}

export interface CertInfo {
  subject: string;
  subjectCN?: string;
  issuer: string;
  issuerCN?: string;
  serial: string;
  notBefore: string;
  notAfter: string;
  validityState: "valid" | "expired" | "not_yet_valid";
  fingerprintSha256: string;
  publicKeyType: string;
  publicKeyCurve?: string;
  publicKeySize?: number;
  sans: string[];
  isCA: boolean;
  isSelfSigned: boolean;
}

export interface JwkRecord {
  kid?: string;
  kty: string;
  crv?: string;
  use?: string;
  alg?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  x5c?: string[];
  pem?: string;
  pemError?: string;
  certs?: CertInfo[];
  certError?: string;
}

export interface JwksData {
  url: string;
  /** Environment this source is published under, when known (from config). */
  environment?: string;
  fetchedAt: string;
  keys: JwkRecord[];
  error?: string;
}

export interface PageProps {
  config: SiteConfig;
  currentPath: string;
}

export interface ActivityRecord {
  result: string;
  message: string;
  params: Record<string, string>;
  activityAt: string;
  blob?: unknown;
}

export interface ConnectionTokenUpgrade {
  allowed_aud: string;
  allowed_iss: string;
  scope?: string;
  consumer_match?: boolean;
  consumer_match_claim?: string;
  consumer_match_claim_custom_id?: boolean;
  consumer_match_ignore_not_found?: boolean;
}

export interface ConnectionTokenExchange {
  client_id: string;
  token_endpoint: string;
  audience: string;
  scopes: string[];
}

export interface ConnectionGatewayUpgrades {
  sign?: Record<string, unknown>;
  verify?: Record<string, unknown>;
  counter_sign?: Record<string, unknown>;
  token?: ConnectionTokenUpgrade;
  token_exchange?: ConnectionTokenExchange;
}

export interface ConnectionGatewayPattern {
  strip_path?: boolean;
  client_id?: string;
  service_id?: string;
  upgrades?: ConnectionGatewayUpgrades;
}

export interface ConnectionRequesterDetails {
  client: {
    integrationId: string;
    clientId: string;
    privacyZone: string;
  };
  requester: string;
  scopes: string[];
  service: {
    clientId: string;
    privacyZone: string;
  };
  submissionId: string;
}

export interface ConnectionClientResources {
  gatewayPatterns?: Record<string, ConnectionGatewayPattern>;
}

export interface ConnectionServiceResources {
  subsystemId: string;
  gatewayPatterns?: Record<string, ConnectionGatewayPattern>;
}

export interface ConnectionRequest {
  id?: string;
  slug?: string;
  clientId: string;
  serviceId: string;
  isApproved?: boolean;
  isActive?: boolean;
  scopes?: string[];
  policyVersion?: string;
  environment?: string;
  requesterDetails?: ConnectionRequesterDetails;
  clientResources?: ConnectionClientResources;
  serviceResources?: ConnectionServiceResources;
}

export interface ConnectionRequestInput {
  clientId: string;
  serviceId: string;
  isApproved?: boolean;
  isActive?: boolean;
  scopes?: string[];
  policyVersion?: string;
  /** Gateway pattern config for the client side (write model — camelCase keys,
   * assembled by the Edit dialog). Passed through to the upsert endpoint. */
  clientResources?: Record<string, unknown>;
  /** Gateway pattern config for the service side (write model). */
  serviceResources?: Record<string, unknown>;
}
