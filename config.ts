import * as pulumi from "@pulumi/pulumi";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export interface NetworkingConfig {
    vpcName?: string;
    subnetCidr?: string;
    privateNodes?: boolean;
}

export interface NodePoolConfig {
    machineType?: string;
    diskSizeGb?: number;
    spot?: boolean;
    minNodes: number;
    maxNodes: number;
}

export interface EgressConfig {
    numNatAddresses: number;
    minPortsPerVm?: number;
}

export interface IngressConfig {
    allocateGlobalStaticIp?: boolean;
    hostTemplate?: string;
    certManagerEmail?: string;
}

export interface HPAConfig {
    enabled?: boolean;
    minReplicas?: number;
    maxReplicas?: number;
    targetCpuUtilization?: number;
    targetMemoryUtilization?: number;
}

export interface ResourcesConfig {
    requests?: { cpu?: string; memory?: string; };
    limits?: { cpu?: string; memory?: string; };
}

export interface ServiceConfig {
    port?: number;
}

export interface AppConfig {
    image: string;
    hpa?: HPAConfig;
    resources?: ResourcesConfig;
    service?: ServiceConfig;
}

export interface ExperimentalConfig {
    gatewayApi?: boolean;
}

export interface ClusterConfig {
    name: string;
    region: string;
    networking?: NetworkingConfig;
    nodepool: NodePoolConfig;
    egress: EgressConfig;
    ingress?: IngressConfig;
    app: AppConfig;
    experimental?: ExperimentalConfig;
    cluster?: {
        deletionProtection?: boolean;
        description?: string;
    };
}

export interface Config {
    clusters: ClusterConfig[];
}

// Default values
export const DEFAULT_NETWORKING: Required<NetworkingConfig> = {
    vpcName: "gke-egress-vpc",
    subnetCidr: "10.10.0.0/20",
    privateNodes: true,
};

export const DEFAULT_NODEPOOL: Partial<NodePoolConfig> = {
    machineType: "e2-standard-4",
    diskSizeGb: 100,
    spot: false,
};

export const DEFAULT_EGRESS: Partial<EgressConfig> = {
    minPortsPerVm: 2048,
};

export const DEFAULT_INGRESS: Required<IngressConfig> = {
    allocateGlobalStaticIp: true,
    hostTemplate: "${LB_IP}.sslip.io",
    certManagerEmail: "admin@example.com",
};

export const DEFAULT_HPA: Required<HPAConfig> = {
    enabled: true,
    minReplicas: 1,
    maxReplicas: 10,
    targetCpuUtilization: 70,
    targetMemoryUtilization: 80,
};

export const DEFAULT_SERVICE: Required<ServiceConfig> = {
    port: 8080,
};

export const DEFAULT_EXPERIMENTAL: Required<ExperimentalConfig> = {
    gatewayApi: false,
};

export const DEFAULT_CLUSTER = {
    deletionProtection: false,
    description: "GKE cluster managed by Pulumi",
};

// Validation functions
export function validateClusterConfig(cluster: ClusterConfig): void {
    if (!cluster.name || cluster.name.trim() === "") {
        throw new Error("Cluster name is required and cannot be empty");
    }

    if (!cluster.region || cluster.region.trim() === "") {
        throw new Error("Cluster region is required and cannot be empty");
    }

    if (!cluster.nodepool.minNodes || cluster.nodepool.minNodes < 1) {
        throw new Error("NodePool minNodes must be at least 1");
    }

    if (!cluster.nodepool.maxNodes || cluster.nodepool.maxNodes < cluster.nodepool.minNodes) {
        throw new Error("NodePool maxNodes must be greater than or equal to minNodes");
    }

    if (!cluster.egress.numNatAddresses || cluster.egress.numNatAddresses < 1) {
        throw new Error("Egress numNatAddresses must be at least 1");
    }

    if (!cluster.app.image || cluster.app.image.trim() === "") {
        throw new Error("App image is required and cannot be empty");
    }

    if (cluster.app.hpa) {
        if (cluster.app.hpa.minReplicas !== undefined && cluster.app.hpa.minReplicas < 1) {
            throw new Error("HPA minReplicas must be at least 1");
        }

        if (cluster.app.hpa.maxReplicas !== undefined && cluster.app.hpa.minReplicas !== undefined) {
            if (cluster.app.hpa.maxReplicas < cluster.app.hpa.minReplicas) {
                throw new Error("HPA maxReplicas must be greater than or equal to minReplicas");
            }
        }

        if (cluster.app.hpa.targetCpuUtilization !== undefined) {
            if (cluster.app.hpa.targetCpuUtilization < 1 || cluster.app.hpa.targetCpuUtilization > 100) {
                throw new Error("HPA targetCpuUtilization must be between 1 and 100");
            }
        }

        if (cluster.app.hpa.targetMemoryUtilization !== undefined) {
            if (cluster.app.hpa.targetMemoryUtilization < 1 || cluster.app.hpa.targetMemoryUtilization > 100) {
                throw new Error("HPA targetMemoryUtilization must be between 1 and 100");
            }
        }
    }
}

export function validateConfig(config: Config): void {
    if (!config.clusters || config.clusters.length === 0) {
        throw new Error("At least one cluster configuration is required");
    }

    const clusterNames = new Set<string>();
    for (const cluster of config.clusters) {
        validateClusterConfig(cluster);

        if (clusterNames.has(cluster.name)) {
            throw new Error(`Duplicate cluster name found: ${cluster.name}`);
        }
        clusterNames.add(cluster.name);
    }
}

// Helper function to get environment variables with CROSSBAR_ prefix
export function getCrossbarEnvVars(): Record<string, string> {
    const crossbarEnvVars: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith("CROSSBAR_") && value !== undefined) {
            crossbarEnvVars[key] = value;
        }
    }

    return crossbarEnvVars;
}

// Function to validate GCP project is set
export function validateGcpProject(): void {
    const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
    if (!gcpProject || gcpProject.trim() === "") {
        throw new Error("GOOGLE_CLOUD_PROJECT environment variable must be set");
    }
}

// Function to get GCP project
export function getGcpProject(): string {
    const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
    if (!gcpProject || gcpProject.trim() === "") {
        throw new Error("GOOGLE_CLOUD_PROJECT environment variable must be set");
    }
    return gcpProject;
}

// Function to load and validate configuration
export function loadConfig(): Config {
    // Validate GCP project is set
    validateGcpProject();

    const config = new pulumi.Config();

    // Try to get clusters array first
    let clusters: ClusterConfig[];
    try {
        clusters = config.requireObject<ClusterConfig[]>("clusters");
    } catch (error) {
        // If clusters array doesn't exist, try to get single cluster object
        try {
            const singleCluster = config.requireObject<ClusterConfig>("cluster");
            clusters = [singleCluster];
        } catch (singleError) {
            throw new Error("Either 'clusters' array or 'cluster' object must be provided in configuration");
        }
    }

    const fullConfig: Config = { clusters };
    validateConfig(fullConfig);

    return fullConfig;
}
