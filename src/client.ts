import {
  PublishCommand,
  PublishCommandInput,
  SNSClient,
} from "@aws-sdk/client-sns";
import {
  create,
  DescMessage,
  DescMethodStreaming,
  DescMethodUnary,
  DescService,
  MessageInitShape,
  MessageShape,
} from "@bufbuild/protobuf";
import {
  Client,
  ContextValues,
  createClient,
  StreamResponse,
  Transport,
  UnaryResponse,
} from "@connectrpc/connect";
import { MessageAttributePath } from "./const";
import {
  SendMessageCommand,
  SendMessageCommandInput,
  SQSClient,
} from "@aws-sdk/client-sqs";

export function createConnectSNSClient<T extends DescService>(
  service: T,
  topicARN: string,
  client: SNSClient,
): Client<T> {
  return createClient(service, createSNSTransport(service, topicARN, client));
}

export function createSNSTransport(
  service: DescService,
  topicARN: string,
  client: SNSClient,
): Transport {
  return {
    async unary<I extends DescMessage, O extends DescMessage>(
      method: DescMethodUnary<I, O>,
      _signal: AbortSignal | undefined,
      _timeoutMs: number | undefined,
      _header: HeadersInit | undefined,
      input: MessageInitShape<I>,
      _contextValues?: ContextValues,
    ): Promise<UnaryResponse<I, O>> {
      const path = `/${method.parent.typeName}/${method.name}`;
      const s = JSON.stringify(input);

      const publishInput: PublishCommandInput = {
        TopicArn: topicARN,
        Message: s,
        MessageAttributes: {
          [MessageAttributePath]: {
            DataType: "String",
            StringValue: path,
          },
        },
        MessageGroupId: path,
      };

      await client.send(new PublishCommand(publishInput));

      return {
        message: {} as MessageShape<O>,
        method: method,
        stream: false,
        header: new Headers(),
        trailer: new Headers(),
        service: service,
      };
    },

    async stream<I extends DescMessage, O extends DescMessage>(
      _method: DescMethodStreaming<I, O>,
      _signal: AbortSignal | undefined,
      _timeoutMs: number | undefined,
      _header: HeadersInit | undefined,
      _input: AsyncIterable<MessageInitShape<I>>,
      _contextValues?: ContextValues,
    ): Promise<StreamResponse<I, O>> {
      throw new Error("Not implemented");
    },
  };
}

export function createConnectSQSClient<T extends DescService>(
  service: T,
  queueURL: string,
  client: SQSClient,
): Client<T> {
  return createClient(service, createSQSTransport(service, queueURL, client));
}

export function createSQSTransport(
  service: DescService,
  queueURL: string,
  client: SQSClient,
): Transport {
  return {
    async unary<I extends DescMessage, O extends DescMessage>(
      method: DescMethodUnary<I, O>,
      _signal: AbortSignal | undefined,
      _timeoutMs: number | undefined,
      _header: HeadersInit | undefined,
      input: MessageInitShape<I>,
      _contextValues?: ContextValues,
    ): Promise<UnaryResponse<I, O>> {
      const path = `/${method.parent.typeName}/${method.name}`;
      const s = JSON.stringify(input);

      const sendMessageInput: SendMessageCommandInput = {
        QueueUrl: queueURL,
        MessageBody: s,
        MessageAttributes: {
          [MessageAttributePath]: {
            DataType: "String",
            StringValue: path,
          },
        },
        MessageGroupId: path,
      };

      await client.send(new SendMessageCommand(sendMessageInput));

      return {
        message: {} as MessageShape<O>,
        method: method,
        stream: false,
        header: new Headers(),
        trailer: new Headers(),
        service: service,
      };
    },

    async stream<I extends DescMessage, O extends DescMessage>(
      _method: DescMethodStreaming<I, O>,
      _signal: AbortSignal | undefined,
      _timeoutMs: number | undefined,
      _header: HeadersInit | undefined,
      _input: AsyncIterable<MessageInitShape<I>>,
      _contextValues?: ContextValues,
    ): Promise<StreamResponse<I, O>> {
      throw new Error("Not implemented");
    },
  };
}
