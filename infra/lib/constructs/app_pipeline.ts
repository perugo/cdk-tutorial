import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';
import { commonConfig } from "./../config/common";

interface ApplicationPipelineProps {
  envName: string,
  repository: Repository,
  service: ecs_patterns.ApplicationLoadBalancedFargateService,
}

// アプリケーションの自動デプロイを行うCodePipeline、CodeBuild、S3、CloudTrail、EventBridgeを設定
// 責任範囲が独立しているため同じConstructにまとめています
export class ApplicationPipeline extends Construct {
  constructor (
    scope: Construct,
    id: string,
    props: ApplicationPipelineProps
  ) {
    super(scope, id); 

    const { envName, repository, service } = props;
    const { appName, region } = commonConfig;

    const repositoryUri = repository.repositoryUri;

    // GitHubActionsの発行するトークンを認証するOIDCプロバイダー（既存のものを参照）
    const idProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'IdProvider',
      `arn:aws:iam::${cdk.Stack.of(this).account}:oidc-provider/token.actions.githubusercontent.com`
    );

    // Web Identity (サードパーティをPrincipalとすることができる)にassumeするIAMロール
    const githubRole = new iam.Role(this, 'Role', {
        roleName: `${appName}-GitHubActionRole`,
        maxSessionDuration: Duration.hours(1),
        assumedBy: new iam.WebIdentityPrincipal(idProvider.openIdConnectProviderArn, {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': [
              `repo:perugo/${appName}:*`
            ]
          },
        })
      })

    // アプリのソースコードを保管するBucket
    const sourceBucket = new cdk.aws_s3.Bucket(this, 'SourceCodeBucket', {
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        bucketName: `cdk-${envName}-app-source-${appName}`,
        versioned: true,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        eventBridgeEnabled: true,
        // スタック削除時にバケットも自動削除（中身ごと）
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
    });

    // GitHub Actionsからのアクセス権限を付与
    sourceBucket.grantReadWrite(githubRole);

    // CodeBuildの権限周りの設定
    const codeBuildRole = new iam.Role(this, 'CodeBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    });

    repository.grantPullPush(codeBuildRole);
    
    codeBuildRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'], // ECR認証はアカウント全体が対象のため
    }));
    
    codeBuildRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr-public:GetAuthorizationToken',
        'sts:GetServiceBearerToken'
      ],
      resources: ['*'], // ECR Public認証はアカウント全体が対象のため
    }));
    
    codeBuildRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${region}:${cdk.Stack.of(this).account}:log-group:/aws/codebuild/*`
      ],
    }));
    
    codeBuildRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeBuildDeveloperAccess'));

    // CodePipelineの権限周りの設定
    const pipelineRole = new iam.Role(this, 'PipelineRole', {
    assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    });
    pipelineRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));
    pipelineRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodePipeline_FullAccess'));
    pipelineRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeBuildDeveloperAccess'));
    pipelineRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'));

        // BuildSpec(CodeBuildで実行されるスクリプト)
    const buildSpecObject = codebuild.BuildSpec.fromObject({
      version: '0.2',
      env: {
        variables: {
          repositoryUri: repositoryUri,
          defaultRegion: region,
        },
      },
      phases: {
        pre_build: {
          commands: [
            'echo $repositoryUri',
            'echo $defaultRegion',
            'echo Logging in to Amazon ECR...',
            'aws ecr get-login-password --region $defaultRegion | docker login --username AWS --password-stdin $repositoryUri', // ECRにログイン
            'echo Logging in to ECR Public for base images...',
            'aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws' // ECR Publicにログイン(docker imageを無制限にpullできる)
          ],
        },
        build: {
          commands: [
            'echo Building Docker image...',
            'docker build --platform linux/arm64 --build-arg -t ${repositoryUri}:latest -f Dockerfile .', // ARM64プラットフォーム用にビルド
          ],
        },
        post_build: {
          commands: [
            'echo Pushing Docker image to Amazon ECR...',
            'docker push $repositoryUri:latest',
            'echo Creating ECS task definition JSON...',
            'printf \'[{"name":"web","imageUri":"%s:latest"}]\' "$repositoryUri" > imagedefinitions.json', // アーティファクトとして、imagedefinitions.jsonを作成。
            'cat imagedefinitions.json',
          ],
        },
      },
      artifacts: {
        files: ['imagedefinitions.json'],
      },
    });

    // CodeBuild
    const codeBuildProject = new codebuild.PipelineProject(this, 'CodeBuildProject', {
      buildSpec: buildSpecObject,
      role: codeBuildRole,
      environment: {
          privileged: true, // Docker-in-Docker実行のため必須
          buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0, // ARM64 (Graviton) 対応
          computeType: codebuild.ComputeType.LARGE, // ARM64では LARGE 以上が必要
      },
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER, codebuild.LocalCacheMode.CUSTOM)
    })

    // CodePipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      role: pipelineRole,
    });

    // CodePipelineのS3ソースステージ
    const sourceArtifact = new codepipeline.Artifact();
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipelineActions.S3SourceAction({
          actionName: 'S3Source',
          bucket: sourceBucket,
          bucketKey: 'source.zip',
          output: sourceArtifact,
          trigger: codepipelineActions.S3Trigger.EVENTS,
        }),
      ],
    });

     // CodePipelineのBuildステージ
     const buildArtifact = new codepipeline.Artifact();
     pipeline.addStage({
       stageName: 'Build',
       actions: [
         new codepipelineActions.CodeBuildAction({
           actionName: 'CodeBuild',
           project: codeBuildProject,
           input: sourceArtifact,
           outputs: [buildArtifact],
           environmentVariables: {
             envName: {
               value: envName,
               type: codebuild.BuildEnvironmentVariableType.PLAINTEXT
             },
           }
         }),
       ],
     });

    // S3へのsource.zipアップロードでCodePipeline起動するためのEventBridge設定
    // sourceBucketのeventBridgeEnabled: trueを利用してCloudTrail不要で検知
    const s3EventRule = new events.Rule(this, 'S3EventRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [sourceBucket.bucketName],
          },
          object: {
            key: ['source.zip'],
          },
        },
      },
    });
    s3EventRule.addTarget(new targets.CodePipeline(pipeline));

    // CodePipelineのDeployステージ（ECS Fargate へのローリングデプロイ）
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipelineActions.EcsDeployAction({
          actionName: 'EcsDeploy',
          service: service.service,
          imageFile: buildArtifact.atPath('imagedefinitions.json'),
        }),
      ],
    });
  }
}
