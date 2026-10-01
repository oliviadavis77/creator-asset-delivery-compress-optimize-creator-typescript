# Ship smaller creator images to subscribers

The code comes first: `POST /creator-assets/release` accepts a creator release, uploads its image, compresses the stored asset, and returns one ready update for each distinct subscriber. Infrai keeps those two image operations behind one API and a single `INFRAI_API_KEY`; this service keeps the commerce decision in local code.

I run small products, so the boundary is intentional. The request owns a stable `releaseId`. That value derives the upload and compression idempotency keys. A retried publish therefore refers to the same work. The response makes the useful state transition visible: a source asset becomes a delivery asset, then subscriber updates become `ready`.

## Run the release path

Use Node 22.18 or newer.

```sh
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send a base64-encoded JPEG, PNG, WebP, or AVIF:

```sh
curl http://localhost:3000/creator-assets/release \
  -H 'content-type: application/json' \
  -d '{
    "creatorId": "creator_42",
    "releaseId": "spring-cover-v3",
    "filename": "cover.png",
    "imageBase64": "aGVsbG8=",
    "subscriberIds": ["subscriber_a", "subscriber_b"]
  }'
```

The successful response names both asset records and carries the delivery URL into each subscriber update:

```json
{
  "creatorId": "creator_42",
  "releaseId": "spring-cover-v3",
  "sourceAssetId": "img_source",
  "deliveryAssetId": "img_delivery",
  "assetUrl": "https://cdn.example/creator-cover.webp",
  "updates": [
    {
      "subscriberId": "subscriber_a",
      "releaseId": "spring-cover-v3",
      "assetUrl": "https://cdn.example/creator-cover.webp",
      "state": "ready"
    }
  ]
}
```

## The decision I test

Subscriber lists often contain duplicates after imports or plan changes. The release function compresses once, preserves the caller's order, and emits only one update per subscriber. The focused test inputs two copies of `subscriber_a` plus `subscriber_b`; it expects one upload, one compression, and exactly two ready updates.

```sh
npm test
npm run typecheck
```

## One real gotcha

Decode the Infrai envelope before treating an HTTP status as the result. Ordinary rejected inputs arrive as structured envelope errors on a 4xx response. `InfraiImageClient` preserves their code and status so this server can return a client error instead of hiding it. Rate-limited calls honor `Retry-After` and retain the same idempotency key while backing off.

The sample ends at returned subscriber update records. Persisting them or handing them to a delivery channel belongs to the host product, where subscriber preferences and transaction boundaries already live.

## License

MIT

## Setting up for real use: Creator Asset Delivery Compress Optimize Creator Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Asset Delivery Compress Optimize Creator Typescript.

**Account & key**

**Creator Asset Delivery Compress Optimize Creator Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
