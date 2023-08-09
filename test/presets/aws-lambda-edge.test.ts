import { resolve } from "pathe";
import { describe } from "vitest";
import destr from "destr";
import type {
  CloudFrontHeaders,
  CloudFrontRequestEvent,
  CloudFrontResultResponse,
} from "aws-lambda";
import { setupTest, testNitro } from "../tests";

describe("nitro:preset:aws-lambda-edge", async () => {
  const ctx = await setupTest("aws-lambda", {
    config: { awsLambda: { target: "edge" } },
  });
  testNitro(ctx, async () => {
    const { handler } = await import(resolve(ctx.outDir, "server/index.mjs"));
    return async ({ url: rawRelativeUrl, headers, method, body }) => {
      // creating new URL object to parse query easier
      const url = new URL(`https://example.com${rawRelativeUrl}`);
      // modify headers to CloudFrontHeaders.
      const reqHeaders: CloudFrontHeaders = Object.fromEntries(
        Object.entries(headers || {}).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.map((value) => ({ value })) : [{ value: v }],
        ])
      );

      const cloudfrontRequest = {
        method: method || "GET",
        uri: url.pathname,
        querystring: decodeURIComponent(url.searchParams.toString()).replace(
          /=$|=(?=&)/g,
          ""
        ),
        headers: reqHeaders,
        body: {
          action: "read-only" as const,
          encoding: "text" as const,
          data: body,
          inputTruncated: false,
        },
      };

      console.log(cloudfrontRequest);

      const event: CloudFrontRequestEvent = {
        Records: [
          {
            cf: {
              config: {
                distributionDomainName: "nitro.cloudfront.net",
                distributionId: "EDFDVBD6EXAMPLE",
                eventType: "origin-request",
                requestId:
                  "4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ==",
              },
              request: {
                clientIp: "203.0.113.178",
                ...cloudfrontRequest,
              },
            },
          },
        ],
      };
      const res: CloudFrontResultResponse = await handler(event);
      // responsed CloudFrontHeaders are special, so modify them for testing.
      const resHeaders = Object.fromEntries(
        Object.entries(res.headers).map(([key, keyValues]) => [
          key,
          keyValues.map((kv) => kv.value).join(","),
        ])
      );
      console.log(res);
      return {
        data: destr(res.body),
        status: Number.parseInt(res.status),
        headers: resHeaders,
      };
    };
  });
});