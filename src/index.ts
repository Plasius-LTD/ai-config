export interface AiPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const AI_CONFIG_PACKAGE = "@plasius/ai-config";
export const AI_CONFIG_FEATURE_FLAG_ID = "ai.config.enabled";
export const AI_CONFIG_ENV_PREFIX = "AI_CONFIG";

export const packageDescriptor: AiPackageDescriptor = Object.freeze({
  packageName: AI_CONFIG_PACKAGE,
  featureFlagId: AI_CONFIG_FEATURE_FLAG_ID,
  envPrefix: AI_CONFIG_ENV_PREFIX,
  summary: "Provider and environment configuration contracts for the Plasius agentic AI package family.",
});
