import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { NodePoolConfig } from "../../config";

export interface GkeResult {
    cluster: gcp.container.Cluster;
    nodePool: gcp.container.NodePool;
}

export function createGkeCluster(
    name: string,
    region: string,
    subnet: gcp.compute.Subnetwork,
    provider: gcp.Provider,
    nodepool: NodePoolConfig,
    privateNodes: boolean = true,
    clusterConfig?: { deletionProtection?: boolean; description?: string }
): GkeResult {
    const nodepoolConfig = {
        machineType: "e2-standard-2",
        diskSizeGb: 50,
        spot: true,
        ...nodepool
    };
    const clusterSettings = {
        deletionProtection: false,
        description: "GKE cluster managed by Pulumi",
        ...clusterConfig
    };

    // Create GKE cluster in specific zone (-a) for single node deployment
    const zone = `${region}-a`;
    const cluster = new gcp.container.Cluster(`${name}-cluster`, {
        name: `${name}-cluster`,
        location: zone,
        network: subnet.network,
        subnetwork: subnet.name,
        removeDefaultNodePool: true,
        initialNodeCount: 1,

        // Private cluster configuration
        privateClusterConfig: privateNodes ? {
            enablePrivateNodes: true,
            enablePrivateEndpoint: false,
            masterIpv4CidrBlock: "172.16.0.0/28",
        } : undefined,

        // Network policy
        networkPolicy: {
            enabled: true,
        },

        // IP allocation policy
        ipAllocationPolicy: {
            clusterSecondaryRangeName: "pods",
            servicesSecondaryRangeName: "services",
        },

        description: clusterSettings.description,
        deletionProtection: clusterSettings.deletionProtection,
    }, { provider });

    // Create node pool with exactly 1 node (no autoscaling)
    const nodePool = new gcp.container.NodePool(`${name}-nodepool`, {
        name: `${name}-nodepool`,
        location: zone,
        cluster: cluster.name,
        nodeCount: 1,

        // Node configuration
        nodeConfig: {
            machineType: nodepoolConfig.machineType,
            diskSizeGb: nodepoolConfig.diskSizeGb,
            diskType: "pd-standard",
            preemptible: nodepoolConfig.spot,

            // Service account
            serviceAccount: "default",

            // OAuth scopes
            oauthScopes: [
                "https://www.googleapis.com/auth/cloud-platform",
            ],

            // Labels
            labels: {
                "cluster": name,
                "environment": "production",
            },

            // Tags
            tags: [`${name}-nodes`],
        },

        // Management configuration
        management: {
            autoRepair: true,
            autoUpgrade: true,
        },
    }, { provider });

    return { cluster, nodePool };
}
