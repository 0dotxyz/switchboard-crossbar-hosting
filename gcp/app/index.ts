import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { ClusterConfig, DEFAULT_HPA, DEFAULT_SERVICE, getCrossbarEnvVars } from "../../config";

export interface AppDeploymentResult {
    deployment: k8s.apps.v1.Deployment;
    service: k8s.core.v1.Service;
    hpa?: k8s.autoscaling.v2.HorizontalPodAutoscaler;
    ingress: k8s.networking.v1.Ingress;
}

export function createAppDeployment(
    clusterName: string,
    clusterConfig: ClusterConfig,
    k8sProvider: k8s.Provider,
    regionalIp: pulumi.Output<string>,
    clusterIssuer: k8s.apiextensions.CustomResource
): AppDeploymentResult {
    // Get CROSSBAR_ environment variables
    const crossbarEnvVars = getCrossbarEnvVars();

    // Convert environment variables to Kubernetes format
    const envVars = Object.entries(crossbarEnvVars).map(([key, value]) => ({
        name: key,
        value: value,
    }));

    // Merge default values with cluster config
    const hpaConfig = { ...DEFAULT_HPA, ...clusterConfig.app.hpa };
    const serviceConfig = { ...DEFAULT_SERVICE, ...clusterConfig.app.service };

    // Create Kubernetes Deployment
    const deployment = new k8s.apps.v1.Deployment(
        `${clusterName}-app-deployment`,
        {
            metadata: {
                name: `${clusterName}-app`,
                labels: {
                    app: `${clusterName}-app`,
                    component: "application",
                },
            },
            spec: {
                replicas: hpaConfig.enabled ? hpaConfig.minReplicas : 1,
                selector: {
                    matchLabels: {
                        app: `${clusterName}-app`,
                    },
                },
                template: {
                    metadata: {
                        labels: {
                            app: `${clusterName}-app`,
                        },
                    },
                    spec: {
                        containers: [
                            {
                                name: "app",
                                image: clusterConfig.app.image,
                                ports: [
                                    {
                                        containerPort: serviceConfig.port,
                                        name: "http",
                                    },
                                ],
                                env: envVars,
                                resources: clusterConfig.app.resources ? {
                                    requests: clusterConfig.app.resources.requests,
                                    limits: clusterConfig.app.resources.limits,
                                } : undefined,
                                livenessProbe: {
                                    httpGet: {
                                        path: "/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true",
                                        port: serviceConfig.port,
                                    },
                                    initialDelaySeconds: 30,
                                    periodSeconds: 10,
                                },
                                readinessProbe: {
                                    httpGet: {
                                        path: "/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true",
                                        port: serviceConfig.port,
                                    },
                                    initialDelaySeconds: 5,
                                    periodSeconds: 5,
                                },
                            },
                        ],
                    },
                },
            },
        },
        { provider: k8sProvider }
    );

    // Create ClusterIP Service
    const service = new k8s.core.v1.Service(
        `${clusterName}-app-service`,
        {
            metadata: {
                name: `${clusterName}-app-service`,
                labels: {
                    app: `${clusterName}-app`,
                },
            },
            spec: {
                type: "ClusterIP",
                ports: [
                    {
                        port: serviceConfig.port,
                        targetPort: serviceConfig.port,
                        name: "http",
                    },
                ],
                selector: {
                    app: `${clusterName}-app`,
                },
            },
        },
        { provider: k8sProvider }
    );

    // Create HorizontalPodAutoscaler if enabled
    let hpa: k8s.autoscaling.v2.HorizontalPodAutoscaler | undefined;
    if (hpaConfig.enabled) {
        hpa = new k8s.autoscaling.v2.HorizontalPodAutoscaler(
            `${clusterName}-app-hpa`,
            {
                metadata: {
                    name: `${clusterName}-app-hpa`,
                    labels: {
                        app: `${clusterName}-app`,
                    },
                },
                spec: {
                    scaleTargetRef: {
                        apiVersion: "apps/v1",
                        kind: "Deployment",
                        name: deployment.metadata.name,
                    },
                    minReplicas: hpaConfig.minReplicas,
                    maxReplicas: hpaConfig.maxReplicas,
                    metrics: [
                        {
                            type: "Resource",
                            resource: {
                                name: "cpu",
                                target: {
                                    type: "Utilization",
                                    averageUtilization: hpaConfig.targetCpuUtilization,
                                },
                            },
                        },
                        {
                            type: "Resource",
                            resource: {
                                name: "memory",
                                target: {
                                    type: "Utilization",
                                    averageUtilization: hpaConfig.targetMemoryUtilization,
                                },
                            },
                        },
                    ],
                },
            },
            { provider: k8sProvider }
        );
    }

    // Create Ingress with TLS termination
    const ingress = new k8s.networking.v1.Ingress(
        `${clusterName}-app-ingress`,
        {
            metadata: {
                name: `${clusterName}-app-ingress`,
                labels: {
                    app: `${clusterName}-app`,
                },
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                    "cert-manager.io/cluster-issuer": clusterIssuer.metadata.name,
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true",
                },
            },
            spec: {
                tls: [
                    {
                        hosts: [regionalIp.apply(ip => `${ip}.sslip.io`)],
                        secretName: `${clusterName}-app-tls`,
                    },
                ],
                rules: [
                    {
                        host: regionalIp.apply(ip => `${ip}.sslip.io`),
                        http: {
                            paths: [
                                {
                                    path: "/",
                                    pathType: "Prefix",
                                    backend: {
                                        service: {
                                            name: service.metadata.name,
                                            port: {
                                                number: serviceConfig.port,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
        { provider: k8sProvider }
    );

    return {
        deployment,
        service,
        hpa,
        ingress,
    };
}
