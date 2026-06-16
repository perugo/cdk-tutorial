const express = require('express');
const app = express()
const PORT = 3000;
const HOST = '0.0.0.0';

app.get('/', (req, res) => {
  res.send('Hello World!')
})

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
