import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'content',
    loadComponent: () => import('./features/content/content').then((m) => m.Content),
    title: 'Saved Content · Personix',
  },
  {
    path: 'family',
    loadComponent: () => import('./features/family/family').then((m) => m.Family),
    title: 'Family & Health · Personix',
  },
  {
    path: 'vehicles',
    loadComponent: () => import('./features/vehicles/vehicles').then((m) => m.Vehicles),
    title: 'Vehicles & References · Personix',
  },
  {
    path: 'notes',
    loadComponent: () => import('./features/notes/notes').then((m) => m.Notes),
    title: 'Notes · Personix',
  },
  {
    path: 'checklists',
    loadComponent: () => import('./features/checklists/checklists').then((m) => m.Checklists),
    title: 'Checklists · Personix',
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search').then((m) => m.Search),
    title: 'Search · Personix',
  },
  {
    path: 'backup',
    loadComponent: () => import('./features/backup/backup').then((m) => m.Backup),
    title: 'Encrypted Backup · Personix',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
    title: 'Settings · Personix',
  },
  { path: '', pathMatch: 'full', redirectTo: 'content' },
  { path: '**', redirectTo: 'content' },
];
