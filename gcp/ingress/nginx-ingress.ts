import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as k8sHelm from "@pulumi/kubernetes/helm/v3";
import * as gcp from "@pulumi/gcp";

export interface NginxIngressResult {
    nginxIngress: k8sHelm.Chart;
}

export function createNginxIngressController(
    name: string,
    provider: k8s.Provider,
    regionalIp: gcp.compute.Address
): NginxIngressResult {
    // Install NGINX Ingress Controller via Helm
    const nginxIngress = new k8sHelm.Chart(`${name}-ngx`, {
        chart: "ingress-nginx",
        version: "4.10.1",
        fetchOpts: {
            repo: "https://kubernetes.github.io/ingress-nginx",
        },
        values: {
            fullnameOverride: `${name}-ngx`,
            controller: {
                admissionWebhooks: {
                    enabled: false, // Disable webhook validation to avoid dependency issues
                },
                publishService: { enabled: true },
                service: {
                    type: "LoadBalancer",
                    loadBalancerIP: regionalIp.address,
                    annotations: {
                        "cloud.google.com/load-balancer-type": "External",
                    },
                },
                metrics: { enabled: true },
                resources: {
                    requests: {
                        cpu: "100m",
                        memory: "90Mi",
                    },
                    limits: {
                        cpu: "500m",
                        memory: "512Mi",
                    },
                },
                ingressClassResource: {
                    name: "nginx",
                    enabled: false, // Don't create IngressClass - we'll create it separately
                    default: false,
                },
            },
        },
    }, { provider });

    return { nginxIngress };
}
