import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class Vpc extends Construct {
    public readonly vpc: ec2.Vpc;

    constructor(
        scope: Construct,
        id: string
    ){
        super(scope, id);

        this.vpc = new ec2.Vpc(this, 'Vpc', {
            ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
            maxAzs: 2,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 24,
                    name: 'Isolated',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                }
            ],
            natGateways: 1,
        });
    }
}
