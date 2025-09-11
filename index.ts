import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import { loadConfig, getCrossbarEnvVars, getGcpProject } from "./config";
import { createVpc } from "./gcp/networking/vpc";
import { createNatGateway } from "./gcp/networking/nat";
import { createGkeCluster } from "./gcp/cluster/gke";
import { createRegionalStaticIp } from "./gcp/ingress/static-ip";
import { createNginxIngressController } from "./gcp/ingress/nginx-ingress";
import { createCertManager } from "./gcp/ingress/cert-manager";

// Load and validate configuration
const config = loadConfig();

// Get GCP project from environment variable
const gcpProject = getGcpProject();

// Configure GCP provider
const gcpProvider = new gcp.Provider("gcp-provider", {
    project: gcpProject,
});

// Get CROSSBAR_ environment variables
const crossbarEnvVars = getCrossbarEnvVars();

// Export GCP project for verification
export const gcpProjectId = gcpProject;

// Export environment variables for debugging
export const crossbarEnvVarsFound = Object.keys(crossbarEnvVars);

// Create infrastructure for each cluster
const clusterResults = config.clusters.map(cluster => {
    // Create VPC and subnet
    const { vpc, subnet } = createVpc(
        cluster.name,
        cluster.region,
        gcpProvider,
        cluster.networking
    );

    // Create NAT Gateway
    const { router, nat, staticIps } = createNatGateway(
        cluster.name,
        cluster.region,
        subnet,
        gcpProvider,
        cluster.egress
    );

    // Create GKE cluster
    const { cluster: gkeCluster, nodePool } = createGkeCluster(
        cluster.name,
        cluster.region,
        subnet,
        gcpProvider,
        cluster.nodepool,
        cluster.networking?.privateNodes,
        cluster.cluster
    );

    // Create Kubernetes provider for this cluster
    const k8sProvider = new k8s.Provider(`${cluster.name}-k8s-provider`, {
        kubeconfig: gkeCluster.endpoint.apply(endpoint =>
            gkeCluster.masterAuth.apply(auth => {
                const clusterCaCertificate = auth.clusterCaCertificate;
                return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${clusterCaCertificate}
    server: https://${endpoint}
  name: ${cluster.name}-cluster
contexts:
- context:
    cluster: ${cluster.name}-cluster
    user: ${cluster.name}-user
  name: ${cluster.name}-context
current-context: ${cluster.name}-context
kind: Config
users:
- name: ${cluster.name}-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: gke-gcloud-auth-plugin
      installHint: Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke
      provideClusterInfo: true`;
            })
        ),
    });

    // Create regional static IP for load balancer
    const { regionalIp } = createRegionalStaticIp(
        cluster.name,
        cluster.region,
        gcpProvider
    );

    // Create NGINX Ingress Controller
    const { nginxIngress } = createNginxIngressController(
        cluster.name,
        k8sProvider,
        regionalIp
    );

    // Create cert-manager
    const { certManager, clusterIssuer } = createCertManager(
        cluster.name,
        k8sProvider,
        cluster.ingress?.certManagerEmail || "admin@example.com"
    );

    return {
        name: cluster.name,
        region: cluster.region,
        vpc: vpc,
        subnet: subnet,
        router: router,
        nat: nat,
        staticIps: staticIps,
        cluster: gkeCluster,
        nodePool: nodePool,
        k8sProvider: k8sProvider,
        regionalIp: regionalIp,
        nginxIngress: nginxIngress,
        certManager: certManager,
        clusterIssuer: clusterIssuer,
    };
});

// Export cluster results
export const clusterInfrastructure = clusterResults;

// For backward compatibility, export cluster configs
export const clusterConfigs = config.clusters.map(cluster => ({
    name: cluster.name,
    region: cluster.region,
    hasCrossbarEnvVars: Object.keys(crossbarEnvVars).length > 0
}));

// Export ingress information
export const ingressInfo = clusterResults.map(result => ({
    clusterName: result.name,
    region: result.region,
    regionalIp: result.regionalIp.address,
    httpsUrl: result.regionalIp.address.apply(ip => `https://${ip}.sslip.io`),
    natIps: result.staticIps.map(ip => ip.address),
}));
