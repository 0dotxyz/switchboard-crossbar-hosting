import * as pulumi from "@pulumi/pulumi";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables based on Pulumi stack
function loadEnvironmentVariables(): void {
    const stack = pulumi.getStack();

    let envFile: string;
    if (stack === "stage") {
        envFile = "stage.env";
    } else if (stack === "prod") {
        envFile = "prod.env";
    } else {
        // Default to stage for any other stack (including dev)
        envFile = "stage.env";
    }

    const envPath = path.resolve(envFile);

    if (fs.existsSync(envPath)) {
        console.log(`Loading environment variables from ${envFile} for stack: ${stack}`);
        dotenv.config({ path: envPath });
    } else {
        console.warn(`Warning: ${envFile} file not found for stack: ${stack}`);
    }
}

// Load environment variables based on stack
loadEnvironmentVariables();

export interface NetworkingConfig {
    vpcName?: string;
    subnetCidr?: string;
    privateNodes?: boolean;
}

export interface NodePoolConfig {
    machineType?: string;
    diskSizeGb?: number;
    spot?: boolean;
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


export interface ResourcesConfig {
    requests?: { cpu?: string; memory?: string; };
    limits?: { cpu?: string; memory?: string; };
}

export interface ServiceConfig {
    port?: number;
}

export interface AppConfig {
    image: string;
    resources?: ResourcesConfig;
    service?: ServiceConfig;
}

export interface ExperimentalConfig {
    gatewayApi?: boolean;
}

export interface Config {
    regions: string[];
    machineType?: string;
    spot?: boolean;
    diskSizeGb?: number;
    image: string;
    clusterProtection?: boolean;
    globalLoadBalancer?: boolean;
    resources?: ResourcesConfig;
}

// Default values
export const DEFAULT_CONFIG: Partial<Config> = {
    machineType: "e2-standard-2",
    spot: true,
    diskSizeGb: 50,
    clusterProtection: false,
    globalLoadBalancer: true,
};

export const DEFAULT_NETWORKING: Required<NetworkingConfig> = {
    vpcName: "gke-egress-vpc",
    subnetCidr: "10.10.0.0/20",
    privateNodes: true,
};

export const DEFAULT_EGRESS: Partial<EgressConfig> = {
    minPortsPerVm: 2048,
};

export const DEFAULT_INGRESS: Required<IngressConfig> = {
    allocateGlobalStaticIp: true,
    hostTemplate: "${LB_IP}.sslip.io",
    certManagerEmail: process.env.CERT_MANAGER_EMAIL || "admin@example.com",
};

export const DEFAULT_SERVICE: Required<ServiceConfig> = {
    port: 8080,
};

// Validation functions
export function validateConfig(config: Config): void {
    if (!config.regions || config.regions.length === 0) {
        throw new Error("At least one region is required");
    }

    if (!config.image || config.image.trim() === "") {
        throw new Error("App image is required and cannot be empty");
    }

    const regionNames = new Set<string>();
    for (const region of config.regions) {
        if (!region || region.trim() === "") {
            throw new Error("Region name cannot be empty");
        }

        if (regionNames.has(region)) {
            throw new Error(`Duplicate region found: ${region}`);
        }
        regionNames.add(region);
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

    // Load the simplified configuration
    const regions = config.requireObject<string[]>("regions");
    const image = config.require("image");
    const machineType = config.get("machineType") || DEFAULT_CONFIG.machineType;
    const spot = config.getBoolean("spot") ?? DEFAULT_CONFIG.spot;
    const diskSizeGb = config.getNumber("diskSizeGb") || DEFAULT_CONFIG.diskSizeGb;
    const clusterProtection = config.getBoolean("clusterProtection") ?? DEFAULT_CONFIG.clusterProtection;
    const globalLoadBalancer = config.getBoolean("globalLoadBalancer") ?? DEFAULT_CONFIG.globalLoadBalancer;

    // Load resources configuration
    const resources = config.getObject<ResourcesConfig>("resources");

    const fullConfig: Config = {
        regions,
        image,
        machineType,
        spot,
        diskSizeGb,
        clusterProtection,
        globalLoadBalancer,
        resources,
    };

    validateConfig(fullConfig);

    return fullConfig;
}
