import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import { loadConfig, getCrossbarEnvVars, getGcpProject, DEFAULT_NETWORKING, DEFAULT_NODEPOOL, DEFAULT_EGRESS, DEFAULT_INGRESS, DEFAULT_HPA, DEFAULT_SERVICE, DEFAULT_EXPERIMENTAL } from "./config";

// Load and validate configuration
const config = loadConfig();

// Get GCP project from environment variable
const gcpProject = getGcpProject();

// Get CROSSBAR_ environment variables
const crossbarEnvVars = getCrossbarEnvVars();

// Export GCP project for verification
export const gcpProjectId = gcpProject;

// Export environment variables for debugging
export const crossbarEnvVarsFound = Object.keys(crossbarEnvVars);

// For now, just export the configuration to verify it's working
export const clusterConfigs = config.clusters.map(cluster => ({
    name: cluster.name,
    region: cluster.region,
    hasCrossbarEnvVars: Object.keys(crossbarEnvVars).length > 0
}));
