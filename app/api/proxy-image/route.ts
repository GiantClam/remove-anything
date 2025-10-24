import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
    }
    
    // 验证URL是否是我们允许的域名
    const allowedDomains = [
      'r2.dev',
      'cloudflare',
      'remove-anything.com',
      'pub-.*\\.r2\\.dev', // R2 public bucket pattern
    ];
    
    const isAllowed = allowedDomains.some(domain => {
      if (domain.includes('*')) {
        const regex = new RegExp(domain.replace(/\*/g, '.*'));
        return regex.test(imageUrl);
      }
      return imageUrl.includes(domain);
    });
    
    if (!isAllowed) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }
    
    // 获取图片
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status });
    }
    
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // 返回图片数据，设置正确的CORS头
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
      },
    });
    
  } catch (error) {
    console.error('Proxy image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
