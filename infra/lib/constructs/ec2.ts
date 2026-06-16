import { Vpc } from "./vpc";
import { Construct } from "constructs";

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';

interface Ec2Props {
  vpcConstruct: Vpc;
  cpu: ec2.InstanceSize;
}

export class Ec2 extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: Ec2Props
  ) {
    super(scope, id);
    
    const { vpcConstruct, cpu } = props;

    vpcConstruct.vpc.availabilityZones.forEach((az) => {
        const instance = new ec2.Instance(this, `CdkWorkshop-MyEc2Instance-${az}`, {
            vpc: vpcConstruct.vpc,
            availabilityZone: az,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, cpu),
            machineImage: ec2.MachineImage.latestAmazonLinux2023({
                cpuType: ec2.AmazonLinuxCpuType.ARM_64,
            }),
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        });
        instance.role.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
        );
        instance.role.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly')
        );
        new ssm.StringParameter(this, `InstanceIdParam-${az}`, {
            parameterName: `/myapp/ec2/instance-id/${az}`,
            stringValue: instance.instanceId,
        });
    });
  }
}
