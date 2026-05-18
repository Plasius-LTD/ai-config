export interface AiPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const AI_CONFIG_PACKAGE = "@plasius/ai-config";
export const AI_CONFIG_FEATURE_FLAG_ID = "ai.cost-aware-routing.enabled";
export const AI_CONFIG_ENV_PREFIX = "AI_CONFIG";

export const packageDescriptor: AiPackageDescriptor = Object.freeze({
  packageName: AI_CONFIG_PACKAGE,
  featureFlagId: AI_CONFIG_FEATURE_FLAG_ID,
  envPrefix: AI_CONFIG_ENV_PREFIX,
  summary:
    "Provider and environment configuration contracts for the Plasius agentic AI package family.",
});

export type AiProviderKind =
  | "openai"
  | "azure-openai"
  | "gemini"
  | "anthropic"
  | "xai"
  | "aws-bedrock"
  | "custom";

export type AiProviderCapability =
  | "chat"
  | "reasoning"
  | "embedding"
  | "rerank"
  | "moderation"
  | "stt"
  | "tts"
  | "image"
  | "video"
  | "mcp"
  | "rag";

export type AiProviderTier = "free" | "development" | "standard" | "premium";

export type AiDataClass = "public" | "internal" | "personal" | "sensitive";

export type AiDeploymentEnvironment =
  | "development"
  | "test"
  | "staging"
  | "production";

export type AiEnvironment = Readonly<Record<string, string | undefined>>;

export interface AiProviderSecretBinding {
  readonly apiKey?: string;
}

export interface AiProviderSettingBindings {
  readonly enabled?: string;
  readonly projectId?: string;
  readonly organizationId?: string;
  readonly endpoint?: string;
  readonly baseUrl?: string;
  readonly region?: string;
  readonly deploymentId?: string;
  readonly dataResidency?: string;
}

export interface AiProviderBreakGlassBindings {
  readonly enabled?: string;
  readonly reason?: string;
  readonly expiresAt?: string;
}

export interface AiProviderDataPolicy {
  readonly allowedDataClasses: readonly AiDataClass[];
  readonly dataResidency?: string;
  readonly allowProviderTraining?: boolean;
}

export interface AiProviderDefaults {
  readonly enabled?: boolean;
  readonly projectId?: string;
  readonly organizationId?: string;
  readonly endpoint?: string;
  readonly baseUrl?: string;
  readonly region?: string;
  readonly deploymentId?: string;
  readonly dataResidency?: string;
}

export interface AiProviderConfigDefinition {
  readonly providerId: string;
  readonly providerKind: AiProviderKind;
  readonly displayName?: string;
  readonly tier: AiProviderTier;
  readonly capabilities: readonly AiProviderCapability[];
  readonly secrets?: AiProviderSecretBinding;
  readonly settings?: AiProviderSettingBindings;
  readonly breakGlass?: AiProviderBreakGlassBindings;
  readonly defaults?: AiProviderDefaults;
  readonly dataPolicy: AiProviderDataPolicy;
}

export interface AiResolvedSecret {
  readonly envVar: string;
  readonly present: boolean;
  reveal(): string | undefined;
  toJSON(): AiRedactedSecret;
}

export interface AiRedactedSecret {
  readonly envVar: string;
  readonly present: boolean;
  readonly redacted: true;
}

export interface AiResolvedBreakGlass {
  readonly enabled: boolean;
  readonly reason?: string;
  readonly expiresAt?: string;
  readonly expired: boolean;
}

export interface AiResolvedProviderConfig {
  readonly providerId: string;
  readonly providerKind: AiProviderKind;
  readonly displayName?: string;
  readonly tier: AiProviderTier;
  readonly enabled: boolean;
  readonly capabilities: readonly AiProviderCapability[];
  readonly secrets: {
    readonly apiKey?: AiResolvedSecret;
  };
  readonly settings: {
    readonly projectId?: string;
    readonly organizationId?: string;
    readonly endpoint?: string;
    readonly baseUrl?: string;
    readonly region?: string;
    readonly deploymentId?: string;
    readonly dataResidency?: string;
  };
  readonly dataPolicy: AiProviderDataPolicy;
  readonly breakGlass: AiResolvedBreakGlass;
  readonly diagnostics: readonly AiProviderConfigDiagnostic[];
}

