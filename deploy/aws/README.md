# CADLint AWS deployment

`cadlint.yaml` deploys the current single-instance validation environment to AWS account `760050152813` in `us-east-1`. It uses the existing AutoReg VPC, ECS cluster, HTTPS load balancer, and Cognito user pool, while keeping a separate ECS service, ECR repository, certificate, and encrypted EFS file system. The application is available at `https://cadlint.caelvyr.com/` after signing in through Cognito.

Build from the repository root for the ARM64 Fargate task, push to `760050152813.dkr.ecr.us-east-1.amazonaws.com/cadlint-dev`, then deploy the stack with `ImageUri` set to the pushed immutable image tag and `DesiredCount=1`. The load balancer checks `/api/health`, which verifies that the mounted data directory is readable and writable.

The current application stores its JSON database and uploaded PDFs on EFS and intentionally runs one task. Do not increase `DesiredCount` until the application has a transactional database and shared object storage.

The task injects `DEEPSEEK_API_KEY` from the `/cadlint/dev/deepseek-api-key` Secrets Manager secret. CloudFormation's `DeepSeekSecretArn` parameter identifies the secret; `DeepSeekSecretJsonKey` selects the key field from its JSON value. A dedicated ECS execution role can read only that secret. The application defaults to the `deepseek-flash` model and DeepSeek as the active provider unless the system settings select Bedrock. After changing the secret value, redeploy the ECS service so new tasks receive it. Use **System settings → Test connection** to verify the configured provider. Bedrock still requires a usable model ID and account access before it can be selected.
