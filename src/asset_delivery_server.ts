import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError, InfraiImageClient } from "./infrai_image_client.ts";
import { releaseCreatorAsset, releaseRequestSchema } from "./creator_asset_release.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const images = new InfraiImageClient(apiKey);
const port = Number(process.env.PORT ?? "3000");

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/creator-assets/release") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = releaseRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const release = await releaseCreatorAsset(input, images);
    send(response, 201, release);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    send(response, 502, { error: "Asset processing did not complete" });
  }
}).listen(port, () => {
  console.log(`Creator asset service listening on http://localhost:${port}`);
});

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
