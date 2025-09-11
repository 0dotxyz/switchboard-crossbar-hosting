# Overview

Basic repo that allows you to run your own crossbar instance very simply.

# Steps

## Pre-Reqs

1. [Install pulumi and setup all your credentials.](https://www.pulumi.com/docs/iac/get-started/gcp/begin/)
2. Create a .env file...
3. Run `pulumi up` to deploy the infrastructure.

# Caveats

1. SSL certs can take some time to get ready. Use this to test: `curl -k "https://{{your_ip}}.sslip.io/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true"`
2. If you want to destroy. First you need to set the `deletionProtection` to `false` in the Pulumi.dev.yaml file.
    1. Then you do a `pulumi up` to update the state.
    2. Then you can do a `pulumi destroy` to destroy the infrastructure.
3.