#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();
import { commonConfig } from "./lib/config/common";

// ==========================================================================
// AWSアカウント情報
// 【重要】誤デプロイを防ぐため、こちらで設定したアカウント以外ではdeployできません
// AWSアカウントIDとリージョンを正確に設定してください
// ==========================================================================

interface Env {
  account: string;
  region: string;
}

export interface StackParameter {
  envName: string;
  env: Env;
}

export const stagingStackParameter: StackParameter = {
  envName: "staging",
  env: {
    account: process.env.CDK_ACCOUNT ?? (() => { throw new Error('CDK_ACCOUNT is not set in .env') })(),
    region: commonConfig.region
  }
};
