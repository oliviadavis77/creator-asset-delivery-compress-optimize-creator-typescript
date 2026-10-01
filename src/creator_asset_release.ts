import { z } from "zod";
import type { ImageGateway } from "./infrai_image_client.ts";

export const releaseRequestSchema = z.object({
  creatorId: z.string().min(1),
  releaseId: z.string().min(1),
  filename: z.string().regex(/\.(avif|jpe?g|png|webp)$/i),
  imageBase64: z.string().min(1),
  subscriberIds: z.array(z.string().min(1)).max(500)
});

export type ReleaseRequest = z.infer<typeof releaseRequestSchema>;
export type SubscriberUpdate = {
  subscriberId: string;
  releaseId: string;
  assetUrl: string;
  state: "ready";
};

export type AssetRelease = {
  creatorId: string;
  releaseId: string;
  sourceAssetId: string;
  deliveryAssetId: string;
  assetUrl: string;
  updates: SubscriberUpdate[];
};

export async function releaseCreatorAsset(
  input: ReleaseRequest,
  images: ImageGateway
): Promise<AssetRelease> {
  const bytes = Buffer.from(input.imageBase64, "base64");
  const source = await images.upload(
    new Blob([Uint8Array.from(bytes)]),
    input.filename,
    `${input.releaseId}:upload`
  );
  const delivery = await images.compress(source.id, `${input.releaseId}:compress`);
  const uniqueSubscribers = Array.from(new Set(input.subscriberIds));
  const updates = uniqueSubscribers.map((subscriberId): SubscriberUpdate => ({
    subscriberId,
    releaseId: input.releaseId,
    assetUrl: delivery.url,
    state: "ready"
  }));

  return {
    creatorId: input.creatorId,
    releaseId: input.releaseId,
    sourceAssetId: source.id,
    deliveryAssetId: delivery.id,
    assetUrl: delivery.url,
    updates
  };
}