export interface AiProviderConfigDiagnostic {
  readonly severity: "warning" | "error";
  readonly code:
    | "invalid-provider-id"
    | "invalid-env-var"
    | "missing-required-secret"
    | "invalid-boolean"
    | "invalid-break-glass-expiry"
    | "break-glass-expired"
    | "missing-break-glass-reason"
    | "missing-break-glass-expiry";
  readonly message: string;
  readonly envVar?: string;
}

export interface AiProviderAuditConfig {
  readonly providerId: string;
  readonly providerKind: AiProviderKind;
  readonly displayName?: string;
  readonly tier: AiProviderTier;
  readonly enabled: boolean;
  readonly capabilities: readonly AiProviderCapability[];
  readonly secrets: {
    readonly apiKey?: AiRedactedSecret;
  };
  readonly settings: AiResolvedProviderConfig["settings"];
  readonly dataPolicy: AiProviderDataPolicy;
  readonly breakGlass: AiResolvedBreakGlass;
  readonly diagnostics: readonly AiProviderConfigDiagnostic[];
}

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/u;
const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

function createDiagnostic(
  code: AiProviderConfigDiagnostic["code"],
  message: string,
  options: {
    readonly severity?: AiProviderConfigDiagnostic["severity"];
    readonly envVar?: string;
  } = {}
): AiProviderConfigDiagnostic {
  return {
    severity: options.severity ?? "error",
    code,
    message,
    ...(options.envVar ? { envVar: options.envVar } : {}),
  };
}

function trimValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readEnv(env: AiEnvironment, envVar: string | undefined): string | undefined {
  return envVar ? trimValue(env[envVar]) : undefined;
}

function readSetting(
  env: AiEnvironment,
  envVar: string | undefined,
  fallback: string | undefined
): string | undefined {
  return readEnv(env, envVar) ?? trimValue(fallback);
}

function parseBooleanValue(
  value: string | undefined,
  fallback: boolean | undefined
): { value: boolean; invalid: boolean } {
  if (value === undefined) {
    return { value: fallback ?? false, invalid: false };
  }

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return { value: true, invalid: false };
  }
  if (FALSE_VALUES.has(normalized)) {
    return { value: false, invalid: false };
  }

  return { value: fallback ?? false, invalid: true };
}

function resolveSecret(env: AiEnvironment, envVar: string | undefined): AiResolvedSecret | undefined {
  if (!envVar) {
    return undefined;
  }

  const value = readEnv(env, envVar);
  return Object.freeze({
    envVar,
    present: value !== undefined,
    reveal: () => value,
    toJSON: () => ({
      envVar,
      present: value !== undefined,
      redacted: true as const,
    }),
  });
}

function validateEnvVar(
  envVar: string | undefined,
  diagnostics: AiProviderConfigDiagnostic[]
): void {
  if (!envVar || ENV_VAR_PATTERN.test(envVar)) {
    return;
  }

  diagnostics.push(
    createDiagnostic(
      "invalid-env-var",
      `Environment variable "${envVar}" must use uppercase letters, numbers, and underscores.`,
      { envVar }
    )
  );
}

