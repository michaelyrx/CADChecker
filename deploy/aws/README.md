# CADLint AWS deployment

`cadlint.yaml` deploys the current single-instance validation environment to AWS account `760050152813` in `us-east-1`. It uses the existing AutoReg VPC, ECS cluster, HTTPS load balancer, and Cognito user pool, while keeping a separate ECS service, ECR repository, certificate, and encrypted EFS file system. The application is available at `https://cadlint.caelvyr.com/` after signing in through Cognito.

Build from the repository root for the ARM64 Fargate task, push to `760050152813.dkr.ecr.us-east-1.amazonaws.com/cadlint-dev`, then deploy the stack with `ImageUri` set to the pushed immutable image tag and `DesiredCount=1`. The load balancer checks `/api/health`, which verifies that the mounted data directory is readable and writable.

The current application stores its JSON database and uploaded PDFs on EFS and intentionally runs one task. Do not increase `DesiredCount` until the application has a transactional database and shared object storage. The deployed task has no DeepSeek key or Bedrock model ID yet; configure and verify a model before using AI analysis in this environment.
