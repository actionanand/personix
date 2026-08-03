import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DATABASE } from './core/database/database.port';
import { IndexedDbDatabase } from './core/database/indexed-db.database';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: DATABASE, useExisting: IndexedDbDatabase }],
    }).compileComponents();
  });

  it('creates the Personix shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