function validateDefinition(
  definition: AiProviderConfigDefinition,
  diagnostics: AiProviderConfigDiagnostic[]
): void {
  if (!PROVIDER_ID_PATTERN.test(definition.providerId)) {
    diagnostics.push(
      createDiagnostic(
        "invalid-provider-id",
        "Provider id must be lowercase kebab-case and between 2 and 63 characters."
      )
    );
  }

  validateEnvVar(definition.secrets?.apiKey, diagnostics);
  validateEnvVar(definition.settings?.enabled, diagnostics);
  validateEnvVar(definition.settings?.projectId, diagnostics);
  validateEnvVar(definition.settings?.organizationId, diagnostics);
  validateEnvVar(definition.settings?.endpoint, diagnostics);
  validateEnvVar(definition.settings?.baseUrl, diagnostics);
  validateEnvVar(definition.settings?.region, diagnostics);
  validateEnvVar(definition.settings?.deploymentId, diagnostics);
  validateEnvVar(definition.settings?.dataResidency, diagnostics);
  validateEnvVar(definition.breakGlass?.enabled, diagnostics);
  validateEnvVar(definition.breakGlass?.reason, diagnostics);
  validateEnvVar(definition.breakGlass?.expiresAt, diagnostics);
}

function resolveBreakGlass(
  definition: AiProviderConfigDefinition,
  env: AiEnvironment,
  diagnostics: AiProviderConfigDiagnostic[]
): AiResolvedBreakGlass {
  const enabledEnv = definition.breakGlass?.enabled;
  const enabledRaw = readEnv(env, enabledEnv);
  const parsed = parseBooleanValue(enabledRaw, false);

  if (enabledEnv && parsed.invalid) {
    diagnostics.push(
      createDiagnostic(
        "invalid-boolean",
        `Break-glass environment variable "${enabledEnv}" must be a boolean-like value.`,
        { envVar: enabledEnv }
      )
    );
  }

  const expiresAt = readEnv(env, definition.breakGlass?.expiresAt);
  const reason = readEnv(env, definition.breakGlass?.reason);
  const timestamp = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const invalidExpiry = expiresAt !== undefined && !Number.isFinite(timestamp);
  const expired = Number.isFinite(timestamp) && timestamp <= Date.now();

  if (invalidExpiry) {
    diagnostics.push(
      createDiagnostic(
        "invalid-break-glass-expiry",
        "Break-glass expiry must be an ISO-8601 timestamp.",
        { envVar: definition.breakGlass?.expiresAt }
      )
    );
  }

  if (parsed.value && expired) {
    diagnostics.push(
      createDiagnostic(
        "break-glass-expired",
        "Break-glass override is enabled but its expiry timestamp has passed.",
        { envVar: definition.breakGlass?.expiresAt }
      )
    );
  }

  if (parsed.value && !reason) {
    diagnostics.push(
      createDiagnostic(
        "missing-break-glass-reason",
        "Break-glass override is enabled but no audit reason was provided.",
        { envVar: definition.breakGlass?.reason }
      )
    );
  }

  if (parsed.value && !expiresAt) {
    diagnostics.push(
      createDiagnostic(
        "missing-break-glass-expiry",
        "Break-glass override is enabled but no expiry timestamp was provided.",
        { envVar: definition.breakGlass?.expiresAt }
      )
    );
  }

  return Object.freeze({
    enabled: parsed.value,
    reason,
    expiresAt,
    expired,
  });
}

export function defineAiProviderConfig(
  definition: AiProviderConfigDefinition
): AiProviderConfigDefinition {
  const diagnostics: AiProviderConfigDiagnostic[] = [];
  validateDefinition(definition, diagnostics);

  const blockingDiagnostic = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error"
  );
  if (blockingDiagnostic) {
    throw new Error(blockingDiagnostic.message);
  }

  return Object.freeze({
    ...definition,
    capabilities: Object.freeze([...definition.capabilities]),
    dataPolicy: Object.freeze({
      ...definition.dataPolicy,
      allowedDataClasses: Object.freeze([
        ...definition.dataPolicy.allowedDataClasses,
      ]),
    }),
  });
}

