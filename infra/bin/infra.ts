import * as cdk from 'aws-cdk-lib/core';
import { CdkTutorialStack } from '../lib/stack/cdk-tutorial-stack';
import { StackParameter, stagingStackParameter } from '../parameter';
import { execSync } from "child_process";

const app = new cdk.App();

let infraStackParameter: StackParameter;
infraStackParameter = stagingStackParameter;


// --- アカウント誤デプロイ防止 ---
// .env の CDK_ACCOUNT と実際の AWS 認証情報のアカウントが一致しない場合にデプロイを中断する。
const awsIdentityJson = execSync("aws sts get-caller-identity --output json", {
  encoding: "utf-8",
});
const identity = JSON.parse(awsIdentityJson);
const currentAccount = identity.Account;

if (currentAccount !== infraStackParameter.env.account) {
  throw new Error(
    `🚫 Account mismatch detected!
      Expected: ${infraStackParameter.env.account}
      Actual:   ${currentAccount}

    Please switch AWS profile or update parameters.`
  );
}


// env は  cdk.Stack の super() に渡され、スタックの account/region を定義する. 同じ Stack の中のリソースは全部同じ 「region/account」 内で自動的に作成されます。
const stack = new CdkTutorialStack(app, 'CdkTutorialStack', {
  config: infraStackParameter,
  env: infraStackParameter.env
});

cdk.Tags.of(stack).add('Project', 'CdkTutorial');
