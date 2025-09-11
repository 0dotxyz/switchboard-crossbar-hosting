import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { EgressConfig, DEFAULT_EGRESS } from "../../config";

export interface NatResult {
    router: gcp.compute.Router;
    nat: gcp.compute.RouterNat;
    staticIps: gcp.compute.Address[];
}

export function createNatGateway(
    name: string,
    region: string,
    subnet: gcp.compute.Subnetwork,
    provider: gcp.Provider,
    egress: EgressConfig
): NatResult {
    const config = { ...DEFAULT_EGRESS, ...egress };

    // Reserve static external IPs for NAT
    const staticIps: gcp.compute.Address[] = [];
    for (let i = 0; i < config.numNatAddresses; i++) {
        const staticIp = new gcp.compute.Address(`${name}-nat-ip-${i}`, {
            name: `${name}-nat-ip-${i}`,
            region: region,
            description: `Static IP ${i + 1} for ${name} NAT gateway`,
        }, { provider });
        staticIps.push(staticIp);
    }

    // Create Cloud Router
    const router = new gcp.compute.Router(`${name}-router`, {
        name: `${name}-router`,
        region: region,
        network: subnet.network,
        description: `Cloud Router for ${name} cluster`,
    }, { provider });

    // Create Cloud NAT
    const nat = new gcp.compute.RouterNat(`${name}-nat`, {
        name: `${name}-nat`,
        router: router.name,
        region: region,
        natIpAllocateOption: "MANUAL_ONLY",
        natIps: staticIps.map(ip => ip.selfLink),
        sourceSubnetworkIpRangesToNat: "ALL_SUBNETWORKS_ALL_IP_RANGES",
        minPortsPerVm: config.minPortsPerVm,
    }, { provider });

    return { router, nat, staticIps };
}
