# conada

conada (connect adapter) は ConnectRPC のクライアントとサービスを AWS の SNS, SQS で使用できるようにするアダプターです。

## 概要

conada は、ConnectRPC ベースのアプリケーションを AWS SNS/SQS と統合するためのライブラリです。以下の機能を提供します：

- **サーバー側**: SNS/SQS イベントを ConnectRPC ハンドラーにルーティング（**TODO: 未実装**）
- **クライアント側**: ConnectRPC クライアントを SNS/SQS 経由でメッセージを送信するように変換
- **Lambda 対応**: AWS Lambda 関数として直接実行可能（**TODO: 未実装**）
- **Lambda Web Adapter 対応**: Lambda Web Adapter を使用した HTTP サーバーとして実行可能（**TODO: 未実装**）

## インストール

```bash
pnpm add @ralsnet/conada
```

または

```bash
npm install @ralsnet/conada
```

## クイックスタート

### サーバー側の実装

> **TODO**: サーバー側の実装は現在開発中です。以下の機能が予定されています：
>
> - Lambda 関数としての実行
> - Lambda Web Adapter を使用した HTTP サーバーとしての実行
> - SNS/SQS イベントの ConnectRPC ハンドラーへのルーティング

### クライアント側の実装

#### SNS を使用したクライアント

```typescript
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
```

#### SQS を使用したクライアント

```typescript
import { TestService } from "@ralsnet/conada-es-gen";
import { createConnectSQSClient } from "@ralsnet/conada-es";
import { SQSClient } from "@aws-sdk/client-sqs";

const client = createConnectSQSClient(
  TestService,
  "https://sqs.us-east-1.amazonaws.com/123456789012/dummy-queue",
  new SQSClient({
    region: "us-east-1",
  }),
);

await client.test({
  message: {
    name: "test",
  },
});
```

## アーキテクチャ

### メッセージ形式

conada は、SNS/SQS メッセージに以下のメッセージ属性を追加します：

- **`X-Conada-Path`**: ConnectRPC のパス（例: `/example.v1.TestService/Test`）

このパス情報を使用して、受信したメッセージを適切な ConnectRPC ハンドラーにルーティングします。

### メッセージフロー

1. **クライアント側**:

   - ConnectRPC クライアントがリクエストを送信
   - `createSNSTransport` または `createSQSTransport` がリクエストを SNS/SQS メッセージに変換
   - メッセージに `X-Conada-Path` 属性を追加して SNS/SQS に送信

2. **サーバー側**（**TODO: 未実装**）:
   - SNS/SQS イベントを受信
   - メッセージを抽出
   - `X-Conada-Path` に基づいて適切なハンドラーを選択
   - ConnectRPC ハンドラーを実行してレスポンスを返す

### Lambda 関数でのエラーハンドリング

> **TODO**: サーバー側の実装が完了次第、エラーハンドリングの詳細を記載します。
>
> - **SNS**: エラーが発生した場合、Lambda 関数はエラーを返します
> - **SQS**: エラーが発生したメッセージは `BatchItemFailures` として返され、SQS が再処理します

## API リファレンス

### サーバー側

> **TODO**: サーバー側の API は現在開発中です。

### クライアント側

#### `createConnectSNSClient<T extends DescService>(service: T, topicARN: string, client: SNSClient): Client<T>`

SNS を使用する ConnectRPC クライアントを作成します。

**パラメータ**:

- `service`: ConnectRPC のサービス定義（`DescService`）
- `topicARN`: SNS トピックの ARN
- `client`: AWS SNS クライアントインスタンス

**戻り値**: ConnectRPC クライアントインスタンス

#### `createConnectSQSClient<T extends DescService>(service: T, queueURL: string, client: SQSClient): Client<T>`

SQS を使用する ConnectRPC クライアントを作成します。

**パラメータ**:

- `service`: ConnectRPC のサービス定義（`DescService`）
- `queueURL`: SQS キューの URL
- `client`: AWS SQS クライアントインスタンス

**戻り値**: ConnectRPC クライアントインスタンス

## 使用例

詳細な使用例は [`example/`](./example/) ディレクトリを参照してください。

- [`example/client/`](./example/client/): SNS クライアントの実装例
