import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { ThemePreference } from '../models/app.models';
import { NativeIntegrationService } from './native-integration.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly native = inject(NativeIntegrationService);
  private readonly media = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)');
  private current: ThemePreference = 'automatic';

  constructor() {
    this.media?.addEventListener('change', () => this.apply(this.current));
  }

  apply(preference: ThemePreference): void {
    this.current = preference;
    const root = this.document.documentElement;
    if (preference === 'automatic') root.removeAttribute('data-theme');
    else root.dataset['theme'] = preference;
    const dark =
      preference === 'dark' || (preference === 'automatic' && Boolean(this.media?.matches));
    this.native.setDarkMode(dark);
    const themeMeta = this.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeMeta?.setAttribute('content', dark ? '#07140f' : '#f3f8f5');
  }
}
