import assert from "node:assert/strict";
import test from "node:test";
import { InfraiImageClient } from "../src/infrai_image_client.ts";

test("upload sends the image as JSON", async () => {
  let request: Request | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    request = new Request(input, init);
    return Response.json({ ok: true, data: { id: "source_42" } });
  };
  const client = new InfraiImageClient("test-key", fetcher);

  const result = await client.upload(new Blob(["fixture"]), "cover.png", "release_7:upload");

  assert.deepEqual(result, { id: "source_42" });
  assert.ok(request);
  assert.equal(request.headers.get("content-type"), "application/json");
  assert.equal(request.headers.get("idempotency-key"), "release_7:upload");
  assert.deepEqual(await request.json(), {
    file: Buffer.from("fixture").toString("base64"),
    filename: "cover.png"
  });
});
