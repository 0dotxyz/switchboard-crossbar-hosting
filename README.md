# Overview

Basic repo that allows you to run your own crossbar instance very simply. The main motivations:

- The `crossbar` application is very performant and scaling based on resources is not the bottleneck.
- Surge connects to many exchanges. If a single outgoing IP address is making too many requests, the exchanges will rate limit the IP address. This repo is built with that in mind. 
- The closer you are to Tokyo the lower the latency.

## Basic Design and Architecture

- Each region gets its own isolated network, cluster, node pool, and most **importantly a regional static IP address**.
- If you want two nodes, you simply define two regions. This means two separate outgoing IP addresses. This means you can make twice as many requests without being rate limited.
- Use preemptible nodes to save money. This means you might have some minor downtime (seconds) if a node is preempted. But it can save you 60-90% on node costs.
- This uses `stable` tag. It's best to hardcode a version.

## Future Work

- **Global Load Balancer**:  This might be nice instead of having clients rotate the URL's they use for thier requests.
- **API Key**: If users want to secure their instance they can use an API key. Although for early implementation its not necessary.
- **Multi-Cloud**: Add integrations for AWS, Azure, and any other cloud provider.


# Steps

## Pre-Reqs

1. [Install pulumi and setup all your credentials.](https://www.pulumi.com/docs/iac/get-started/gcp/begin/)
2. `cp env.example stage.env` and `cp env.example prod.env`
3. Init your stack: `pulumi stack init {{org}}/stage` and `pulumi stack init {{org}}/prod` respectively.
3. Select your stack: `pulumi stack select {{org}}/stage` or `pulumi stack select {{org}}/prod`. It's recommended to have two environemnts. This way you can test new crossbar tags without affecting the production environment.
3. Run `pulumi up` to deploy the infrastructure.
4. If you run into issues, you can run `pulumi up` again in most cases. Other times, you might need to `pulumi destroy` and then `pulumi up` again.

# Caveats

1. SSL certs can take some time to get ready. Use this to test: `curl -k "https://{{your_ip}}.sslip.io/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true"`
2. If you want to destroy. First you need to set the `deletionProtection` to `false` in the Pulumi.dev.yaml file.
    1. Then you do a `pulumi up` to update the state.
    2. Then you can do a `pulumi destroy` to destroy the infrastructure.
3. If your certs don't work, delete them: `kubectl delete certificate crossbar-us-{region}-tls-secret --context=gke_{project_name}_{region}_crossbar-{region}-cluster`