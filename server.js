// Express で index.html を配信するアプリ
const express = require('express');
const path = require('path');
const { Client } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// PostgreSQL 接続設定（環境変数から取得）
const dbConfig = () => ({
  host: process.env.DATABASE_HOST,
  port: 5432,
  database: 'postgres', // PostgreSQLが初期化時に作る postgresDBにアクセスする
  user: 'postgres',
  password: process.env.DATABASE_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// 静的ファイル (public/index.html など) を配信
app.use(express.static(path.join(__dirname)));

// 基本的なヘルスチェック
app.get('/health', (req, res) => {
  res.status(200).send('healthy\n');
});

// RDS疎通確認エンドポイント
app.get('/db-health', async (req, res) => {
  const client = new Client(dbConfig());

  try {
    // データベースに接続
    await client.connect();
    
    // シンプルなクエリを実行
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    
    await client.end();
    
    res.status(200).json({
      status: 'success',
      message: 'Database connection successful',
      timestamp: result.rows[0].current_time,
      database_version: result.rows[0].version,
      connection_details: {
        host: process.env.DATABASE_HOST,
        port: 5432,
        database: 'postgres',
        username: 'postgres'
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      connection_details: {
        host: process.env.DATABASE_HOST,
        port: 5432,
        database: 'postgres',
        username: 'postgres'
      }
    });
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`アプリが http://${HOST}:${PORT} で起動しました`);
  console.log('利用可能なエンドポイント:');
  console.log('  GET /          - メインページ');
  console.log('  GET /health    - 基本ヘルスチェック');
  console.log('  GET /db-health - RDS疎通確認');
});

// グレースフルシャットダウン
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
