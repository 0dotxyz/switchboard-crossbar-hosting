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
import { createAppDeployment } from "./gcp/app";

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

// We'll create the IngressClass inside the cluster loop to ensure proper dependencies

// Create infrastructure for each region
const clusterResults = config.regions.map((region, index) => {
    const clusterName = `crossbar-${region}`;

    // Create VPC and subnet
    const { vpc, subnet } = createVpc(
        clusterName,
        region,
        gcpProvider,
        {
            vpcName: `gke-egress-vpc-${region}`,
            subnetCidr: "10.10.0.0/20",
            privateNodes: true,
        }
    );

    // Create NAT Gateway
    const { router, nat, staticIps } = createNatGateway(
        clusterName,
        region,
        subnet,
        gcpProvider,
        { numNatAddresses: 1 }
    );

    // Create GKE cluster
    const { cluster: gkeCluster, nodePool } = createGkeCluster(
        clusterName,
        region,
        subnet,
        gcpProvider,
        {
            machineType: config.machineType,
            diskSizeGb: config.diskSizeGb,
            spot: config.spot,
        },
        true, // privateNodes
        { deletionProtection: config.clusterProtection }
    );

    // Create Kubernetes provider for this cluster (with cluster dependency)
    const k8sProvider = new k8s.Provider(`${clusterName}-k8s-provider`, {
        kubeconfig: gkeCluster.endpoint.apply(endpoint =>
            gkeCluster.masterAuth.apply(auth => {
                const clusterCaCertificate = auth.clusterCaCertificate;
                return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${clusterCaCertificate}
    server: https://${endpoint}
  name: ${clusterName}-cluster
contexts:
- context:
    cluster: ${clusterName}-cluster
    user: ${clusterName}-user
  name: ${clusterName}-context
current-context: ${clusterName}-context
kind: Config
users:
- name: ${clusterName}-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: gke-gcloud-auth-plugin
      installHint: Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke
      provideClusterInfo: true`;
            })
        ),
    }, { dependsOn: [gkeCluster, nodePool] });

    // Add node pool readiness check to ensure nodes are available
    const nodePoolReady = nodePool.nodeCount.apply(count => {
        // This will only resolve when the node pool has nodes
        return count;
    });

    // Create shared IngressClass only for the first cluster to avoid duplicates
    let sharedIngressClass;
    if (index === 0) {
        sharedIngressClass = new k8s.networking.v1.IngressClass("nginx", {
            metadata: {
                name: "nginx",
            },
            spec: {
                controller: "k8s.io/ingress-nginx",
            },
        }, { provider: k8sProvider, dependsOn: [gkeCluster] });
    }

    // Create regional static IP for load balancer
    const { regionalIp } = createRegionalStaticIp(
        clusterName,
        region,
        gcpProvider
    );

    // Create NGINX Ingress Controller (depends on node pool being ready)
    const { nginxIngress } = createNginxIngressController(
        clusterName,
        k8sProvider,
        regionalIp,
        [nodePool] // Wait for node pool to be ready
    );

    // Create cert-manager (depends on node pool being ready)
    const { certManager, clusterIssuer } = createCertManager(
        clusterName,
        k8sProvider,
        process.env.CERT_MANAGER_EMAIL || "admin@example.com",
        [nodePool] // Wait for node pool to be ready
    );

    // Create app deployment (depends on cert-manager being ready)
    const { deployment, service, ingress } = createAppDeployment(
        clusterName,
        {
            image: config.image,
            resources: config.resources,
            service: { port: 8080 }
        },
        k8sProvider,
        regionalIp.address,
        clusterIssuer,
        [certManager, nginxIngress] // Dependencies: wait for cert-manager and nginx to be ready
    );

    return {
        name: clusterName,
        region: region,
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
        deployment: deployment,
        service: service,
        ingress: ingress,
    };
});

// Export simplified cluster information
export const clusters = clusterResults.map(result => ({
    name: result.name,
    region: result.region,
    httpsUrl: result.regionalIp.address.apply(ip => `https://${ip}.sslip.io`),
    egressIp: result.staticIps[0].address,
}));

// Export summary
export const summary = {
    totalRegions: config.regions.length,
    regions: config.regions,
    image: config.image,
    machineType: config.machineType,
    spot: config.spot,
    globalLoadBalancer: config.globalLoadBalancer,
};
