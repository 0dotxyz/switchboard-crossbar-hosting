import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { NodePoolConfig, DEFAULT_NODEPOOL, DEFAULT_CLUSTER } from "../../config";

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
    const nodepoolConfig = { ...DEFAULT_NODEPOOL, ...nodepool };
    const clusterSettings = { ...DEFAULT_CLUSTER, ...clusterConfig };

    // Create GKE cluster
    const cluster = new gcp.container.Cluster(`${name}-cluster`, {
        name: `${name}-cluster`,
        location: region,
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

    // Create node pool
    const nodePool = new gcp.container.NodePool(`${name}-nodepool`, {
        name: `${name}-nodepool`,
        location: region,
        cluster: cluster.name,
        nodeCount: nodepoolConfig.minNodes,

        // Autoscaling configuration
        autoscaling: {
            minNodeCount: nodepoolConfig.minNodes,
            maxNodeCount: nodepoolConfig.maxNodes,
        },

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
