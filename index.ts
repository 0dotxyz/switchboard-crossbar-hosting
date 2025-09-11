import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import { loadConfig, getCrossbarEnvVars, getGcpProject } from "./config";
import { createVpc } from "./gcp/networking/vpc";
import { createNatGateway } from "./gcp/networking/nat";
import { createGkeCluster } from "./gcp/cluster/gke";

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
        cluster.networking?.privateNodes
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
