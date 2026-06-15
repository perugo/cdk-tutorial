import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { StackParameter } from '../../parameter';

interface CdkTutorialStackProps extends cdk.StackProps {
  config: StackParameter;
}

export class CdkTutorialStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkTutorialStackProps) {

    super(scope, id, props);

    const { envName } = props.config;
  }
}
