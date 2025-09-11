import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

export interface StaticIpResult {
    regionalIp: gcp.compute.Address;
}

export function createRegionalStaticIp(
    name: string,
    region: string,
    provider: gcp.Provider
): StaticIpResult {
    // Create regional static IP for load balancer
    const regionalIp = new gcp.compute.Address(`${name}-lb-ip`, {
        name: `${name}-lb-ip`,
        addressType: "EXTERNAL",
        region: region,
        description: `Regional static IP for ${name} load balancer`,
    }, { provider });

    return { regionalIp };
}
