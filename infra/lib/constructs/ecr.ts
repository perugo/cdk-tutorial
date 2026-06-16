import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { commonConfig } from "./../config/common";
import * as assets from "aws-cdk-lib/aws-ecr-assets";
import * as path from "path";

interface EcrProps {
  envName: string;
}

export class Ecr extends Construct {
  public readonly repository: ecr.Repository;

  public readonly appImageAsset: assets.DockerImageAsset;

  constructor(scope: Construct, id: string, props: EcrProps) {
    super(scope, id);

    const { appName } = commonConfig;
    const { envName } = props;

    // 【方式①】インフラデプロイとアプリデプロイを分離する場合に使うECRリポジトリ
    //  - このリポジトリへのイメージの build / push は外部のアプリ CI/CD に委ねる
    this.repository = new ecr.Repository(this, "Repo", {
      repositoryName: `${appName}-${envName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // 【方式②】cdk deploy でインフラとアプリを一括デプロイする場合に使う Asset。
    //   - cdk deploy 時に手元の Dockerfile を build し、CDK Bootstrap の ECRへ自動で push する（上の repository には入らない）
    const dockerDir = path.join(__dirname, '../../..');
    this.appImageAsset = new assets.DockerImageAsset(this, 'AppImage', {
      directory: dockerDir,
      platform: assets.Platform.LINUX_ARM64,
    });
  }
}
