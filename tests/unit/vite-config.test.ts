// @vitest-environment node

import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";

describe("vite config", () => {
  it("Phaser SVG 로더가 파일 URL을 받도록 에셋 인라인을 끈다", () => {
    expect(viteConfig.build?.assetsInlineLimit).toBe(0);
  });
});
