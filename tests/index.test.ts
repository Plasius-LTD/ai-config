import { describe, expect, it } from "vitest";

import {
  AI_CONFIG_ENV_PREFIX,
  AI_CONFIG_FEATURE_FLAG_ID,
  AI_CONFIG_PACKAGE,
  type AiProviderConfigDefinition,
  assertAiProviderEnabled,
  defineAiProviderConfig,
  packageDescriptor,
  resolveAiProviderConfig,
  resolveAiProviderConfigs,
  serializeAiProviderConfigForAudit,
} from "../src/index.js";

const baseDefinition: AiProviderConfigDefinition = {
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
    dataResidency: "OPENAI_DATA_RESIDENCY",
  },
  breakGlass: {
    enabled: "OPENAI_BREAK_GLASS_ENABLED",
    reason: "OPENAI_BREAK_GLASS_REASON",
    expiresAt: "OPENAI_BREAK_GLASS_EXPIRES_AT",
  },
  defaults: {
    enabled: false,
    endpoint: "https://api.openai.example/v1",
    region: "global",
    dataResidency: "us",
  },
  dataPolicy: {
    allowedDataClasses: ["public", "internal"],
    dataResidency: "us",
    allowProviderTraining: false,
  },
};

describe("@plasius/ai-config", () => {
  it("exports the package descriptor contract", () => {
    expect(packageDescriptor.packageName).toBe(AI_CONFIG_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(AI_CONFIG_FEATURE_FLAG_ID);
    expect(packageDescriptor.featureFlagId).toBe(
      "ai.cost-aware-routing.enabled"
    );
    expect(packageDescriptor.envPrefix).toBe(AI_CONFIG_ENV_PREFIX);
    expect(packageDescriptor.summary.length).toBeGreaterThan(0);
  });

  it("resolves an enabled provider from an injected environment", () => {
    const definition = defineAiProviderConfig(baseDefinition);
    const config = resolveAiProviderConfig(definition, {
      OPENAI_ENABLED: "yes",
      OPENAI_API_KEY: "test-only-token",
      OPENAI_PROJECT_ID: "project-local",
      OPENAI_ENDPOINT: "https://gateway.example.test/openai",
      OPENAI_REGION: "uksouth",
    });

    expect(config.enabled).toBe(true);
    expect(config.settings).toEqual({
      projectId: "project-local",
      organizationId: undefined,
      endpoint: "https://gateway.example.test/openai",
      baseUrl: undefined,
      region: "uksouth",
      deploymentId: undefined,
      dataResidency: "us",
    });
    expect(config.secrets.apiKey?.present).toBe(true);
    expect(config.secrets.apiKey?.reveal()).toBe("test-only-token");
    expect(config.diagnostics).toEqual([]);
    expect(assertAiProviderEnabled(config)).toBe(config);
  });

  it("falls back to disabled defaults without requiring the API key", () => {
    const config = resolveAiProviderConfig(baseDefinition, {});

    expect(config.enabled).toBe(false);
    expect(config.secrets.apiKey?.present).toBe(false);
    expect(config.settings.endpoint).toBe("https://api.openai.example/v1");
    expect(config.settings.region).toBe("global");
    expect(config.diagnostics).toEqual([]);
    expect(() => assertAiProviderEnabled(config)).toThrow(
      'Provider "openai-dev" is disabled.'
    );
  });

  it("reports a missing required secret for an enabled provider", () => {
    const config = resolveAiProviderConfig(baseDefinition, {
      OPENAI_ENABLED: "true",
    });

    expect(config.enabled).toBe(true);
    expect(config.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-required-secret",
        envVar: "OPENAI_API_KEY",
        severity: "error",
      })
    );
    expect(() => assertAiProviderEnabled(config)).toThrow(
      'Provider "openai-dev" is enabled but "OPENAI_API_KEY" is not set.'
    );
  });

  it("records invalid boolean values as diagnostics and falls back", () => {
    const config = resolveAiProviderConfig(baseDefinition, {
      OPENAI_ENABLED: "sometimes",
      OPENAI_API_KEY: "test-only-token",
    });

    expect(config.enabled).toBe(false);
    expect(config.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid-boolean",
        envVar: "OPENAI_ENABLED",
        severity: "error",
      })
    );
  });

  it("redacts provider secrets during audit serialization", () => {
    const config = resolveAiProviderConfig(baseDefinition, {
      OPENAI_ENABLED: "true",
      OPENAI_API_KEY: "test-only-token",
    });
    const auditConfig = serializeAiProviderConfigForAudit(config);

    expect(auditConfig.secrets.apiKey).toEqual({
      envVar: "OPENAI_API_KEY",
      present: true,
      redacted: true,
    });
    expect(JSON.stringify(config)).not.toContain("test-only-token");
    expect(JSON.stringify(auditConfig)).not.toContain("test-only-token");
  });

  it("resolves audited break-glass overrides with a future expiry", () => {
    const config = resolveAiProviderConfig(baseDefinition, {
      OPENAI_ENABLED: "true",
      OPENAI_API_KEY: "test-only-token",
      OPENAI_BREAK_GLASS_ENABLED: "1",
      OPENAI_BREAK_GLASS_REASON: "provider failover drill",
      OPENAI_BREAK_GLASS_EXPIRES_AT: "2999-01-01T00:00:00.000Z",
    });

    expect(config.breakGlass).toEqual({
      enabled: true,
      reason: "provider failover drill",
      expiresAt: "2999-01-01T00:00:00.000Z",
      expired: false,
    });
    expect(config.diagnostics).toEqual([]);
  });

  it("blocks expired or unauditable break-glass overrides", () => {
    const expiredConfig = resolveAiProviderConfig(baseDefinition, {
      OPENAI_ENABLED: "true",
      OPENAI_API_KEY: "test-only-token",
      OPENAI_BREAK_GLASS_ENABLED: "enabled",
      OPENAI_BREAK_GLASS_REASON: "expired drill",
      OPENAI_BREAK_GLASS_EXPIRES_AT: "2000-01-01T00:00:00.000Z",
    });
    const unauditedConfig = resolveAiProviderConfig(baseDefinition, {
      OPENAI_ENABLED: "true",
      OPENAI_API_KEY: "test-only-token",
      OPENAI_BREAK_GLASS_ENABLED: "enabled",
    });

    expect(expiredConfig.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "break-glass-expired",
        envVar: "OPENAI_BREAK_GLASS_EXPIRES_AT",
        severity: "error",
      })
    );
    expect(() => assertAiProviderEnabled(expiredConfig)).toThrow(
      "Break-glass override is enabled but its expiry timestamp has passed."
    );
    expect(unauditedConfig.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-break-glass-reason" }),
        expect.objectContaining({ code: "missing-break-glass-expiry" }),
      ])
    );
  });

  it("reports invalid break-glass expiry values", () => {
    const config = resolveAiProviderConfig(baseDefinition, {
      OPENAI_BREAK_GLASS_ENABLED: "true",
      OPENAI_BREAK_GLASS_REASON: "bad expiry drill",
      OPENAI_BREAK_GLASS_EXPIRES_AT: "tomorrow",
    });

    expect(config.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-break-glass-expiry",
          envVar: "OPENAI_BREAK_GLASS_EXPIRES_AT",
        }),
      ])
    );
  });

  it("rejects invalid provider definitions before consumers use them", () => {
    expect(() =>
      defineAiProviderConfig({
        ...baseDefinition,
        providerId: "OpenAI",
      })
    ).toThrow("Provider id must be lowercase kebab-case");

    expect(() =>
      defineAiProviderConfig({
        ...baseDefinition,
        secrets: {
          apiKey: "openai_api_key",
        },
      })
    ).toThrow(
      'Environment variable "openai_api_key" must use uppercase letters'
    );
  });

  it("resolves multiple provider configs for catalog-style consumers", () => {
    const configs = resolveAiProviderConfigs(
      [
        baseDefinition,
        {
          ...baseDefinition,
          providerId: "anthropic-dev",
          providerKind: "anthropic",
          secrets: {
            apiKey: "ANTHROPIC_API_KEY",
          },
          settings: {
            enabled: "ANTHROPIC_ENABLED",
          },
        },
      ],
      {
        OPENAI_ENABLED: "false",
        ANTHROPIC_ENABLED: "true",
        ANTHROPIC_API_KEY: "test-only-token",
      }
    );

    expect(configs.map((config) => [config.providerId, config.enabled])).toEqual(
      [
        ["openai-dev", false],
        ["anthropic-dev", true],
      ]
    );
  });
});
