import { describe, expect, it } from "vitest";

import {
  AI_CONFIG_ENV_PREFIX,
  AI_CONFIG_FEATURE_FLAG_ID,
  AI_CONFIG_PACKAGE,
  packageDescriptor,
} from "../src/index.js";

describe("@plasius/ai-config", () => {
  it("exports the package descriptor contract", () => {
    expect(packageDescriptor.packageName).toBe(AI_CONFIG_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(AI_CONFIG_FEATURE_FLAG_ID);
    expect(packageDescriptor.envPrefix).toBe(AI_CONFIG_ENV_PREFIX);
    expect(packageDescriptor.summary.length).toBeGreaterThan(0);
  });
});
