// @vitest-environment node

import { describe, expect, it } from "vitest";
import viteConfig, { githubPagesBase } from "../../vite.config";

describe("vite config", () => {
  it("로컬 기본 base 경로를 루트로 유지한다", () => {
    expect(viteConfig.base).toBe("/");
  });

  it("GitHub Pages 프로젝트 경로를 고정한다", () => {
    expect(githubPagesBase).toBe("/GoblinClicker/");
  });

  it("Phaser SVG 로더가 파일 URL을 받도록 에셋 인라인을 끈다", () => {
    expect(viteConfig.build?.assetsInlineLimit).toBe(0);
  });
});
