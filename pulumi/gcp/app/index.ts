import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { AppConfig, DEFAULT_SERVICE, getCrossbarEnvVars } from "../../config";

export interface AppDeploymentResult {
    deployment: k8s.apps.v1.Deployment;
    service: k8s.core.v1.Service;
    ingress: k8s.networking.v1.Ingress;
}

export function createAppDeployment(
    clusterName: string,
    appConfig: AppConfig,
    k8sProvider: k8s.Provider,
    regionalIp: pulumi.Output<string>,
    clusterIssuer: k8s.apiextensions.CustomResource,
    dependencies?: pulumi.Resource[]
): AppDeploymentResult {
    // Get CROSSBAR_ environment variables
    const crossbarEnvVars = getCrossbarEnvVars();

    // Convert environment variables to Kubernetes format
    const envVars = Object.entries(crossbarEnvVars).map(([key, value]) => ({
        name: key,
        value: value,
    }));

    // Merge default values with app config
    const serviceConfig = { ...DEFAULT_SERVICE, ...appConfig.service };

    // Create Kubernetes Deployment with exactly 1 replica
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
                replicas: 1, // Fixed to 1 replica, no HPA
                selector: {
                    matchLabels: {
                        app: `${clusterName}-app`,
                    },
                },
                template: {
                    metadata: {
                        labels: {
                            app: `${clusterName}-app`,
                            component: "application",
                        },
                    },
                    spec: {
                        restartPolicy: "Always",
                        containers: [
                            {
                                name: "app",
                                image: appConfig.image,
                                ports: [
                                    {
                                        containerPort: serviceConfig.port,
                                        name: "http",
                                    },
                                ],
                                env: envVars,
                                resources: appConfig.resources || {
                                    requests: {
                                        cpu: "1000m",
                                        memory: "2048Mi",
                                    },
                                    limits: {
                                        cpu: "2000m",
                                        memory: "4096Mi",
                                    },
                                },
                                livenessProbe: {
                                    httpGet: {
                                        path: "/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true",
                                        port: serviceConfig.port,
                                    },
                                    initialDelaySeconds: 30,
                                    periodSeconds: 30,
                                },
                                readinessProbe: {
                                    httpGet: {
                                        path: "/simulate/solana/mainnet/EAsoLo2uSvBDx3a5grqzfqBMg5RqpJVHRtXmjsFEc4LL?includeReceipts=true",
                                        port: serviceConfig.port,
                                    },
                                    initialDelaySeconds: 10,
                                    periodSeconds: 10,
                                },
                            },
                        ],
                    },
                },
            },
        },
        { provider: k8sProvider }
    );

    // Create Kubernetes Service
    const service = new k8s.core.v1.Service(
        `${clusterName}-app-service`,
        {
            metadata: {
                name: `${clusterName}-app-service`,
                labels: {
                    app: `${clusterName}-app`,
                    component: "application",
                },
            },
            spec: {
                type: "ClusterIP",
                ports: [
                    {
                        port: serviceConfig.port,
                        targetPort: serviceConfig.port,
                        protocol: "TCP",
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

    // Create Ingress with TLS
    const ingress = new k8s.networking.v1.Ingress(
        `${clusterName}-app-ingress`,
        {
            metadata: {
                name: `${clusterName}-app-ingress`,
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                    "cert-manager.io/cluster-issuer": clusterIssuer.metadata.name,
                    "nginx.ingress.kubernetes.io/ssl-redirect": "false", // Disable SSL redirect to allow ACME challenges
                },
            },
            spec: {
                tls: [
                    {
                        hosts: [regionalIp.apply(ip => `${ip}.sslip.io`)],
                        secretName: `${clusterName}-tls-secret`,
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
        {
            provider: k8sProvider,
            dependsOn: dependencies
        }
    );

    return {
        deployment,
        service,
        ingress,
    };
}