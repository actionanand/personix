export type ThemePreference = 'light' | 'dark' | 'automatic';
export type NameDisplayPreference = 'english' | 'tamil' | 'both';
export type MetadataStatus = 'idle' | 'fetching' | 'success' | 'failed' | 'disabled';
export type ContentType =
  | 'youtube'
  | 'youtube-short'
  | 'instagram'
  | 'instagram-post'
  | 'facebook'
  | 'facebook-reel'
  | 'facebook-share'
  | 'facebook-post'
  | 'twitter-post'
  | 'reddit-post'
  | 'threads-post'
  | 'bluesky-post'
  | 'mastodon-post'
  | 'linkedin-post'
  | 'google-maps'
  | 'tiktok'
  | 'tiktok-share'
  | 'dailymotion'
  | 'vimeo'
  | 'peertube'
  | 'twitch'
  | 'wistia'
  | 'generic-video'
  | 'shopping'
  | 'post'
  | 'article'
  | 'website'
  | 'other-link';

export type ContentSort =
  'recent' | 'oldest' | 'recently-opened' | 'title' | 'platform' | 'category' | 'waiting-to-send';

export interface BaseRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ArchivableRecord extends BaseRecord {
  readonly archived: boolean;
}

export interface ContentCategory extends ArchivableRecord {
  readonly name: string;
  readonly colour: string;
  readonly icon: string;
  readonly isAdult: boolean;
}

export interface ContentTag extends ArchivableRecord {
  readonly name: string;
}

export interface ContentRecipient extends BaseRecord {
  readonly name: string;
  readonly lastUsedAt: string;
}

export interface SavedContent extends BaseRecord {
  readonly url: string;
  readonly normalizedUrl: string;
  readonly resolvedUrl?: string;
  readonly mediaId?: string;
  readonly startTimeSeconds?: number;
  readonly aspectRatio?: number;
  readonly domain: string;
  readonly contentType: ContentType;
  readonly platform: string;
  readonly title: string;
  readonly ogTitle: string;
  readonly description: string;
  readonly ogDescription: string;
  readonly ogImageUrl: string;
  readonly downloadedOgImageRef: string;
  readonly customThumbnail: string;
  readonly websiteName: string;
  readonly favicon: string;
  readonly notes: string;
  readonly categoryId: string;
  readonly tagIds: readonly string[];
  readonly recipientIds: readonly string[];
  readonly favourite: boolean;
  readonly adult: boolean;
  readonly consumed: boolean;
  readonly sent: boolean;
  readonly sentAt: string;
  readonly sentNote: string;
  readonly lastOpenedAt: string;
  readonly metadataFetchedAt: string;
  readonly metadataStatus: MetadataStatus;
  readonly metadataError: string;
  readonly metadataSource: 'none' | 'android-direct' | 'browser-third-party';
}

export interface ContentFilters {
  readonly section: 'videos' | 'posts';
  readonly query: string;
  readonly contentType: ContentType | '';
  readonly platform: string;
  readonly categoryId: string;
  readonly tagId: string;
  readonly recipientId: string;
  readonly sent: 'all' | 'sent' | 'unsent';
  readonly favouriteOnly: boolean;
  readonly consumed: 'all' | 'consumed' | 'unconsumed';
  readonly adultOnly: boolean;
  readonly excludeAdult: boolean;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly sort: ContentSort;
}

export interface AstrologyName {
  readonly id: string;
  readonly english: string;
  readonly tamil: string;
}

export interface RasiName extends AstrologyName {
  readonly western: string;
}

export interface FamilyMember extends ArchivableRecord {
  readonly name: string;
  readonly relationship: string;
  readonly dateOfBirth: string;
  readonly gender: string;
  readonly phone: string;
  readonly notes: string;
  readonly photoRef: string;
  readonly bloodGroup: string;
  readonly rasiId: string;
  readonly nakshatraId: string;
  readonly gothram: string;
  readonly important: boolean;
}

export interface HospitalOpRecord extends ArchivableRecord {
  readonly hospitalName: string;
  readonly branch: string;
  readonly contacts: readonly string[];
  readonly patientName: string;
  readonly familyMemberId: string;
  readonly opNumber: string;
  readonly department: string;
  readonly doctorName: string;
  readonly lastVisitDate: string;
  readonly website: string;
  readonly notes: string;
  readonly important: boolean;
}

