// Express で index.html を配信するアプリ
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// 静的ファイル (index.html) を配信
app.use(express.static(path.join(__dirname)));

app.get('/health', (req, res) => {
  res.status(200).send('healthy\n');
});

const server = app.listen(PORT, HOST, () => {
  console.log(`アプリが http://${HOST}:${PORT} で起動しました`);
  console.log('利用可能なエンドポイント:');
  console.log('  GET /          - メインページ');
  console.log('  GET /health    - 基本ヘルスチェック');
});

// グレースフルシャットダウン
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
