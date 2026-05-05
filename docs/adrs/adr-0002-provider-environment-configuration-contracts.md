# ADR-0002: Provider Environment Configuration Contracts

- Date: 2026-05-05
- Status: Accepted

## Context

The provider configuration feature needs a common contract for AI provider credentials, deployment settings, data policy metadata, and break-glass overrides. The same contract must support free, development, standard, and premium providers without committing secrets or coupling the package to a specific runtime host.

Downstream packages such as `@plasius/ai-providers` and `@plasius/ai-router` need deterministic configuration data for routing, policy exclusion, audit, and startup validation.

## Decision

`@plasius/ai-config` defines provider configuration definitions and resolved provider configuration values. Definitions contain environment variable names, defaults, provider capability metadata, tier metadata, and data policy metadata.

Consumers inject an environment-shaped record into `resolveAiProviderConfig`. The package does not read `process.env` directly.

Resolved secrets are wrapped in objects that expose:

- `present` for validation and diagnostics
- `reveal()` for explicit server-side runtime use
- `toJSON()` for redacted audit serialization

Break-glass overrides require an enabled flag, reason, and expiry timestamp when active. Missing, malformed, or expired break-glass values produce blocking diagnostics.

The package-level feature flag identifier is `ai.cost-aware-routing.enabled` because this configuration contract is the first delivery slice for provider configuration and cheapest-good-enough routing.

## Consequences

- Provider credentials remain environment/secret-store only.
- Audit logs can include resolved provider state without leaking secret values.
- Tests can resolve provider configurations without mutating global process state.
- Downstream packages can fail closed by calling `assertAiProviderEnabled` immediately before provider API calls.
- Future provider-specific authentication schemes may add additional secret binding names without changing the resolution model.
