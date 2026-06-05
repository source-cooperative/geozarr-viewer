import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCodecSummary } from "../zarr/structure";

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound(): Response {
  return new Response(null, { status: 404 });
}

describe("fetchCodecSummary (v3 zarr.json)", () => {
  it("recognizes a sharded array and extracts sub-chunk shape + inner compressor", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        node_type: "array",
        shape: [789, 85, 51, 721, 1440],
        codecs: [
          {
            name: "sharding_indexed",
            configuration: {
              chunk_shape: [1, 85, 51, 32, 32],
              codecs: [
                { name: "bytes", configuration: { endian: "little" } },
                {
                  name: "blosc",
                  configuration: {
                    cname: "zstd",
                    clevel: 3,
                    shuffle: "shuffle",
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    const summary = await fetchCodecSummary(
      "https://example.com/data.zarr",
      "temperature_2m",
      new AbortController().signal,
    );
    expect(summary).not.toBeNull();
    expect(summary!.sharded).toBe(true);
    expect(summary!.subChunkShape).toEqual([1, 85, 51, 32, 32]);
    expect(summary!.compressor).toBe(
      "blosc(zstd, clevel=3, shuffle=shuffle)",
    );
  });

  it("recognizes an unsharded array and skips the structural `bytes` codec", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        node_type: "array",
        shape: [171, 381, 1081],
        codecs: [
          { name: "bytes", configuration: { endian: "little" } },
          {
            name: "blosc",
            configuration: { cname: "zstd", clevel: 5, shuffle: "shuffle" },
          },
        ],
      }),
    );

    const summary = await fetchCodecSummary(
      "https://example.com/data.zarr",
      "PM25_latest",
      new AbortController().signal,
    );
    expect(summary).not.toBeNull();
    expect(summary!.sharded).toBe(false);
    expect(summary!.subChunkShape).toBeNull();
    expect(summary!.compressor).toBe(
      "blosc(zstd, clevel=5, shuffle=shuffle)",
    );
  });

  it("reports `raw` when only the `bytes` codec is present", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        node_type: "array",
        codecs: [{ name: "bytes", configuration: { endian: "little" } }],
      }),
    );
    const summary = await fetchCodecSummary(
      "https://example.com/data.zarr",
      "x",
      new AbortController().signal,
    );
    expect(summary).not.toBeNull();
    expect(summary!.compressor).toBe("raw");
  });

  it("falls back to v2 `.zarray` when v3 zarr.json is missing", async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(
        jsonResponse({
          shape: [10, 10],
          chunks: [5, 5],
          dtype: "<f4",
          compressor: {
            id: "blosc",
            cname: "zstd",
            clevel: 3,
            shuffle: 1,
          },
        }),
      );
    const summary = await fetchCodecSummary(
      "https://example.com/data.zarr",
      "field",
      new AbortController().signal,
    );
    expect(summary).not.toBeNull();
    expect(summary!.sharded).toBe(false);
    expect(summary!.compressor).toContain("blosc");
    expect(summary!.compressor).toContain("zstd");
  });

  it("returns null when both v3 and v2 fetches fail", async () => {
    fetchMock.mockResolvedValueOnce(notFound()).mockResolvedValueOnce(notFound());
    const summary = await fetchCodecSummary(
      "https://example.com/data.zarr",
      "missing",
      new AbortController().signal,
    );
    expect(summary).toBeNull();
  });

  it("survives non-JSON / network errors gracefully", async () => {
    fetchMock.mockRejectedValueOnce(new Error("net error"));
    fetchMock.mockRejectedValueOnce(new Error("net error"));
    const summary = await fetchCodecSummary(
      "https://example.com/data.zarr",
      "x",
      new AbortController().signal,
    );
    expect(summary).toBeNull();
  });

  it("trims trailing slashes in the URL and leading slashes in the path", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ node_type: "array", codecs: [] }),
    );
    await fetchCodecSummary(
      "https://example.com/data.zarr/",
      "/embeddings",
      new AbortController().signal,
    );
    const calledUrl = fetchMock.mock.calls[0]?.[0];
    expect(calledUrl).toBe(
      "https://example.com/data.zarr/embeddings/zarr.json",
    );
  });
});
