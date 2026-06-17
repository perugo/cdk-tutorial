import { Construct } from "constructs";
import { Ecr } from "./ecr";
import { Vpc } from "./vpc";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { commonConfig } from "./../config/common";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

interface LoadBalancedFargateServiceProps {
  vpcConstruct: Vpc;
  ecrConstruct: Ecr;
  serviceCpu: number;
  serviceMemory: number;
  rdsSecret: secretsmanager.ISecret;
  certificate: acm.ICertificate;
  hostedZone: route53.IHostedZone;
  envName: string;
}

export class LoadBalancedFargateService extends Construct {
  public readonly service: ecs_patterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: LoadBalancedFargateServiceProps) {
    super(scope, id);

    const { vpcConstruct, ecrConstruct, serviceCpu, serviceMemory, certificate, hostedZone, envName, rdsSecret } = props;
    const { appName, baseDomain } = commonConfig;

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: vpcConstruct.vpc, clusterName: `${appName}-${envName}-ecs-cluster-web` });

    const appImageAsset = ecs.ContainerImage.fromDockerImageAsset(ecrConstruct.appImageAsset);

    this.service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "LoadBalancedFargateService", {
      cluster,
      cpu: serviceCpu,
      memoryLimitMiB: serviceMemory,
      desiredCount: vpcConstruct.vpc.availabilityZones.length,
      circuitBreaker: { rollback: true },
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      taskImageOptions: { 
        image: appImageAsset,
        containerPort: 3000,
        secrets: {
          DATABASE_HOST: ecs.Secret.fromSecretsManager(rdsSecret, 'host'),
          DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(rdsSecret, 'password'),
        },
      },
      domainName: baseDomain,
      domainZone: hostedZone,
      certificate,
      publicLoadBalancer: true,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      serviceName: `${appName}-${envName}-web-service`,
      enableExecuteCommand: true, // ecspresso exec / portforward 用に ECS Exec を有効化
    });

    rdsSecret.grantRead(this.service.taskDefinition.taskRole);
  }
}