export interface MedicalInsurance extends ArchivableRecord {
  readonly providerName: string;
  readonly policyName: string;
  readonly policyNumber: string;
  readonly tpaName: string;
  readonly contacts: readonly string[];
  readonly emails: readonly string[];
  readonly website: string;
  readonly coveredFamilyMemberIds: readonly string[];
  readonly startDate: string;
  readonly expiryDate: string;
  readonly notes: string;
  readonly important: boolean;
  readonly attachmentIds: readonly string[];
}

export type ImportantItemType = 'medicine' | 'toiletry';

export interface ImportantItem extends ArchivableRecord {
  readonly name: string;
  readonly itemType: ImportantItemType;
  readonly usedFor: string;
  readonly familyMemberId: string;
  readonly brand: string;
  readonly form: string;
  readonly strength: string;
  readonly usageInstructions: string;
  readonly doctorOrHospital: string;
  readonly notes: string;
  readonly favourite: boolean;
}

export interface BloodGroupRecord extends ArchivableRecord {
  readonly personName: string;
  readonly familyMemberId: string;
  readonly bloodGroup: string;
  readonly customBloodGroup: string;
  readonly notes: string;
  readonly lastVerifiedDate: string;
  readonly source: string;
}

export type VehicleType = 'car' | 'motorcycle' | 'scooter' | 'bicycle' | 'commercial' | 'other';

export interface Vehicle extends ArchivableRecord {
  readonly nickname: string;
  readonly registrationNumber: string;
  readonly normalizedRegistration: string;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
  readonly vehicleType: VehicleType;
  readonly owner: string;
  readonly familyMemberId: string;
  readonly registrationDate: string;
  readonly insuranceProvider: string;
  readonly insuranceExpiry: string;
  readonly pollutionExpiry: string;
  readonly notes: string;
  readonly favourite: boolean;
}

export interface Note extends ArchivableRecord {
  readonly text: string;
  readonly pinned: boolean;
  readonly favourite: boolean;
  readonly category: string;
  readonly tagIds: readonly string[];
  readonly reminderAt: string;
  readonly attachmentIds: readonly string[];
  readonly deleted: boolean;
}

export interface NoteTag extends ArchivableRecord {
  readonly name: string;
}

export interface Checklist extends ArchivableRecord {
  readonly title: string;
  readonly description: string;
}

export interface ChecklistItem extends BaseRecord {
  readonly checklistId: string;
  readonly text: string;
  readonly completed: boolean;
  readonly sortOrder: number;
  readonly dueDate: string;
  readonly note: string;
  readonly completedAt: string;
}

export interface Attachment extends BaseRecord {
  readonly ownerType: string;
  readonly ownerId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly fileRef: string;
  readonly byteLength: number;
}

export interface PinParameters {
  readonly algorithm: 'PBKDF2-SHA-256';
  readonly version: 1;
  readonly iterations: number;
  readonly salt: string;
  readonly verifier: string;
}

export interface AppSettings extends BaseRecord {
  readonly theme: ThemePreference;
  readonly openPostsInApp: boolean;
  readonly muteVideosByDefault: boolean;
  readonly showAdultContent: boolean;
  readonly androidMetadataEnabled: boolean;
  readonly browserMetadataEnabled: boolean;
  readonly browserMetadataServiceUrl: string;
  readonly autoRefreshMetadata: boolean;
  readonly downloadOgImages: boolean;
  readonly metadataTimeoutMs: number;
  readonly maxMetadataImageBytes: number;
  readonly defaultCategoryId: string;
  readonly defaultContentType: ContentType;
  readonly pin: PinParameters | null;
  readonly biometricEnabled: boolean;
  readonly autoLockMinutes: number;
  readonly lockInBackground: boolean;
  readonly notePageSize: number;
  readonly showArchivedNotes: boolean;
  readonly hideCompletedChecklistItems: boolean;
  readonly confirmClearCompleted: boolean;
  readonly rasiDisplay: NameDisplayPreference;
  readonly nakshatraDisplay: NameDisplayPreference;
  readonly birthdayReminders: boolean;
  readonly includeImagesInBackup: boolean;
  readonly includeAttachmentsInBackup: boolean;
  readonly backupReminder: boolean;
}

