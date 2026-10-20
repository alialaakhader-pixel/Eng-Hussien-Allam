export type VideoSource =
  | { kind: 'embed'; provider: 'youtube' | 'vimeo' | 'drive'; url: string }
  | { kind: 'file'; url: string }
  | { kind: 'empty'; url: '' };

const YT_ID = /^[\w-]{11}$/;

function youTubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return YT_ID.test(id) ? id : null;
  }
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const v = u.searchParams.get('v');
    if (v && YT_ID.test(v)) return v;
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Turns whatever link the teacher pasted into something the player can actually play:
 * YouTube (watch / youtu.be / shorts / live / embed), Vimeo, Google Drive share links,
 * or a direct video file (mp4 / webm / ogg / mov / m3u8).
 */
export function resolveVideoSource(raw?: string): VideoSource {
  const input = (raw || '').trim();
  if (!input) return { kind: 'empty', url: '' };

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return { kind: 'file', url: input }; // relative path such as /videos/lesson1.mp4
  }

  const yt = youTubeId(u);
  if (yt) {
    return {
      kind: 'embed',
      provider: 'youtube',
      url: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1`,
    };
  }

  const host = u.hostname.replace(/^www\./, '');

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.match(/(\d{6,})/)?.[1];
    if (id) return { kind: 'embed', provider: 'vimeo', url: `https://player.vimeo.com/video/${id}` };
  }

  if (host === 'drive.google.com') {
    const id = u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || u.searchParams.get('id');
    if (id) return { kind: 'embed', provider: 'drive', url: `https://drive.google.com/file/d/${id}/preview` };
  }

  return { kind: 'file', url: input };
}
