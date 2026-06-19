import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { StackParameter } from '../../parameter';
import { Vpc } from '../constructs/vpc';
import { Ecr } from '../constructs/ecr';
import { Route53 } from '../constructs/route53';
import { Rds } from '../constructs/rds';
import { Acm } from '../constructs/acm';
import { LoadBalancedFargateService } from '../constructs/load_balanced_fargate_service';
import { ApplicationPipeline } from '../constructs/app_pipeline';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface CdkTutorialStackProps extends cdk.StackProps {
  config: StackParameter;
}

export class CdkTutorialStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkTutorialStackProps) {

    super(scope, id, props);

    const { envName, serviceCpu, database, serviceMemory, appSecretName } = props.config;

    // タグやRemovalPolicyを一元管理
    cdk.Tags.of(this).add('Env', envName);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');

    //VPC
    const vpcConstruct = new Vpc(this, 'Vpc');

    //ECR
    const ecrConstruct = new Ecr(this, 'Ecr', { envName });

    // RDS
    const rdsConstruct = new Rds(this, 'Database', {
      vpcConstruct,
      config: database,
      envName,
    });

    // Route53
    const route53Construct = new Route53(this, 'Route53');

    // ACM証明書
    const acmConstruct = new Acm(this, 'Acm', {
      hostedZone: route53Construct.hostedZone
    });

    const appSecret = secretsmanager.Secret.fromSecretNameV2(this, 'AppSecret', appSecretName);

    const loadBalancedFargateServiceConstruct = new LoadBalancedFargateService(this, 'LoadBalancedFargateService', {
      vpcConstruct,
      ecrConstruct,
      rdsSecret: rdsConstruct.secret,
      serviceCpu,
      serviceMemory,
      certificate: acmConstruct.certificate,
      envName: envName,
      hostedZone: route53Construct.hostedZone,
      appSecret
    });

    new ApplicationPipeline(this, 'ApplicationPipeline', {
      envName,
      repository: ecrConstruct.repository,
      service: loadBalancedFargateServiceConstruct.service,
    });
  }
}
