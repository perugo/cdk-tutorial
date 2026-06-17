# RDS のホスト名は、cdk deploy 後に Secrets Manager から取得して設定してください。

cd `dirname $0`
ecspresso exec portforward --local-port 8888 --port 5432 --host cdktutorialstack-databasedatabaseinstance5ba792f5-w5rz6vlqu138.cxyyeu6qem9f.ap-northeast-1.rds.amazonaws.com
