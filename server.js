const express = require('express');
const app = express();

// Azure App Service는 process.env.PORT를 통해 포트를 지정합니다.
// 로컬 테스트 시에는 3000번 포트를 사용합니다.
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Azure Node.js App</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: white;
          overflow: hidden;
        }
        .container {
          text-align: center;
          animation: fadeIn 2s ease-in-out;
        }
        h1 {
          font-size: 5rem;
          margin: 0;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          letter-spacing: -2px;
        }
        p {
          font-size: 1.5rem;
          margin-top: 10px;
          opacity: 0.8;
          font-weight: 300;
        }
        .badge {
          margin-top: 20px;
          display: inline-block;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50px;
          font-size: 0.9rem;
          backdrop-filter: blur(5px);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Hello World</h1>
        <p>Azure Web App (Node.js 24 LTS) 배포 성공!</p>
        <div class="badge">Deployed via GitHub & VS Code</div>
      </div>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
