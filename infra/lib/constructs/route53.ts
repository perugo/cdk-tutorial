import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import { commonConfig } from "./../config/common";

export class Route53 extends Construct {
  public readonly hostedZone: route53.IPublicHostedZone;

  constructor(
      scope: Construct,
      id: string,
  ){
      super(scope, id);

    const { baseDomain } = commonConfig;
    
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: baseDomain,
    });
  }
}
