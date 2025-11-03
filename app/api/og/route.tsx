// 动态 OG 图（Before/After 对比）- 适配 Vercel（Edge Runtime）
import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { ogImageSchema } from "@/lib/validations/og";

export const runtime = "edge"; // Vercel 推荐在 Edge 运行 next/og
export const dynamic = "force-dynamic";

// 画布尺寸
const WIDTH = 1200;
const HEIGHT = 630;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = ogImageSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      // 使用最小fallback，避免400
      return new ImageResponse(
        (
          <div
            style={{
              width: WIDTH,
              height: HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0b0b0b',
              color: 'white',
              fontSize: 42,
            }}
          >
            Remove Anything
          </div>
        ),
        { width: WIDTH, height: HEIGHT }
      );
    }

    const { before, after, id, mode } = parsed.data as {
      before?: string;
      after?: string;
      id?: string;
      mode?: 'light' | 'dark';
    };

    const themeBg = mode === 'light' ? '#f7f7f7' : '#0b0b0b';
    const themeFg = mode === 'light' ? '#111' : '#fff';
    const accent = '#FF4F5E';

    const labelStyle = {
      position: 'absolute' as const,
      top: 24,
      left: 24,
      padding: '8px 12px',
      backgroundColor: 'rgba(0,0,0,0.6)',
      color: '#fff',
      borderRadius: 8,
      fontSize: 24,
      fontWeight: 700,
    };

    return new ImageResponse(
      (
        <div
          style={{
            width: WIDTH,
            height: HEIGHT,
            display: 'flex',
            flexDirection: 'column',
            background: themeBg,
            color: themeFg,
            fontFamily: 'Inter, ui-sans-serif, system-ui',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '20px 28px', gap: 16 }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, background: accent }} />
            <div style={{ fontSize: 28, fontWeight: 800 }}>Remove Anything - AI Background Remover</div>
            <div style={{ marginLeft: 'auto', fontSize: 24, opacity: 0.8 }}>#{id?.slice(-4) || '0000'}</div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, display: 'flex' }}>
            {/* Before */}
            <div style={{ position: 'relative', width: WIDTH / 2, height: HEIGHT - 100, overflow: 'hidden' }}>
              {before ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={before}
                  alt="before"
                  width={WIDTH / 2}
                  height={HEIGHT - 100}
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#ddd' }} />
              )}
              <div style={labelStyle}>Before</div>
            </div>
            {/* After */}
            <div style={{ position: 'relative', width: WIDTH / 2, height: HEIGHT - 100, overflow: 'hidden' }}>
              {after ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={after}
                  alt="after"
                  width={WIDTH / 2}
                  height={HEIGHT - 100}
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#ddd' }} />
              )}
              <div style={{ ...labelStyle, backgroundColor: accent }}>After</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px', borderTop: `2px solid ${mode === 'light' ? '#eaeaea' : '#222'}` }}>
            <div style={{ fontSize: 22, opacity: 0.9 }}>AI removes background in 3 seconds · Free HD download</div>
          </div>
        </div>
      ),
      { width: WIDTH, height: HEIGHT }
    );
  } catch (e) {
    // Fallback到占位图
    return new ImageResponse(
      (
        <div
          style={{
            width: WIDTH,
            height: HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0b0b0b',
            color: 'white',
            fontSize: 42,
          }}
        >
          Remove Anything
        </div>
      ),
      { width: WIDTH, height: HEIGHT }
    );
  }
}
