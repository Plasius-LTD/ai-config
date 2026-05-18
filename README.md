# @plasius/ai-config

Provider and environment configuration contracts for the Plasius agentic AI package family.

## Scope

This package is part of the layered `@plasius/ai-*` package family. It owns the server-side provider configuration boundary for:

- provider credentials expressed as environment variable bindings
- provider project, organization, deployment, region, endpoint, and data residency settings
- provider kind, tier, and capability metadata
- data policy metadata for routing and provider exclusion
- audited break-glass override settings

The package does not read `process.env` directly. Consumers inject an environment-shaped record at the server boundary, which keeps the package testable and prevents accidental client-side secret access.

## Install

```bash
npm install @plasius/ai-config
```

## Usage

```ts
import {
  assertAiProviderEnabled,
  defineAiProviderConfig,
  resolveAiProviderConfig,
  serializeAiProviderConfigForAudit,
} from "@plasius/ai-config";

const openAiDev = defineAiProviderConfig({
  providerId: "openai-dev",
  providerKind: "openai",
  displayName: "OpenAI development",
  tier: "development",
  capabilities: ["chat", "reasoning", "moderation"],
  secrets: {
    apiKey: "OPENAI_API_KEY",
  },
  settings: {
    enabled: "OPENAI_ENABLED",
    projectId: "OPENAI_PROJECT_ID",
    endpoint: "OPENAI_ENDPOINT",
    region: "OPENAI_REGION",
  },
  breakGlass: {
    enabled: "OPENAI_BREAK_GLASS_ENABLED",
    reason: "OPENAI_BREAK_GLASS_REASON",
    expiresAt: "OPENAI_BREAK_GLASS_EXPIRES_AT",
  },
  defaults: {
    enabled: false,
    region: "global",
  },
  dataPolicy: {
    allowedDataClasses: ["public", "internal"],
    dataResidency: "us",
    allowProviderTraining: false,
  },
});

const config = resolveAiProviderConfig(openAiDev, process.env);
const auditConfig = serializeAiProviderConfigForAudit(config);

console.info(auditConfig);

const enabledConfig = assertAiProviderEnabled(config);
const apiKey = enabledConfig.secrets.apiKey?.reveal();
```

`reveal()` is the only API that returns a resolved secret value. JSON serialization uses redacted secret metadata, so audit logs can contain provider state without containing API keys.

## Diagnostics

`resolveAiProviderConfig` returns diagnostics rather than throwing. This lets boot checks and operator tooling inspect every configured provider before deciding whether to block startup.

`assertAiProviderEnabled` throws when a provider is disabled or has blocking diagnostics. Use it immediately before making a provider API call.

## Break-Glass Overrides

Break-glass configuration is optional, but an enabled override must include both an audit reason and an expiry timestamp. Expired or malformed overrides produce blocking diagnostics.

```env
OPENAI_BREAK_GLASS_ENABLED=true
OPENAI_BREAK_GLASS_REASON=provider failover drill
OPENAI_BREAK_GLASS_EXPIRES_AT=2026-06-01T00:00:00.000Z
```

## Rollback

This package maps to feature flag `ai.cost-aware-routing.enabled`. To roll back consumers safely, disable the feature flag and set provider-level enabled environment variables to false.

## Development

```bash
npm install
npm run build
npm test
npm run test:coverage
npm run pack:check
```

## Governance

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
