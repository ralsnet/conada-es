import { TestService } from "@ralsnet/conada-es-gen";
import { createConnectSNSClient } from "@ralsnet/conada-es";
import { SNSClient } from "@aws-sdk/client-sns";

const client = createConnectSNSClient(
  TestService,
  "arn:aws:sns:us-east-1:123456789012:test",
  new SNSClient({
    region: "us-east-1",
  }),
);

await client.test({
  message: {
    name: "test",
  },
});
