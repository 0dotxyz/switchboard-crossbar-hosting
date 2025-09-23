<div align="center">
  <img src="assets/images/p0-icon.jpg" alt="P0 Logo" width="120" style="margin-right: 20px;"/>
  <img src="assets/images/switchboard.jpg" alt="Switchboard Logo" width="120"/>
  <h1>Switchboard Crossbar Hosting</h1>
  <p><em>Multi-region infrastructure deployment for Switchboard Crossbar instances</em></p>
</div>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Pulumi](https://img.shields.io/badge/Infrastructure-Pulumi-blue)](https://www.pulumi.com/)
[![GCP](https://img.shields.io/badge/Cloud-Google%20Cloud-orange)](https://cloud.google.com/)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-blue)](https://kubernetes.io/)

## Table of Contents
- [Overview](#overview)
- [Sponsored Endpoints](#sponsored-endpoints)
  - [Endpoint Usage](#endpoint-usage)
  - [Adding Your Own Endpoints](#adding-your-own-endpoints)
  - [📢 Stay Updated](#-stay-updated)
- [Basic Design and Architecture](#basic-design-and-architecture)
- [Future Work](#future-work)
- [Steps](#steps)
- [Caveats](#caveats)
- [Contributing](#contributing)

# Overview

Basic repo that allows you to run your own crossbar instance very simply. The main motivations:

- The `crossbar` application is very performant and scaling based on resources is not the bottleneck.
- Surge connects to many exchanges. If a single outgoing IP address is making too many requests, the exchanges will rate limit the IP address. This repo is built with that in mind. 
- The closer you are to Tokyo the lower the latency.

## Sponsored Endpoints

| Company | Region | Endpoint | Stability | Notes |
|---------|--------|----------|-----------|-------|
| <img src="assets/images/p0-icon.jpg" alt="P0" width="20"/> **P0** | `asia-northeast2` (Seoul) | `https://34.97.218.183.sslip.io` | 🟢 **Production** | Primary endpoint, regional coverage |
| <img src="assets/images/p0-icon.jpg" alt="P0" width="20"/> **P0** | `asia-northeast1` (Tokyo) | `https://35.200.6.110.sslip.io` | 🟡 **Staging** | Staging endpoint, high availability but used to test new versions |

> **Note**: All endpoints use preemptible nodes for cost optimization. Minor downtime (seconds) may occur during node preemption, but this saves 60-90% on infrastructure costs.

### Endpoint Usage
- **Primary**: Use `asia-northeast3` for best performance
- **Load Balancing**: Rotate between endpoints to avoid rate limits
- **Testing**: Use the stage environment for development

### Adding Your Own Endpoints

Want to sponsor additional endpoints? Deploy using this repo and submit a PR with your company logo and endpoint details!

### 📢 Stay Updated

Join our Telegram channel for endpoint updates, maintenance notifications, and community discussions: [@switchboard_endpoints](https://t.me/+ktZWZinw7xZlNmVh)

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


1. [Install pulumi and setup all your credentials.](https://www.pulumi.com/docs/iac/get-started/gcp/begin/)
2. `cp env.example stage.env` and `cp env.example prod.env`
3. Init your stack: `pulumi stack init {{org}}/stage` and `pulumi stack init {{org}}/prod` respectively.
4. Select your stack: `pulumi stack select {{org}}/stage` or `pulumi stack select {{org}}/prod`. It's recommended to have two environemnts. This way you can test new crossbar tags without affecting the production environment.
5. Run `pulumi up` to deploy the infrastructure.
6. If you run into issues, you can run `pulumi up` again in most cases. Other times, you might need to `pulumi destroy` and then `pulumi up` again.
7. Once the infrastructure is deployed, you can see all your new IPs. They look something like this: `https://xx.xxx.xx.xx.sslip.io`


# Caveats

1. SSL certs can take some time to get ready. Use this to test: `curl -k "https://{{your_ip}}.sslip.io/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true"`
2. If you want to destroy. First you need to set the `deletionProtection` to `false` in the Pulumi.dev.yaml file.
    1. Then you do a `pulumi up` to update the state.
    2. Then you can do a `pulumi destroy` to destroy the infrastructure.
3. If your certs don't work, delete them: `kubectl delete certificate crossbar-us-{region}-tls-secret --context=gke_{project_name}_{region}_crossbar-{region}-cluster`

# Contributing

Contributions are welcome. Simply create an issue first, we can discuss the changes you want to make. If you want to make a change, you can fork the repo and create a pull request.