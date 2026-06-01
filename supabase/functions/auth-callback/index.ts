const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>YouTube Language Lab</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0c0d0e;
        color: #f7f8f8;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0c0d0e;
      }

      main {
        width: min(520px, calc(100vw - 32px));
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        background: #151719;
        padding: 28px;
      }

      h1 {
        margin: 0 0 10px;
        font-size: 24px;
      }

      p {
        margin: 0;
        color: #a3aab5;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>邮箱已验证</h1>
      <p>可以回到 YouTube Language Lab 扩展设置页，使用刚刚注册的邮箱和密码登录。</p>
    </main>
  </body>
</html>`;

Deno.serve(() => {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
});
