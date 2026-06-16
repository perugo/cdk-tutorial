import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { commonConfig } from "./../config/common";

export class Ecr extends Construct {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { appName } = commonConfig;

    this.repository = new ecr.Repository(this, "Repo", {
      repositoryName: appName,
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });
  }
}
