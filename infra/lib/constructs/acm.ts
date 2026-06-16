import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { commonConfig } from "./../config/common";

interface AcmProps {
  hostedZone: route53.IHostedZone;
}

export class Acm extends Construct {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: AcmProps) {
    super(scope, id);

    const { baseDomain } = commonConfig;
    const { hostedZone } = props;

    // ACM証明書
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: baseDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone), // DNS検証
    });
  }
}
