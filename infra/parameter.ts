#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();
import { commonConfig } from "./lib/config/common";
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// ==========================================================================
// AWSアカウント情報
// 【重要】誤デプロイを防ぐため、こちらで設定したアカウント以外ではdeployできません
// AWSアカウントIDとリージョンを正確に設定してください
// ==========================================================================

interface Env {
  account: string;
  region: string;
}

export interface DatabaseConfig {
  instanceClass: ec2.InstanceClass;  // インスタンスクラス（ec2.InstanceClass.T3等）
  instanceSize: ec2.InstanceSize;    // インスタンスサイズ（ec2.InstanceSize.MICRO等）
  backupRetentionDays: number;       // バックアップ保持日数
  multiAz: boolean;                  // マルチAZ配置
  deletionProtection: boolean;       // 削除保護
}

export interface StackParameter {
  envName: string;
  env: Env;
  database: DatabaseConfig;
  serviceCpu: number;
  serviceMemory: number;
  appSecretName: string; // 事前に AWS コンソールで作成した Secret 名 (rails_master_key, secret_key_base を key/value で保持)
}

export const stagingStackParameter: StackParameter = {
  envName: "staging",
  env: {
    account: process.env.CDK_ACCOUNT ?? (() => { throw new Error('CDK_ACCOUNT is not set in .env') })(),
    region: commonConfig.region
  },
  database: {
    instanceClass: ec2.InstanceClass.T3,
    instanceSize: ec2.InstanceSize.MICRO,
    backupRetentionDays: 7,
    multiAz: false,
    deletionProtection: false,
  },
  serviceCpu: 256,
  serviceMemory: 512,
  appSecretName: 'cdk-staging-app-cdk-tutorial',
};
