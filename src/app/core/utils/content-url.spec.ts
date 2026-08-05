import { buildEmbedUrl, detectContentUrl } from './content-url';

describe('content URL utilities', () => {
  it('preserves YouTube start time in the embed URL', () => {
    const detected = detectContentUrl('https://youtu.be/abc123?t=1m30s');
    expect(detected.startTimeSeconds).toBe(90);
    expect(
      buildEmbedUrl({
        contentType: detected.contentType,
        url: detected.canonicalUrl,
        resolvedUrl: '',
        mediaId: detected.mediaId,
        startTimeSeconds: detected.startTimeSeconds,
      }),
    ).toContain('start=90');
  });

  it('includes the YouTube origin and referrer configuration required by PiP', () => {
    const embed = new URL(
      buildEmbedUrl(
        {
          contentType: 'youtube-short',
          url: 'https://www.youtube.com/shorts/abc123',
          resolvedUrl: '',
          mediaId: 'abc123',
          startTimeSeconds: 0,
        },
        false,
        true,
      ),
    );

    expect(embed.searchParams.get('autoplay')).toBe('1');
    expect(embed.searchParams.get('enablejsapi')).toBe('1');
    expect(embed.searchParams.get('origin')).toBe(window.location.origin);
    expect(embed.searchParams.get('widget_referrer')).toBe(window.location.href);
  });

  it('uses the resolved URL and ID for redirect-based TikTok shares', () => {
    const embed = buildEmbedUrl({
      contentType: 'tiktok-share',
      url: 'https://vm.tiktok.com/demo/',
      resolvedUrl: 'https://www.tiktok.com/@person/video/7391234567890123456',
      mediaId: '7391234567890123456',
      startTimeSeconds: 0,
    });
    expect(embed).toContain('/7391234567890123456');
  });

  it('uses the official Facebook post plugin for non-video posts', () => {
    const embed = buildEmbedUrl({
      contentType: 'facebook-post',
      url: 'https://www.facebook.com/example/posts/123',
      resolvedUrl: '',
      mediaId: '',
      startTimeSeconds: 0,
    });
    expect(embed).toContain('/plugins/post.php');
  });

  it('normalizes a resolved Facebook group share to the canonical reel URL', () => {
    const embed = buildEmbedUrl({
      contentType: 'facebook-share',
      url: 'https://www.facebook.com/share/v/1HXy5sTsvb/',
      resolvedUrl: 'https://www.facebook.com/sanskritkalp/videos/connecting/1646510169815130/',
      mediaId: '1646510169815130',
      startTimeSeconds: 0,
    });
    expect(embed).toContain(encodeURIComponent('https://www.facebook.com/reel/1646510169815130'));
  });

  it('resolves a known Facebook share code without a resolved URL', () => {
    const embed = buildEmbedUrl({
      contentType: 'facebook-share',
      url: 'https://www.facebook.com/share/v/1HXy5sTsvb/',
      resolvedUrl: '',
      mediaId: '',
      startTimeSeconds: 0,
    });
    expect(embed).toContain(encodeURIComponent('https://www.facebook.com/reel/1646510169815130'));
  });

  it('normalizes any resolved Facebook share, not just known overrides', () => {
    const embed = buildEmbedUrl({
      contentType: 'facebook-share',
      url: 'https://www.facebook.com/share/v/1ByFGRo8FF/',
      resolvedUrl: 'https://www.facebook.com/61571672971758/videos/some-slug/1821110698482978/',
      mediaId: '1821110698482978',
      startTimeSeconds: 0,
    });
    expect(embed).toContain(encodeURIComponent('https://www.facebook.com/reel/1821110698482978'));
  });

  it('detects and embeds PeerTube short and UUID watch URLs on any instance', () => {
    const short = detectContentUrl('https://peertube.tv/w/mLgWSkFuNyMkGiyw9d3zLP');
    expect(short).toMatchObject({
      contentType: 'peertube',
      platform: 'PeerTube',
      mediaId: 'mLgWSkFuNyMkGiyw9d3zLP',
    });
    expect(
      buildEmbedUrl({
        contentType: short.contentType,
        url: short.canonicalUrl,
        resolvedUrl: '',
        mediaId: short.mediaId,
        startTimeSeconds: 0,
      }),
    ).toContain('https://peertube.tv/videos/embed/mLgWSkFuNyMkGiyw9d3zLP');

    expect(
      detectContentUrl('https://framatube.org/videos/watch/9db9f3f1-9b54-44ed-9e91-461d262d2205')
        .contentType,
    ).toBe('peertube');
  });

  it('supports Twitch VOD, clip and channel embed URLs with the required parent', () => {
    const vod = detectContentUrl('https://www.twitch.tv/videos/40464143?t=1m30s');
    const vodEmbed = new URL(
      buildEmbedUrl({
        contentType: vod.contentType,
        url: vod.canonicalUrl,
        resolvedUrl: '',
        mediaId: vod.mediaId,
        startTimeSeconds: vod.startTimeSeconds,
      }),
    );
    expect(vod.mediaId).toBe('video:40464143');
    expect(vodEmbed.searchParams.get('video')).toBe('v40464143');
    expect(vodEmbed.searchParams.get('parent')).toBe(window.location.hostname || 'localhost');
    expect(vodEmbed.searchParams.get('time')).toBe('0h1m30s');

    expect(detectContentUrl('https://clips.twitch.tv/ExampleClip').mediaId).toBe(
      'clip:ExampleClip',
    );
    expect(detectContentUrl('https://www.twitch.tv/twitchdev').mediaId).toBe('channel:twitchdev');
  });

  it('supports public Wistia media URLs with the official fallback iframe', () => {
    const detected = detectContentUrl('https://supportvideos.wistia.com/medias/gmwg9g412y');
    expect(detected).toMatchObject({
      contentType: 'wistia',
      platform: 'Wistia',
      mediaId: 'gmwg9g412y',
    });
    expect(
      buildEmbedUrl({
        contentType: detected.contentType,
        url: detected.canonicalUrl,
        resolvedUrl: '',
        mediaId: detected.mediaId,
        startTimeSeconds: 0,
      }),
    ).toContain('https://fast.wistia.net/embed/iframe/gmwg9g412y');
  });
});
