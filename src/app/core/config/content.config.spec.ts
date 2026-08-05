import { CONTENT_CONFIG, isAndroidExternalPostUrl } from './content.config';

describe('content config', () => {
  it('opens Facebook and Instagram outside the Android reader', () => {
    expect(isAndroidExternalPostUrl('https://www.facebook.com/photo/?fbid=123')).toBe(true);
    expect(isAndroidExternalPostUrl('https://www.instagram.com/p/example/')).toBe(true);
    expect(isAndroidExternalPostUrl('https://dev.to/example')).toBe(false);
  });

  it('keeps pagination and filter limits positive', () => {
    expect(CONTENT_CONFIG.itemsPerPage.posts).toBeGreaterThan(0);
    expect(CONTENT_CONFIG.itemsPerPage.videos).toBeGreaterThan(0);
    expect(CONTENT_CONFIG.filterPillPreviewLimit).toBeGreaterThan(0);
  });
});
