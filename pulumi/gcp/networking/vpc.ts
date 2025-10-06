import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { NetworkingConfig, DEFAULT_NETWORKING } from "../../config";

export interface VpcResult {
    vpc: gcp.compute.Network;
    subnet: gcp.compute.Subnetwork;
}

export function createVpc(
    name: string,
    region: string,
    provider: gcp.Provider,
    networking?: NetworkingConfig
): VpcResult {
    const config = { ...DEFAULT_NETWORKING, ...networking };

    // Create VPC with unique name per region
    const vpc = new gcp.compute.Network(`${name}-vpc`, {
        name: `${config.vpcName}-${region}`,
        autoCreateSubnetworks: false,
        description: `VPC for ${name} cluster`,
    }, { provider });

    // Create subnet with secondary IP ranges for GKE
    const subnet = new gcp.compute.Subnetwork(`${name}-subnet`, {
        name: `${config.vpcName}-${region}-subnet`,
        ipCidrRange: config.subnetCidr,
        region: region,
        network: vpc.id,
        description: `Subnet for ${name} cluster in ${region}`,
        secondaryIpRanges: [
            {
                rangeName: "pods",
                ipCidrRange: "10.11.0.0/16", // Pod IP range
            },
            {
                rangeName: "services",
                ipCidrRange: "10.12.0.0/16", // Service IP range
            },
        ],
    }, { provider });

    return { vpc, subnet };
}
