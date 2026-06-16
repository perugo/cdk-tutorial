import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { StackParameter } from '../../parameter';
import { Vpc } from '../constructs/vpc';
import { FargateService } from '../constructs/fargate_service';
import { Ecr } from '../constructs/ecr';

interface CdkTutorialStackProps extends cdk.StackProps {
  config: StackParameter;
}

export class CdkTutorialStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkTutorialStackProps) {

    super(scope, id, props);

    const { envName, serviceCpu, serviceMemory } = props.config;

    // タグやRemovalPolicyを一元管理
    cdk.Tags.of(this).add('Env', envName);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');

    //VPC
    const vpcConstruct = new Vpc(this, 'Vpc');

    const ecrConstruct = new Ecr(this, 'Ecr', { envName });

    new FargateService(this, 'FargateService', {
      vpcConstruct,
      ecrConstruct,
      serviceCpu,
      serviceMemory,
      envName,
    });
  }
}
