import { mkdir, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const password = process.argv[2] || '12345678';
if (password.length < 8)
  throw new Error('The sample backup password must contain at least 8 characters.');

const timestamp = '2026-08-03T10:00:00.000Z';
const base = (id) => ({ id, createdAt: timestamp, updatedAt: timestamp });
const category = {
  ...base('category-learning'),
  name: 'Learning',
  colour: '#2f8f65',
  icon: 'folder',
  isAdult: false,
  archived: false,
};
const tag = { ...base('tag-angular'), name: 'Angular', archived: false };
const recipient = { ...base('recipient-brother'), name: 'Brother', lastUsedAt: timestamp };
const savedContentBase = {
  title: '',
  description: '',
  downloadedOgImageRef: '',
  customThumbnail: '',
  favicon: '',
  notes: '',
  categoryId: category.id,
  tagIds: [tag.id],
  recipientIds: [recipient.id],
  favourite: false,
  adult: false,
  consumed: false,
  sent: false,
  sentAt: '',
  sentNote: '',
  lastOpenedAt: '',
  metadataFetchedAt: timestamp,
  metadataStatus: 'success',
  metadataError: '',
  metadataSource: 'android-direct',
};
const member = {
  ...base('family-meena'),
  name: 'Meena',
  relationship: 'Mother',
  dateOfBirth: '1964-05-12',
  gender: 'Female',
  phone: '+91 90000 00000',
  notes: 'Sample record',
  photoRef: '',
  bloodGroup: 'O+',
  rasiId: 'rishabam',
  nakshatraId: 'rohini',
  gothram: '',
  important: true,
  archived: false,
};

const tables = {
  content_categories: [category],
  content_tags: [tag],
  content_recipients: [recipient],
  saved_content: [
    {
      ...base('content-youtube'),
      ...savedContentBase,
      url: 'https://youtu.be/dQw4w9WgXcQ?t=43',
      normalizedUrl: 'https://youtu.be/dqw4w9wgxcq?t=43',
      resolvedUrl: 'https://youtu.be/dQw4w9WgXcQ?t=43',
      mediaId: 'dQw4w9WgXcQ',
      startTimeSeconds: 43,
      domain: 'youtu.be',
      contentType: 'youtube',
      platform: 'YouTube',
      ogTitle: 'Sample YouTube video',
      ogDescription: 'A sample video record for restore verification.',
      ogImageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      websiteName: 'YouTube',
    },
    {
      ...base('content-article'),
      ...savedContentBase,
      url: 'https://angular.dev/',
      normalizedUrl: 'https://angular.dev/',
      resolvedUrl: 'https://angular.dev/',
      mediaId: '',
      startTimeSeconds: 0,
      domain: 'angular.dev',
      contentType: 'article',
      platform: 'angular.dev',
      title: 'Angular documentation',
      ogTitle: 'Angular',
      description: 'Reference saved as a post/link.',
      ogDescription: 'The web development framework for modern apps.',
      ogImageUrl: '',
      websiteName: 'Angular',
    },
  ],
  family_members: [member],
  hospital_op_records: [
    {
      ...base('hospital-sample'),
      hospitalName: 'City Hospital',
      branch: 'Central',
      contacts: ['+91 80000 00000'],
      patientName: 'Meena',
      familyMemberId: member.id,
      opNumber: '',
      department: 'General Medicine',
      doctorName: '',
      lastVisitDate: '2026-07-20',
      website: '',
      notes: 'OP number intentionally not provided.',
      important: true,
      archived: false,
    },
  ],
  medical_insurance: [
    {
      ...base('insurance-sample'),
      providerName: 'Sample Health Insurance',
      policyName: 'Family Health',
      policyNumber: 'PX-DEMO-001',
      tpaName: 'Sample TPA',
      contacts: ['1800 000 000'],
      emails: [],
      website: '',
      coveredFamilyMemberIds: [member.id],
      startDate: '2026-01-01',
      expiryDate: '2026-12-31',
      notes: 'Demo only',
      important: true,
      attachmentIds: [],
      archived: false,
    },
  ],
  important_items: [
    {
      ...base('medicine-sample'),
      name: 'Paracetamol',
      itemType: 'medicine',
      usedFor: 'Reference only—use according to professional advice',
      familyMemberId: member.id,
      brand: '',
      form: 'Tablet',
      strength: '',
      usageInstructions: '',
      doctorOrHospital: '',
      notes: 'Sample restore record',
      favourite: true,
      archived: false,
    },
  ],
  blood_group_records: [
    {
      ...base('blood-sample'),
      personName: 'Meena',
      familyMemberId: member.id,
      bloodGroup: 'O+',
      customBloodGroup: '',
      notes: 'Sample restore record',
      lastVerifiedDate: '2026-07-01',
      source: 'User provided',
      archived: false,
    },
  ],
  vehicles: [
    {
      ...base('vehicle-sample'),
      nickname: 'Family car',
      registrationNumber: 'TN 01 AB 1234',
      normalizedRegistration: 'TN01AB1234',
      make: 'Sample Motors',
      model: 'Demo',
      variant: '',
      vehicleType: 'car',
      owner: '',
      familyMemberId: member.id,
      registrationDate: '2024-01-01',
      insuranceProvider: 'Sample Insurance',
      insuranceExpiry: '2026-12-31',
      pollutionExpiry: '2027-01-31',
      notes: 'Sample restore record',
      favourite: true,
      archived: false,
    },
  ],
  notes: [
    {
      ...base('note-sample'),
      text: 'This note confirms that encrypted backup restore worked.',
      pinned: true,
      favourite: false,
      category: '',
      tagIds: [],
      reminderAt: '',
      attachmentIds: [],
      deleted: false,
      archived: false,
    },
  ],
  note_tags: [],
  checklists: [
    {
      ...base('checklist-sample'),
      title: 'Restore verification',
      description: 'Sample checklist from the encrypted backup',
      archived: false,
    },
  ],
  checklist_items: [
    {
      ...base('checklist-item-sample'),
      checklistId: 'checklist-sample',
      text: 'Confirm restored records are visible',
      completed: false,
      sortOrder: 0,
      dueDate: '',
      note: '',
      completedAt: '',
    },
  ],
  app_settings: [
    {
      ...base('personix-settings'),
      theme: 'automatic',
      showAdultContent: false,
      androidMetadataEnabled: true,
      browserMetadataEnabled: false,
      browserMetadataServiceUrl: 'https://api.microlink.io/',
      autoRefreshMetadata: false,
      downloadOgImages: false,
      metadataTimeoutMs: 10000,
      maxMetadataImageBytes: 3000000,
      defaultCategoryId: '',
      defaultContentType: 'website',
      pin: null,
      biometricEnabled: false,
      autoLockMinutes: 5,
      lockInBackground: true,
      notePageSize: 40,
      showArchivedNotes: false,
      hideCompletedChecklistItems: false,
      confirmClearCompleted: true,
      rasiDisplay: 'both',
      nakshatraDisplay: 'both',
      birthdayReminders: false,
      includeImagesInBackup: true,
      includeAttachmentsInBackup: true,
      backupReminder: false,
    },
  ],
};

const payload = {
  schemaVersion: 1,
  recordCounts: Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.length]),
  ),
  tables,
};
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const iterations = 310_000;
const material = await webcrypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveKey'],
);
const key = await webcrypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
  material,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt'],
);
const encrypted = await webcrypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(JSON.stringify(payload)),
);
const envelope = {
  format: 'personix-backup',
  version: 1,
  createdAt: timestamp,
  appVersion: '1.0.0',
  salt: Buffer.from(salt).toString('base64'),
  iterations,
  iv: Buffer.from(iv).toString('base64'),
  ciphertext: Buffer.from(encrypted).toString('base64'),
};

const decrypted = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
const verified = JSON.parse(new TextDecoder().decode(decrypted));
if (verified.schemaVersion !== 1 || verified.tables.saved_content.length !== 2)
  throw new Error('Generated backup failed verification.');

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(projectRoot, 'sample-data', 'personix-sample.pxbackup');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
console.log(`Created and verified ${destination}`);
console.log(
  `Password: ${password}; records: ${Object.values(payload.recordCounts).reduce((sum, count) => sum + count, 0)}`,
);
