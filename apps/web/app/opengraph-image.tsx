import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function Arrow() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4d9375"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M5 12l14 0" />
      <path d="M15 16l4 -4" />
      <path d="M15 8l4 4" />
    </svg>
  );
}

export default async function Image() {
  const [logoData, monoFont, sansFont] = await Promise.all([
    readFile(path.join(process.cwd(), 'public/stoat.png')),
    fetch(
      'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.0/files/jetbrains-mono-latin-400-normal.woff',
    ).then((res) => res.arrayBuffer()),
    fetch(
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files/inter-latin-400-normal.woff',
    ).then((res) => res.arrayBuffer()),
  ]);

  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        background: '#edf1f8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Logo + tagline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          paddingTop: 40,
          fontFamily: 'Inter',
        }}
      >
        <img src={logoSrc} width={90} height={90} alt="" style={{ objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span
            style={{ fontSize: 52, fontWeight: 400, color: '#111827', letterSpacing: '-0.02em' }}
          >
            stoat.run
          </span>
          <span style={{ fontSize: 24, fontWeight: 400, color: '#6b7280' }}>
            tiny tunnels for localhost
          </span>
        </div>
      </div>

      {/* Terminal window */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 1000,
          borderRadius: '14px 14px 0 0',
          overflow: 'hidden',
          boxShadow: '0 -8px 60px rgba(0,0,0,0.22)',
          position: 'absolute',
          bottom: -2,
          fontFamily: 'JetBrains Mono',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#252525',
            padding: '13px 20px',
            borderBottom: '1px solid #111',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 13,
              height: 13,
              borderRadius: 99,
              background: '#ff5f57',
            }}
          />
          <div
            style={{
              display: 'flex',
              width: 13,
              height: 13,
              borderRadius: 99,
              background: '#febc2e',
            }}
          />
          <div
            style={{
              display: 'flex',
              width: 13,
              height: 13,
              borderRadius: 99,
              background: '#28c840',
            }}
          />
        </div>

        {/* Terminal body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#1a1a1a',
            padding: '28px 36px 36px',
            gap: 13,
            fontSize: 22,
          }}
        >
          {/* Command */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ color: '#4d9375' }}>~</span>
            <span style={{ color: '#758575' }}>$</span>
            <span style={{ color: '#dbd7ca' }}>stoat http 3000</span>
          </div>

          {/* Output lines */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Arrow />
            <span style={{ color: '#dbd7ca' }}>Public URL: </span>
            <span style={{ color: '#6394bf' }}>https://velvet-ridge-9827.stoat.run</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Arrow />
            <span style={{ color: '#dbd7ca' }}>Local: http://localhost:3000</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Arrow />
            <span style={{ color: '#dbd7ca' }}>Slug: velvet-ridge-9827</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Arrow />
            <span style={{ color: '#dbd7ca' }}>Expires: in 23 hours</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Arrow />
            <span style={{ color: '#dbd7ca' }}>Viewers: 0</span>
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'JetBrains Mono', data: monoFont, style: 'normal', weight: 400 },
        { name: 'Inter', data: sansFont, style: 'normal', weight: 400 },
      ],
    },
  );
}
