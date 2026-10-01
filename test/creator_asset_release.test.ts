import assert from "node:assert/strict";
import test from "node:test";
import { releaseCreatorAsset } from "../src/creator_asset_release.ts";
import type { ImageGateway } from "../src/infrai_image_client.ts";

test("one compressed asset produces one ready update per distinct subscriber", async () => {
  const calls: string[] = [];
  const images: ImageGateway = {
    async upload(_file, filename, key) {
      calls.push(`upload:${filename}:${key}`);
      return { id: "source_42" };
    },
    async compress(imageId, key) {
      calls.push(`compress:${imageId}:${key}`);
      return { id: "delivery_42", url: "https://cdn.example/creator-42.webp" };
    }
  };

  const result = await releaseCreatorAsset({
    creatorId: "creator_42",
    releaseId: "release_7",
    filename: "cover.png",
    imageBase64: Buffer.from("fixture").toString("base64"),
    subscriberIds: ["subscriber_a", "subscriber_a", "subscriber_b"]
  }, images);

  assert.deepEqual(calls, [
    "upload:cover.png:release_7:upload",
    "compress:source_42:release_7:compress"
  ]);
  assert.deepEqual(result.updates, [
    {
      subscriberId: "subscriber_a",
      releaseId: "release_7",
      assetUrl: "https://cdn.example/creator-42.webp",
      state: "ready"
    },
    {
      subscriberId: "subscriber_b",
      releaseId: "release_7",
      assetUrl: "https://cdn.example/creator-42.webp",
      state: "ready"
    }
  ]);
});
