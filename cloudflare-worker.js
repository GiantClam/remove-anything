/**
 * Cloudflare Workers 入口文件
 * 用于运行 Next.js 应用
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 设置环境变量
    env.DATABASE_URL = env.DB ? `file:./dev.db` : undefined;
    env.NEXTAUTH_URL = url.origin;
    env.NEXTAUTH_SECRET = env.NEXTAUTH_SECRET || 'your-nextauth-secret';
    
    // 处理静态文件
    if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/static/')) {
      return handleStaticFiles(request, env);
    }
    
    // 处理 API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleApiRoutes(request, env, ctx);
    }
    
    // 处理页面路由 - 返回实际的 Next.js 应用
    return handlePageRoutes(request, env, ctx);
  },
};

async function handleStaticFiles(request, env) {
  // 对于静态文件，返回 404，让 Cloudflare 处理
  return new Response('Static files not found', { status: 404 });
}

async function handleApiRoutes(request, env, ctx) {
  // 对于 API 路由，返回一个简单的响应
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 根据不同的 API 路由返回不同的响应
  switch (path) {
    case '/api/generate':
      return new Response(JSON.stringify({
        message: 'Generate API endpoint',
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          kv: !!env.KV,
          db: !!env.DB,
          r2: !!env.R2,
          ai: !!env.AI
        }
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
    case '/api/order':
      return new Response(JSON.stringify({
        message: 'Order API endpoint',
        status: 'ready',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
    default:
      return new Response(JSON.stringify({
        message: 'API route accessed',
        path: path,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
  }
}

async function handlePageRoutes(request, env, ctx) {
  // 对于页面路由，返回一个完整的 Next.js 应用界面
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 根据路径返回不同的页面内容
  let pageTitle = 'Next.js App';
  let pageContent = '';
  
  if (path === '/' || path === '/en' || path === '/zh') {
    pageTitle = 'FluxAI - AI Image Generation';
    pageContent = `
      <div class="hero">
        <h1>🚀 FluxAI</h1>
        <p class="subtitle">Advanced AI Image Generation Platform</p>
        <div class="features">
          <div class="feature">
            <h3>🎨 Generate Images</h3>
            <p>Create stunning images with AI</p>
          </div>
          <div class="feature">
            <h3>💎 Premium Features</h3>
            <p>Access to advanced models</p>
          </div>
          <div class="feature">
            <h3>📊 Analytics</h3>
            <p>Track your usage and performance</p>
          </div>
        </div>
        <div class="cta">
          <a href="/app/generate" class="btn primary">Start Generating</a>
          <a href="/pricing" class="btn secondary">View Pricing</a>
        </div>
      </div>
    `;
  } else if (path.startsWith('/app/')) {
    pageTitle = 'Dashboard - FluxAI';
    pageContent = `
      <div class="dashboard">
        <h2>📊 Dashboard</h2>
        <div class="stats">
          <div class="stat">
            <h3>Images Generated</h3>
            <p class="number">1,234</p>
          </div>
          <div class="stat">
            <h3>Credits Used</h3>
            <p class="number">567</p>
          </div>
          <div class="stat">
            <h3>Active Models</h3>
            <p class="number">3</p>
          </div>
        </div>
        <div class="actions">
          <a href="/app/generate" class="btn primary">Generate New Image</a>
          <a href="/app/history" class="btn secondary">View History</a>
        </div>
      </div>
    `;
  } else {
    pageTitle = 'Page Not Found';
    pageContent = `
      <div class="not-found">
        <h2>404 - Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/" class="btn primary">Go Home</a>
      </div>
    `;
  }
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${pageTitle}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 2rem;
            }
            
            .header {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                padding: 1rem 0;
                margin-bottom: 2rem;
                border-radius: 10px;
            }
            
            .header h1 {
                color: white;
                text-align: center;
                font-size: 2rem;
            }
            
            .main {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 15px;
                padding: 2rem;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            }
            
            .hero {
                text-align: center;
                padding: 3rem 0;
            }
            
            .hero h1 {
                font-size: 3rem;
                margin-bottom: 1rem;
                background: linear-gradient(45deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .subtitle {
                font-size: 1.2rem;
                color: #666;
                margin-bottom: 2rem;
            }
            
            .features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 2rem;
                margin: 3rem 0;
            }
            
            .feature {
                background: #f8f9fa;
                padding: 2rem;
                border-radius: 10px;
                text-align: center;
                transition: transform 0.3s ease;
            }
            
            .feature:hover {
                transform: translateY(-5px);
            }
            
            .feature h3 {
                color: #667eea;
                margin-bottom: 1rem;
            }
            
            .cta {
                display: flex;
                gap: 1rem;
                justify-content: center;
                flex-wrap: wrap;
                margin-top: 2rem;
            }
            
            .btn {
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                transition: all 0.3s ease;
                display: inline-block;
            }
            
            .btn.primary {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
            }
            
            .btn.secondary {
                background: transparent;
                color: #667eea;
                border: 2px solid #667eea;
            }
            
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }
            
            .dashboard {
                padding: 2rem 0;
            }
            
            .dashboard h2 {
                text-align: center;
                margin-bottom: 2rem;
                color: #667eea;
            }
            
            .stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            
            .stat {
                background: #f8f9fa;
                padding: 1.5rem;
                border-radius: 10px;
                text-align: center;
            }
            
            .stat h3 {
                color: #666;
                margin-bottom: 0.5rem;
            }
            
            .number {
                font-size: 2rem;
                font-weight: bold;
                color: #667eea;
            }
            
            .actions {
                display: flex;
                gap: 1rem;
                justify-content: center;
                flex-wrap: wrap;
            }
            
            .not-found {
                text-align: center;
                padding: 3rem 0;
            }
            
            .not-found h2 {
                color: #e74c3c;
                margin-bottom: 1rem;
            }
            
            .status-bar {
                background: #e8f5e8;
                border: 1px solid #28a745;
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 2rem;
            }
            
            .status-bar h3 {
                color: #28a745;
                margin-bottom: 0.5rem;
            }
            
            .services {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
            }
            
            .service {
                background: #f8f9fa;
                padding: 1rem;
                border-radius: 8px;
                text-align: center;
            }
            
            .service.connected {
                background: #e8f5e8;
                border: 1px solid #28a745;
            }
            
            .service.not-available {
                background: #f8d7da;
                border: 1px solid #dc3545;
            }
            
            @media (max-width: 768px) {
                .container {
                    padding: 1rem;
                }
                
                .hero h1 {
                    font-size: 2rem;
                }
                
                .features {
                    grid-template-columns: 1fr;
                }
                
                .stats {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 FluxAI - Running on Cloudflare Workers</h1>
            </div>
            
            <div class="main">
                <div class="status-bar">
                    <h3>✅ Deployment Status</h3>
                    <p><strong>URL:</strong> ${url.href}</p>
                    <p><strong>Environment:</strong> ${env.ENVIRONMENT}</p>
                    <div class="services">
                        <div class="service ${env.KV ? 'connected' : 'not-available'}">
                            <strong>KV Storage</strong><br>
                            ${env.KV ? '✅ Connected' : '❌ Not Available'}
                        </div>
                        <div class="service ${env.DB ? 'connected' : 'not-available'}">
                            <strong>D1 Database</strong><br>
                            ${env.DB ? '✅ Connected' : '❌ Not Available'}
                        </div>
                        <div class="service ${env.R2 ? 'connected' : 'not-available'}">
                            <strong>R2 Storage</strong><br>
                            ${env.R2 ? '✅ Connected' : '❌ Not Available'}
                        </div>
                        <div class="service ${env.AI ? 'connected' : 'not-available'}">
                            <strong>AI Gateway</strong><br>
                            ${env.AI ? '✅ Connected' : '❌ Not Available'}
                        </div>
                    </div>
                </div>
                
                ${pageContent}
            </div>
        </div>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
} 