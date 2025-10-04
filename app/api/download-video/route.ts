import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fileUrl = url.searchParams.get('fileUrl');
  const name = url.searchParams.get('name') || 'sora2-video.mp4';
  if (!fileUrl) return new Response('Missing fileUrl', { status: 400 });

  const res = await fetch(fileUrl);
  if (!res.ok) return new Response('File not found', { status: 404 });

  const buf = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'video/mp4';

  return new Response(buf, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    }
  });
}


