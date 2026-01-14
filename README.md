# conada

conada (connect adapter) は ConnectRPC のクライアントとサービスを AWS の SNS, SQS で使用できるようにするアダプターです。

## 概要

conada は、ConnectRPC ベースのアプリケーションを AWS SNS/SQS と統合するためのライブラリです。以下の機能を提供します：

- **サーバー側**: SNS/SQS イベントを ConnectRPC ハンドラーにルーティング
- **クライアント側**: ConnectRPC クライアントを SNS/SQS 経由でメッセージを送信するように変換
- **Lambda 対応**: AWS Lambda 関数として直接実行可能
- **Lambda Web Adapter 対応**: Lambda Web Adapter を使用した HTTP サーバーとして実行可能

## インストール

```bash
go get github.com/ralsnet/conada-go/conada
```

## クイックスタート

### サーバー側の実装

#### Lambda 関数として実行

```go
package main

import (
	"context"

	"connectrpc.com/connect"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/ralsnet/conada-go/conada"
	examplev1 "github.com/ralsnet/conada-go/example/gen/example/v1"
	examplev1connect "github.com/ralsnet/conada-go/example/gen/example/v1/examplev1connect"
)

type TestServiceHandler struct {
	examplev1connect.UnimplementedTestServiceHandler
}

func (h *TestServiceHandler) Test(ctx context.Context, req *connect.Request[examplev1.TestRequest]) (*connect.Response[examplev1.TestResponse], error) {
	return connect.NewResponse(&examplev1.TestResponse{
		Success: true,
	}), nil
}

func main() {
	mux := conada.NewMux()

	testServiceHandler := &TestServiceHandler{}
	path, handler := examplev1connect.NewTestServiceHandler(testServiceHandler)
	mux.Handle(path, handler)

	lambdaHandler := conada.NewLambda(mux)
	lambda.Start(lambdaHandler.Handle)
}
```

#### Lambda Web Adapter を使用した HTTP サーバーとして実行

Lambda Web Adapter を設定した Lambda で SNS や SQS をサブスクライブすると、デフォルトでは `/events` にイベントオブジェクトをボディとした HTTP リクエストが送信されます。`HTTPHandler` は `http.Handler` を実装しているため、MUX サーバーなどに設定すれば SNS, SQS のイベントを処理できます。

```go
package main

import (
	"context"
	"net/http"

	"connectrpc.com/connect"
	"github.com/ralsnet/conada-go/conada"
	examplev1 "github.com/ralsnet/conada-go/example/gen/example/v1"
	examplev1connect "github.com/ralsnet/conada-go/example/gen/example/v1/examplev1connect"
)

type TestServiceHandler struct {
	examplev1connect.UnimplementedTestServiceHandler
}

func (h *TestServiceHandler) Test(ctx context.Context, req *connect.Request[examplev1.TestRequest]) (*connect.Response[examplev1.TestResponse], error) {
	return connect.NewResponse(&examplev1.TestResponse{
		Success: true,
	}), nil
}

func main() {
	mux := conada.NewMux()

	testServiceHandler := &TestServiceHandler{}
	path, handler := examplev1connect.NewTestServiceHandler(testServiceHandler)
	mux.Handle(path, handler)

	httpHandler := conada.NewHTTPHandler(mux)
	httpMux := http.NewServeMux()
	httpMux.Handle("/events", httpHandler)

	http.ListenAndServe(":8080", httpMux)
}
```

### クライアント側の実装

#### SNS を使用したクライアント

```go
package main

import (
	"context"
	"log"

	"connectrpc.com/connect"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/ralsnet/conada-go/conada"
	examplev1 "github.com/ralsnet/conada-go/example/gen/example/v1"
	"github.com/ralsnet/conada-go/example/gen/example/v1/examplev1connect"
)

func main() {
	ctx := context.Background()
	awscfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Fatalf("failed to load AWS config: %v", err)
	}
	snsClient := sns.NewFromConfig(awscfg)

	testServiceClient := conada.NewSNSServiceClient(
		examplev1connect.NewTestServiceClient,
		"arn:aws:sns:us-east-1:123456789012:dummy-topic",
		snsClient,
	)

	request := connect.NewRequest(&examplev1.TestRequest{
		Message: &examplev1.TestMessage{
			Name: "test",
		},
	})
	if _, err := testServiceClient.Test(ctx, request); err != nil {
		log.Fatalf("failed to test: %v", err)
	}
}
```

