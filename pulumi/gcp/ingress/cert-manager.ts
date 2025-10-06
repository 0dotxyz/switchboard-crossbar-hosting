import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as k8sHelm from "@pulumi/kubernetes/helm/v3";

export interface CertManagerResult {
    certManager: k8sHelm.Release;
    clusterIssuer: k8s.apiextensions.CustomResource;
}

export function createCertManager(
    name: string,
    provider: k8s.Provider,
    email: string = "admin@example.com",
    dependencies?: pulumi.Resource[]
): CertManagerResult {
    // Create cert-manager namespace
    const certManagerNamespace = new k8s.core.v1.Namespace(`${name}-cert-manager-ns`, {
        metadata: {
            name: "cert-manager",
        },
    }, { provider });

    // Install cert-manager via Helm
    const certManager = new k8sHelm.Release(`${name}-cert-manager`, {
        chart: "cert-manager",
        version: "v1.14.4",
        repositoryOpts: {
            repo: "https://charts.jetstack.io",
        },
        namespace: certManagerNamespace.metadata.name,
        values: {
            installCRDs: true,
        },
    }, {
        provider,
        dependsOn: [certManagerNamespace, ...(dependencies || [])],
    });

    // Create webhook endpoints to ensure cert-manager is ready
    const webhookReady = new k8s.core.v1.Endpoints(`${name}-cert-manager-webhook-endpoints`, {
        metadata: {
            name: "cert-manager-webhook",
            namespace: "cert-manager",
        },
    }, {
        provider,
        dependsOn: [certManager],
    });

    // Create ClusterIssuer for Let's Encrypt HTTP-01
    const clusterIssuer = new k8s.apiextensions.CustomResource(`${name}-letsencrypt-issuer`, {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: {
            name: "letsencrypt-prod",
        },
        spec: {
            acme: {
                server: "https://acme-v02.api.letsencrypt.org/directory",
                email: email,
                privateKeySecretRef: {
                    name: "letsencrypt-prod-key",
                },
                solvers: [
                    {
                        http01: {
                            ingress: {
                                class: "nginx",
                            },
                        },
                    },
                ],
            },
        },
    }, {
        provider,
        dependsOn: [webhookReady],
    });

    return { certManager, clusterIssuer };
}
