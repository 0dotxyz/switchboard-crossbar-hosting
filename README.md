# Overview

Basic repo that allows you to run your own crossbar instance very simply.

# Steps

## Pre-Reqs

1. [Install pulumi and setup all your credentials.](https://www.pulumi.com/docs/iac/get-started/gcp/begin/)
2. Create a stage.env or prod.env file...
3. Init your stack: `pulumi stack init org/stage` and `pulumi stack init org/prod` respectively.
3. Select your stack: `pulumi stack select org/stage` or `pulumi stack select org/prod`. It's recommended to have two environemnts. This way you can test new crossbar tags without affecting the production environment.
3. Run `pulumi up` to deploy the infrastructure.
4. If you run into issues, you can run `pulumi up` again in most cases. Other times, you might need to `pulumi destroy` and then `pulumi up` again.

# Caveats

1. SSL certs can take some time to get ready. Use this to test: `curl -k "https://{{your_ip}}.sslip.io/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true"`
2. If you want to destroy. First you need to set the `deletionProtection` to `false` in the Pulumi.dev.yaml file.
    1. Then you do a `pulumi up` to update the state.
    2. Then you can do a `pulumi destroy` to destroy the infrastructure.
3. If your certs don't work, delete them: `kubectl delete certificate crossbar-us-{region}-tls-secret --context=gke_{project_name}_{region}_crossbar-{region}-cluster`