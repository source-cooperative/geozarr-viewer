import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetInstalledForTesting,
  installConsoleAbortFilter,
  isAbortError,
} from "../zarr/tile-error";

// The install flag is module-scoped so production code can't double-wrap.
// Reset before each test so each test sees a fresh wrapper.
beforeEach(() => _resetInstalledForTesting());

describe("isAbortError", () => {
  it("recognizes DOMException AbortError", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(isAbortError(err)).toBe(true);
  });

  it("recognizes any error with name AbortError", () => {
    const err = Object.assign(new Error("x"), { name: "AbortError" });
    expect(isAbortError(err)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError("string")).toBe(false);
  });
});

describe("installConsoleAbortFilter", () => {
  it("swallows AbortError but forwards real errors", () => {
    const original = console.error;
    const calls: unknown[][] = [];
    console.error = (...args: unknown[]) => calls.push(args);
    try {
      installConsoleAbortFilter();
      // first call: AbortError → swallowed
      console.error(new DOMException("aborted", "AbortError"));
      expect(calls.length).toBe(0);
      // second call: real error → forwarded
      const real = new Error("boom");
      console.error(real);
      expect(calls).toEqual([[real]]);
    } finally {
      console.error = original;
    }
  });

  it("is idempotent (double-install doesn't double-wrap)", () => {
    const original = console.error;
    try {
      installConsoleAbortFilter();
      const afterFirst = console.error;
      installConsoleAbortFilter();
      expect(console.error).toBe(afterFirst);
    } finally {
      console.error = original;
    }
  });

  it("passes multi-arg calls through unchanged", () => {
    const original = console.error;
    const calls: unknown[][] = [];
    console.error = (...args: unknown[]) => calls.push(args);
    try {
      installConsoleAbortFilter();
      // Multi-arg call (e.g. console.error("label", err)) is forwarded even
      // if one of the args is an AbortError, so we don't lose context.
      const err = new DOMException("aborted", "AbortError");
      console.error("label", err);
      expect(calls).toEqual([["label", err]]);
      vi.fn();
    } finally {
      console.error = original;
    }
  });

  it("swallows the luma.gl 'Binding sampler not set' warning", () => {
    const original = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      installConsoleAbortFilter();
      console.warn(
        "luma.gl: Binding sampler not set: Not found in shader layout.",
      );
      expect(calls.length).toBe(0);
    } finally {
      console.warn = original;
    }
  });

  it("forwards unrelated warnings", () => {
    const original = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      installConsoleAbortFilter();
      console.warn("something else entirely");
      expect(calls).toEqual([["something else entirely"]]);
    } finally {
      console.warn = original;
    }
  });
});