export function resolveAiProviderConfig(
  definition: AiProviderConfigDefinition,
  env: AiEnvironment
): AiResolvedProviderConfig {
  const diagnostics: AiProviderConfigDiagnostic[] = [];
  validateDefinition(definition, diagnostics);

  const enabledEnv = definition.settings?.enabled;
  const enabledRaw = readEnv(env, enabledEnv);
  const enabled = parseBooleanValue(enabledRaw, definition.defaults?.enabled);

  if (enabledEnv && enabled.invalid) {
    diagnostics.push(
      createDiagnostic(
        "invalid-boolean",
        `Provider enabled environment variable "${enabledEnv}" must be a boolean-like value.`,
        { envVar: enabledEnv }
      )
    );
  }

  const apiKey = resolveSecret(env, definition.secrets?.apiKey);
  if (enabled.value && apiKey && !apiKey.present) {
    diagnostics.push(
      createDiagnostic(
        "missing-required-secret",
        `Provider "${definition.providerId}" is enabled but "${apiKey.envVar}" is not set.`,
        { envVar: apiKey.envVar }
      )
    );
  }

  return Object.freeze({
    providerId: definition.providerId,
    providerKind: definition.providerKind,
    displayName: definition.displayName,
    tier: definition.tier,
    enabled: enabled.value,
    capabilities: Object.freeze([...definition.capabilities]),
    secrets: Object.freeze({
      apiKey,
    }),
    settings: Object.freeze({
      projectId: readSetting(
        env,
        definition.settings?.projectId,
        definition.defaults?.projectId
      ),
      organizationId: readSetting(
        env,
        definition.settings?.organizationId,
        definition.defaults?.organizationId
      ),
      endpoint: readSetting(
        env,
        definition.settings?.endpoint,
        definition.defaults?.endpoint
      ),
      baseUrl: readSetting(
        env,
        definition.settings?.baseUrl,
        definition.defaults?.baseUrl
      ),
      region: readSetting(
        env,
        definition.settings?.region,
        definition.defaults?.region
      ),
      deploymentId: readSetting(
        env,
        definition.settings?.deploymentId,
        definition.defaults?.deploymentId
      ),
      dataResidency: readSetting(
        env,
        definition.settings?.dataResidency,
        definition.defaults?.dataResidency
      ),
    }),
    dataPolicy: Object.freeze({
      ...definition.dataPolicy,
      allowedDataClasses: Object.freeze([
        ...definition.dataPolicy.allowedDataClasses,
      ]),
    }),
    breakGlass: resolveBreakGlass(definition, env, diagnostics),
    diagnostics: Object.freeze(diagnostics),
  });
}

export function resolveAiProviderConfigs(
  definitions: readonly AiProviderConfigDefinition[],
  env: AiEnvironment
): readonly AiResolvedProviderConfig[] {
  return Object.freeze(
    definitions.map((definition) => resolveAiProviderConfig(definition, env))
  );
}

export function serializeAiProviderConfigForAudit(
  config: AiResolvedProviderConfig
): AiProviderAuditConfig {
  return Object.freeze({
    providerId: config.providerId,
    providerKind: config.providerKind,
    displayName: config.displayName,
    tier: config.tier,
    enabled: config.enabled,
    capabilities: Object.freeze([...config.capabilities]),
    secrets: Object.freeze({
      apiKey: config.secrets.apiKey?.toJSON(),
    }),
    settings: config.settings,
    dataPolicy: config.dataPolicy,
    breakGlass: config.breakGlass,
    diagnostics: config.diagnostics,
  });
}

export function assertAiProviderEnabled(
  config: AiResolvedProviderConfig
): AiResolvedProviderConfig {
  if (!config.enabled) {
    throw new Error(`Provider "${config.providerId}" is disabled.`);
  }

  const blockingDiagnostic = config.diagnostics.find(
    (diagnostic) => diagnostic.severity === "error"
  );
  if (blockingDiagnostic) {
    throw new Error(blockingDiagnostic.message);
  }

  return config;
}
