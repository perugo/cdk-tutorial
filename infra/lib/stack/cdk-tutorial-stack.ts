import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { StackParameter } from '../../parameter';
import { Vpc } from '../constructs/vpc';
import { Ec2 } from '../constructs/ec2';
import { Ecr } from '../constructs/ecr';

interface CdkTutorialStackProps extends cdk.StackProps {
  config: StackParameter;
}

export class CdkTutorialStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkTutorialStackProps) {

    super(scope, id, props);

    const { envName, cpu } = props.config;

    // タグやRemovalPolicyを一元管理
    cdk.Tags.of(this).add('Env', envName);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');

    //VPC
    const vpcConstruct = new Vpc(this, 'Vpc');

    new Ecr(this, 'Ecr');
    new Ec2(this, 'Ec2', {
      vpcConstruct, cpu
    });
  }
}