export interface PageCursor {
  readonly createdAt: string;
  readonly id: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: PageCursor | null;
}

export interface SearchGroup<T extends BaseRecord> {
  readonly label: string;
  readonly route: string;
  readonly items: readonly T[];
}

export type DatabaseTable =
  | 'saved_content'
  | 'content_categories'
  | 'content_tags'
  | 'content_recipients'
  | 'family_members'
  | 'hospital_op_records'
  | 'medical_insurance'
  | 'important_items'
  | 'blood_group_records'
  | 'vehicles'
  | 'notes'
  | 'note_tags'
  | 'checklists'
  | 'checklist_items'
  | 'attachments'
  | 'app_settings'
  | 'schema_migrations';

export interface TableRecordMap {
  readonly saved_content: SavedContent;
  readonly content_categories: ContentCategory;
  readonly content_tags: ContentTag;
  readonly content_recipients: ContentRecipient;
  readonly family_members: FamilyMember;
  readonly hospital_op_records: HospitalOpRecord;
  readonly medical_insurance: MedicalInsurance;
  readonly important_items: ImportantItem;
  readonly blood_group_records: BloodGroupRecord;
  readonly vehicles: Vehicle;
  readonly notes: Note;
  readonly note_tags: NoteTag;
  readonly checklists: Checklist;
  readonly checklist_items: ChecklistItem;
  readonly attachments: Attachment;
  readonly app_settings: AppSettings;
  readonly schema_migrations: SchemaMigration;
}

export interface SchemaMigration extends BaseRecord {
  readonly version: number;
  readonly name: string;
}

export type BackupModule =
  'content' | 'family-health' | 'vehicles' | 'notes' | 'checklists' | 'settings';

export interface BackupEnvelope {
  readonly format: 'personix-backup';
  readonly version: 1;
  readonly createdAt: string;
  readonly appVersion: string;
  readonly salt: string;
  readonly iterations: number;
  readonly iv: string;
  readonly ciphertext: string;
}

export interface BackupPayload {
  readonly schemaVersion: number;
  readonly recordCounts: Readonly<Record<string, number>>;
  readonly tables: Partial<
    Readonly<Record<DatabaseTable, readonly TableRecordMap[DatabaseTable][]>>
  >;
}

export const CONTENT_TYPES: readonly { readonly value: ContentType; readonly label: string }[] = [
  { value: 'youtube', label: 'YouTube video' },
  { value: 'youtube-short', label: 'YouTube Short' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'instagram-post', label: 'Instagram post' },
  { value: 'facebook', label: 'Facebook video' },
  { value: 'facebook-reel', label: 'Facebook Reel' },
  { value: 'facebook-share', label: 'Facebook shared video' },
  { value: 'facebook-post', label: 'Facebook post' },
  { value: 'twitter-post', label: 'X / Twitter post' },
  { value: 'reddit-post', label: 'Reddit post' },
  { value: 'threads-post', label: 'Threads post' },
  { value: 'bluesky-post', label: 'Bluesky post' },
  { value: 'mastodon-post', label: 'Mastodon post' },
  { value: 'linkedin-post', label: 'LinkedIn post' },
  { value: 'google-maps', label: 'Google Maps place' },
  { value: 'tiktok', label: 'TikTok video' },
  { value: 'tiktok-share', label: 'TikTok shared video' },
  { value: 'dailymotion', label: 'Dailymotion' },
  { value: 'vimeo', label: 'Vimeo' },
  { value: 'peertube', label: 'PeerTube' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'wistia', label: 'Wistia' },
  { value: 'generic-video', label: 'Generic video' },
  { value: 'shopping', label: 'Shopping / Product' },
  { value: 'post', label: 'Post' },
  { value: 'article', label: 'Article' },
  { value: 'website', label: 'Website' },
  { value: 'other-link', label: 'Other link' },
];

