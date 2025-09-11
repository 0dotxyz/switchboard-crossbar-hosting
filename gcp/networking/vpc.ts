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

    // Create VPC
    const vpc = new gcp.compute.Network(`${name}-vpc`, {
        name: config.vpcName,
        autoCreateSubnetworks: false,
        description: `VPC for ${name} cluster`,
    }, { provider });

    // Create subnet
    const subnet = new gcp.compute.Subnetwork(`${name}-subnet`, {
        name: `${config.vpcName}-subnet`,
        ipCidrRange: config.subnetCidr,
        region: region,
        network: vpc.id,
        description: `Subnet for ${name} cluster in ${region}`,
    }, { provider });

    return { vpc, subnet };
}
