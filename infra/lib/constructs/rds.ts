import { Construct } from "constructs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Duration } from "aws-cdk-lib";
import { Vpc } from "./vpc";
import { DatabaseConfig } from "../../parameter";
import { commonConfig } from "./../config/common";

interface RdsProps {
  vpcConstruct: Vpc;
  config: DatabaseConfig;
  envName: string;
}

export class Rds extends Construct {
  public readonly instance: rds.DatabaseInstance;
  public readonly secret: secretsmanager.ISecret;

  constructor(
    scope: Construct,
    id: string,
    props: RdsProps
  ) {
    super(scope, id);
    
    const { vpcConstruct, config, envName } = props;
    const { appName } = commonConfig;

    // RDSインスタンス
    this.instance = new rds.DatabaseInstance(this, 'DatabaseInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_18, // PostgreSQLのバージョン。必要に応じてバージョンを更新してください。 https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.PostgresEngineVersion.html
      }),
      allowMajorVersionUpgrade: true,
      instanceType: ec2.InstanceType.of(
        config.instanceClass,
        config.instanceSize
      ),
      vpc: vpcConstruct.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      databaseName: `${appName.replace(/-/g, '_')}_${envName}`,
      backupRetention: Duration.days(config.backupRetentionDays),
      multiAz: config.multiAz,
      deletionProtection: config.deletionProtection,
    });

    // セキュリティグループの設定
    this.instance.connections.allowFrom(
        ec2.Peer.ipv4(vpcConstruct.vpc.vpcCidrBlock),
        ec2.Port.tcp(5432),
        'Allow PostgreSQL access from VPC'
    );

    // 自動作成されたシークレットを取得
    this.secret = this.instance.secret!;
  }
}