export const VIDEO_CONTENT_TYPES: readonly ContentType[] = [
  'youtube',
  'youtube-short',
  'instagram',
  'facebook',
  'facebook-reel',
  'facebook-share',
  'tiktok',
  'tiktok-share',
  'dailymotion',
  'vimeo',
  'peertube',
  'twitch',
  'wistia',
  'generic-video',
];

export function isVideoContentType(type: ContentType): boolean {
  return VIDEO_CONTENT_TYPES.includes(type);
}

export const BLOOD_GROUPS = [
  'A+',
  'A-',
  'A1+',
  'A1-',
  'A1B+',
  'A1B-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
  'Bombay phenotype',
  'Unknown',
  'Custom',
] as const;

export const RASI_OPTIONS: readonly RasiName[] = [
  { id: 'mesham', english: 'Mesha', western: 'Aries', tamil: 'மேஷம்' },
  { id: 'rishabam', english: 'Vrishabha', western: 'Taurus', tamil: 'ரிஷபம்' },
  { id: 'mithunam', english: 'Mithuna', western: 'Gemini', tamil: 'மிதுனம்' },
  { id: 'kadagam', english: 'Karka', western: 'Cancer', tamil: 'கடகம்' },
  { id: 'simmam', english: 'Simha', western: 'Leo', tamil: 'சிம்மம்' },
  { id: 'kanni', english: 'Kanya', western: 'Virgo', tamil: 'கன்னி' },
  { id: 'thulam', english: 'Tula', western: 'Libra', tamil: 'துலாம்' },
  { id: 'viruchigam', english: 'Vrishchika', western: 'Scorpio', tamil: 'விருச்சிகம்' },
  { id: 'dhanusu', english: 'Dhanu', western: 'Sagittarius', tamil: 'தனுசு' },
  { id: 'magaram', english: 'Makara', western: 'Capricorn', tamil: 'மகரம்' },
  { id: 'kumbam', english: 'Kumbha', western: 'Aquarius', tamil: 'கும்பம்' },
  { id: 'meenam', english: 'Meena', western: 'Pisces', tamil: 'மீனம்' },
];

export const NAKSHATRA_OPTIONS: readonly AstrologyName[] = [
  ['aswini', 'Ashwini', 'அஸ்வினி'],
  ['bharani', 'Bharani', 'பரணி'],
  ['karthigai', 'Krittika', 'கார்த்திகை'],
  ['rohini', 'Rohini', 'ரோகிணி'],
  ['mirugasirisham', 'Mrigashirsha', 'மிருகசீரிடம்'],
  ['thiruvathirai', 'Ardra', 'திருவாதிரை'],
  ['punarpoosam', 'Punarvasu', 'புனர்பூசம்'],
  ['poosam', 'Pushya', 'பூசம்'],
  ['ayilyam', 'Ashlesha', 'ஆயில்யம்'],
  ['magam', 'Magha', 'மகம்'],
  ['pooram', 'Purva Phalguni', 'பூரம்'],
  ['uthiram', 'Uttara Phalguni', 'உத்திரம்'],
  ['hastham', 'Hasta', 'ஹஸ்தம்'],
  ['chithirai', 'Chitra', 'சித்திரை'],
  ['swathi', 'Swati', 'சுவாதி'],
  ['visakam', 'Vishakha', 'விசாகம்'],
  ['anusham', 'Anuradha', 'அனுஷம்'],
  ['kettai', 'Jyeshtha', 'கேட்டை'],
  ['moolam', 'Mula', 'மூலம்'],
  ['pooradam', 'Purva Ashadha', 'பூராடம்'],
  ['uthiradam', 'Uttara Ashadha', 'உத்திராடம்'],
  ['thiruvonam', 'Shravana', 'திருவோணம்'],
  ['avittam', 'Dhanishta', 'அவிட்டம்'],
  ['sathayam', 'Shatabhisha', 'சதயம்'],
  ['poorattathi', 'Purva Bhadrapada', 'பூரட்டாதி'],
  ['uthirattathi', 'Uttara Bhadrapada', 'உத்திரட்டாதி'],
  ['revathi', 'Revati', 'ரேவதி'],
].map(([id, english, tamil]) => ({ id, english, tamil }));

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

export function normalizeVehicleRegistration(value: string): string {
  return value.toLocaleUpperCase().replace(/[^A-Z0-9]/g, '');
}
