import { Construct } from "constructs";
import { Ecr } from "./ecr";
import { Vpc } from "./vpc";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { commonConfig } from "./../config/common";

interface FargateServiceProps {
  vpcConstruct: Vpc;
  ecrConstruct: Ecr;
  envName: string;
  serviceCpu: number;
  serviceMemory: number;
}

export class FargateService extends Construct {
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: FargateServiceProps) {
    super(scope, id);

    const { vpcConstruct, ecrConstruct, serviceCpu, serviceMemory, envName } = props;
    const { appName } = commonConfig;

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: vpcConstruct.vpc, clusterName: `${appName}-${envName}-ecs-cluster-web` });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: serviceCpu,
      memoryLimitMiB: serviceMemory,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // アプリも cdk deploy で一括デプロイする appImageAsset 方式を採用（詳細は ecr.ts）。
    const appImageAsset = ecs.ContainerImage.fromDockerImageAsset(ecrConstruct.appImageAsset);
    // const latestImage = ecs.ContainerImage.fromEcrRepository(ecrConstruct.repository, 'latest');

    taskDefinition.addContainer('web', {
      image: appImageAsset
    });

    this.service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: vpcConstruct.vpc.availabilityZones.length,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
      serviceName: `${appName}-${envName}-web-service`,
      enableExecuteCommand: true, // ecspresso exec / portforward 用に ECS Exec を有効化
    });
  }
}