#### SQS を使用したクライアント

```go
package main

import (
	"context"
	"log"

	"connectrpc.com/connect"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/ralsnet/conada-go/conada"
	examplev1 "github.com/ralsnet/conada-go/example/gen/example/v1"
	"github.com/ralsnet/conada-go/example/gen/example/v1/examplev1connect"
)

func main() {
	ctx := context.Background()
	awscfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		log.Fatalf("failed to load AWS config: %v", err)
	}
	sqsClient := sqs.NewFromConfig(awscfg)

	testServiceClient := conada.NewSQSServiceClient(
		examplev1connect.NewTestServiceClient,
		"https://sqs.us-east-1.amazonaws.com/123456789012/dummy-queue",
		sqsClient,
	)

	request := connect.NewRequest(&examplev1.TestRequest{
		Message: &examplev1.TestMessage{
			Name: "test",
		},
	})
	if _, err := testServiceClient.Test(ctx, request); err != nil {
		log.Fatalf("failed to test: %v", err)
	}
}
```

## アーキテクチャ

### メッセージ形式

conada は、SNS/SQS メッセージに以下のメッセージ属性を追加します：

- **`X-Conada-Path`**: ConnectRPC のパス（例: `/example.v1.TestService/Test`）

このパス情報を使用して、受信したメッセージを適切な ConnectRPC ハンドラーにルーティングします。

### メッセージフロー

1. **クライアント側**:

   - ConnectRPC クライアントがリクエストを送信
   - `SNSHTTPClient` または `SQSHTTPClient` が HTTP リクエストを SNS/SQS メッセージに変換
   - メッセージに `X-Conada-Path` 属性を追加して SNS/SQS に送信

2. **サーバー側**:
   - SNS/SQS イベントを受信
   - `MessagesFromSNSEvent` または `MessagesFromSQSEvent` でメッセージを抽出
   - `Mux` が `X-Conada-Path` に基づいて適切なハンドラーを選択
   - ConnectRPC ハンドラーを実行してレスポンスを返す

### Lambda 関数でのエラーハンドリング

- **SNS**: エラーが発生した場合、Lambda 関数はエラーを返します
- **SQS**: エラーが発生したメッセージは `BatchItemFailures` として返され、SQS が再処理します

## API リファレンス

### サーバー側

#### `NewMux() *Mux`

新しい `Mux` インスタンスを作成します。

#### `(m *Mux) Handle(path string, handler http.Handler)`

指定されたパスに HTTP ハンドラーを登録します。`path` は ConnectRPC のパスプレフィックス（例: `/example.v1.TestService/`）です。

#### `NewLambda(mux *Mux) *LambdaHandler`

Lambda 関数用のハンドラーを作成します。

#### `NewHTTPHandler(mux *Mux) *HTTPHandler`

Lambda Web Adapter 用の HTTP ハンドラーを作成します。

### クライアント側

#### `NewSNSServiceClient[T any](initializer ServiceClientInitializer[T], topicARN string, client *sns.Client) T`

SNS を使用する ConnectRPC クライアントを作成します。

#### `NewSQSServiceClient[T any](initializer ServiceClientInitializer[T], queueURL string, client *sqs.Client) T`

SQS を使用する ConnectRPC クライアントを作成します。

## 使用例

詳細な使用例は [`example/`](./example/) ディレクトリを参照してください。

- [`example/lambda/`](./example/lambda/): Lambda 関数としての実装例
- [`example/web/`](./example/web/): Lambda Web Adapter を使用した HTTP サーバーの実装例
- [`example/client/`](./example/client/): SNS クライアントの実装例
