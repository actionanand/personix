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
});
