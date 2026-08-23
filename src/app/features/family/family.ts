import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import type { FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  BLOOD_GROUPS,
  BloodGroupRecord,
  EmploymentHistoryRecord,
  EmploymentMode,
  EmploymentType,
  FamilyMember,
  HospitalOpRecord,
  ImportantItem,
  MedicalInsurance,
  NAKSHATRA_OPTIONS,
  RASI_OPTIONS,
  ResidenceHistoryRecord,
} from '../../core/models/app.models';
import { FamilyRepository } from '../../core/repositories/family.repository';
import { DialogService } from '../../core/services/dialog.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { AppIcon } from '../../shared/components/app-icon';
import { SelectPicker, SelectPickerOption } from '../../shared/components/select-picker';
import { TokenInput } from '../../shared/components/token-input';
import { PartialDatePipe } from '../../shared/pipes/partial-date.pipe';
import { buildPartialDate, partialDateSortKey } from '../../shared/utils/partial-date';
import { commaSeparatedEmailsValidator } from '../../shared/validators/comma-separated-emails.validator';
import {
  commaSeparatedContactNumbersValidator,
  contactNumberValidator,
} from '../../shared/validators/contact-number.validator';

type FamilyTab = 'members' | 'hospital' | 'insurance' | 'items' | 'blood' | 'timeline';
type TimelineKind = 'residence' | 'employment';
type FamilyEditorRecord =
  | { readonly tab: 'members'; readonly value: FamilyMember }
  | { readonly tab: 'hospital'; readonly value: HospitalOpRecord }
  | { readonly tab: 'insurance'; readonly value: MedicalInsurance }
  | { readonly tab: 'items'; readonly value: ImportantItem }
  | { readonly tab: 'blood'; readonly value: BloodGroupRecord }
  | { readonly tab: 'timeline'; readonly kind: 'residence'; readonly value: ResidenceHistoryRecord }
  | {
      readonly tab: 'timeline';
      readonly kind: 'employment';
      readonly value: EmploymentHistoryRecord;
    };

interface TimelineDateFormValue {
  readonly startYear: string;
  readonly startMonth: string;
  readonly startDay: string;
  readonly endYear: string;
  readonly endMonth: string;
  readonly endDay: string;
}

function partialDateRangeValidator(control: AbstractControl): ValidationErrors | null {
  const startDate = buildPartialDate({
    year: String(control.get('startYear')?.value ?? ''),
    month: String(control.get('startMonth')?.value ?? ''),
    day: String(control.get('startDay')?.value ?? ''),
  });
  const current = control.get('current')?.value === true;
  const endDate = buildPartialDate({
    year: String(control.get('endYear')?.value ?? ''),
    month: String(control.get('endMonth')?.value ?? ''),
    day: String(control.get('endDay')?.value ?? ''),
  });
  if (!startDate) return { invalidStartDate: true };
  if (current) return null;
  if (!endDate) return { invalidEndDate: true };
  return partialDateSortKey(endDate, true) < partialDateSortKey(startDate)
    ? { dateOrder: true }
    : null;
}

@Component({
  selector: 'app-family',
  imports: [DatePipe, ReactiveFormsModule, AppIcon, SelectPicker, TokenInput, PartialDatePipe],
  templateUrl: './family.html',
  styleUrl: './family.scss',
})
export class Family {
  private readonly repository = inject(FamilyRepository);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(FeedbackService);
  private readonly route = inject(ActivatedRoute);

  protected readonly tabs: readonly {
    readonly id: FamilyTab;
    readonly label: string;
    readonly icon: string;
  }[] = [
    { id: 'members', label: 'Family Members', icon: 'family' },
    { id: 'hospital', label: 'Hospital OP', icon: 'hospital' },
    { id: 'insurance', label: 'Insurance', icon: 'insurance' },
    { id: 'items', label: 'Medicines & Toiletries', icon: 'medicine' },
    { id: 'blood', label: 'Blood Groups', icon: 'blood' },
    { id: 'timeline', label: 'Life Timeline', icon: 'residence' },
  ];
  protected readonly rasis = RASI_OPTIONS;
  protected readonly nakshatras = NAKSHATRA_OPTIONS;
  protected readonly bloodGroups = BLOOD_GROUPS;
  protected readonly optionalBloodGroupOptions: readonly SelectPickerOption[] = [
    { value: '', label: 'Not recorded' },
    ...BLOOD_GROUPS.map((group) => ({ value: group, label: group })),
  ];
  protected readonly bloodGroupOptions: readonly SelectPickerOption[] = BLOOD_GROUPS.map(
    (group) => ({ value: group, label: group }),
  );
  protected readonly rasiOptions: readonly SelectPickerOption[] = [
    { value: '', label: 'Not recorded' },
    ...RASI_OPTIONS.map((item) => ({
      value: item.id,
      label: `${item.english} (${item.western}) - ${item.tamil}`,
    })),
  ];
  protected readonly nakshatraOptions: readonly SelectPickerOption[] = [
    { value: '', label: 'Not recorded' },
    ...NAKSHATRA_OPTIONS.map((item) => ({
      value: item.id,
      label: `${item.english} - ${item.tamil}`,
    })),
  ];
  protected readonly itemTypeOptions: readonly SelectPickerOption[] = [
    { value: 'medicine', label: 'Medicine' },
    { value: 'toiletry', label: 'Toiletry' },
  ];
  protected readonly monthOptions: readonly SelectPickerOption[] = [
    { value: '', label: 'Month (optional)' },
    ...['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
      (label, index) => ({ value: String(index + 1).padStart(2, '0'), label }),
    ),
  ];
  protected readonly employmentTypeOptions: readonly SelectPickerOption[] = [
    { value: 'full-time', label: 'Full time' },
    { value: 'part-time', label: 'Part time' },
    { value: 'freelance', label: 'Freelancer' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
    { value: 'self-employed', label: 'Self-employed' },
    { value: 'other', label: 'Other' },
  ];
  protected readonly employmentModeOptions: readonly SelectPickerOption[] = [
    { value: 'office', label: 'Work from office' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'wfh', label: 'Work from home' },
    { value: 'remote', label: 'Remote' },
    { value: 'field', label: 'Field work' },
    { value: 'other', label: 'Other' },
  ];
  protected readonly memberOptions = computed<readonly SelectPickerOption[]>(() => [
    { value: '', label: 'Not linked' },
    ...this.members().map((member) => ({ value: member.id, label: member.name })),
  ]);
  protected readonly optionalMemberOptions = computed<readonly SelectPickerOption[]>(() => [
    { value: '', label: 'Anyone / not linked' },
    ...this.members().map((member) => ({ value: member.id, label: member.name })),
  ]);
  protected readonly activeTab = signal<FamilyTab>('members');
  protected readonly panelOpen = signal(false);
  protected readonly editingRecord = signal<FamilyEditorRecord | null>(null);
  protected readonly viewingRecord = signal<FamilyEditorRecord | null>(null);
  protected readonly viewingMember = computed(() => {
    const record = this.viewingRecord();
    return record?.tab === 'members' ? record.value : null;
  });
  protected readonly viewingHospital = computed(() => {
    const record = this.viewingRecord();
    return record?.tab === 'hospital' ? record.value : null;
  });
  protected readonly viewingInsurance = computed(() => {
    const record = this.viewingRecord();
    return record?.tab === 'insurance' ? record.value : null;
  });
  protected readonly viewingItem = computed(() => {
    const record = this.viewingRecord();
    return record?.tab === 'items' ? record.value : null;
  });
  protected readonly viewingBloodGroup = computed(() => {
    const record = this.viewingRecord();
    return record?.tab === 'blood' ? record.value : null;
  });
  protected readonly viewingResidence = computed(() => {
    const record = this.viewingRecord();
    return record?.tab === 'timeline' && record.kind === 'residence' ? record.value : null;
  });
  protected readonly viewingEmployment = computed(() => {
    const record = this.viewingRecord();
    return record?.tab === 'timeline' && record.kind === 'employment' ? record.value : null;
  });
  protected readonly saving = signal(false);
  protected readonly query = this.formBuilder.nonNullable.control('');
  protected readonly members = signal<readonly FamilyMember[]>([]);
  protected readonly hospitals = signal<readonly HospitalOpRecord[]>([]);
  protected readonly insurance = signal<readonly MedicalInsurance[]>([]);
  protected readonly items = signal<readonly ImportantItem[]>([]);
  protected readonly bloodRecords = signal<readonly BloodGroupRecord[]>([]);
  protected readonly residences = signal<readonly ResidenceHistoryRecord[]>([]);
  protected readonly employmentRecords = signal<readonly EmploymentHistoryRecord[]>([]);
  protected readonly timelineViewKind = signal<TimelineKind>('residence');
  protected readonly timelineKind = signal<TimelineKind>('residence');
  protected readonly residenceTimeline = computed(() =>
    this.sortTimelineRecords(this.residences()),
  );
  protected readonly employmentTimeline = computed(() =>
    this.sortTimelineRecords(this.employmentRecords()),
  );

  protected readonly memberForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    relationship: ['', Validators.required],
    dateOfBirth: [''],
    gender: [''],
    phone: ['', contactNumberValidator],
    notes: [''],
    bloodGroup: [''],
    rasiId: [''],
    nakshatraId: [''],
    gothram: [''],
    important: [false],
  });
  protected readonly hospitalForm = this.formBuilder.nonNullable.group({
    hospitalName: ['', Validators.required],
    branch: [''],
    contacts: ['', [Validators.required, commaSeparatedContactNumbersValidator]],
    patientName: ['', Validators.required],
    familyMemberId: [''],
    opNumber: [''],
    department: [''],
    doctorName: [''],
    lastVisitDate: [''],
    website: [''],
    notes: [''],
    important: [false],
  });
  protected readonly insuranceForm = this.formBuilder.nonNullable.group({
    providerName: ['', Validators.required],
    policyName: [''],
    policyNumber: [''],
    tpaName: [''],
    contacts: ['', commaSeparatedContactNumbersValidator],
    emails: ['', commaSeparatedEmailsValidator],
    website: [''],
    coveredFamilyMemberIds: [[] as string[]],
    startDate: [''],
    expiryDate: [''],
    notes: [''],
    important: [false],
  });
  protected readonly itemForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    itemType: ['medicine' as ImportantItem['itemType'], Validators.required],
    usedFor: ['', Validators.required],
    familyMemberId: [''],
    brand: [''],
    form: [''],
    strength: [''],
    usageInstructions: [''],
    doctorOrHospital: [''],
    notes: [''],
    favourite: [false],
  });
  protected readonly bloodForm = this.formBuilder.nonNullable.group({
    personName: ['', Validators.required],
    familyMemberId: [''],
    bloodGroup: ['Unknown', Validators.required],
    customBloodGroup: [''],
    notes: [''],
    lastVerifiedDate: [''],
    source: [''],
  });
  protected readonly residenceForm = this.formBuilder.nonNullable.group(
    {
      location: ['', Validators.required],
      fullAddress: [''],
      contactNumber: ['', contactNumberValidator],
      startYear: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      startMonth: [''],
      startDay: [''],
      endYear: ['', Validators.pattern(/^\d{4}$/)],
      endMonth: [''],
      endDay: [''],
      current: [false],
      notes: [''],
    },
    { validators: partialDateRangeValidator },
  );
  protected readonly employmentForm = this.formBuilder.nonNullable.group(
    {
      companyName: ['', Validators.required],
      jobTitle: [''],
      place: ['', Validators.required],
      employmentType: ['full-time' as EmploymentType, Validators.required],
      employmentMode: ['office' as EmploymentMode, Validators.required],
      startYear: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      startMonth: [''],
      startDay: [''],
      endYear: ['', Validators.pattern(/^\d{4}$/)],
      endMonth: [''],
      endDay: [''],
      current: [false],
      notes: [''],
    },
    { validators: partialDateRangeValidator },
  );

  constructor() {
    void this.load();
    const add = this.route.snapshot.queryParamMap.get('add');
    if (add) {
      this.activeTab.set(add === 'medical' ? 'hospital' : 'members');
      window.setTimeout(() => this.openAdd(), 0);
    }
  }

  protected selectTab(tab: FamilyTab): void {
    this.activeTab.set(tab);
    this.editingRecord.set(null);
    this.viewingRecord.set(null);
    this.panelOpen.set(false);
    this.query.reset();
    void this.load();
  }
  protected async load(): Promise<void> {
    const query = this.query.value;
    const [members, hospitals, insurance, items, blood, residences, employment] = await Promise.all(
      [
        this.repository.members(query),
        this.repository.hospitalRecords(query),
        this.repository.insurance(query),
        this.repository.importantItems(undefined, query),
        this.repository.bloodGroups(query),
        this.repository.residences(query),
        this.repository.employment(query),
      ],
    );
    this.members.set(members);
    this.hospitals.set(hospitals);
    this.insurance.set(insurance);
    this.items.set(items);
    this.bloodRecords.set(blood);
    this.residences.set(residences);
    this.employmentRecords.set(employment);
  }
  protected openAdd(): void {
    this.editingRecord.set(null);
    if (this.activeTab() === 'timeline') this.timelineKind.set(this.timelineViewKind());
    this.resetActiveForm();
    this.panelOpen.set(true);
  }
  protected close(): void {
    this.panelOpen.set(false);
    this.editingRecord.set(null);
  }
  protected editMember(member: FamilyMember): void {
    this.activeTab.set('members');
    this.viewingRecord.set(null);
    this.editingRecord.set({ tab: 'members', value: member });
    this.memberForm.reset({
      name: member.name,
      relationship: member.relationship,
      dateOfBirth: member.dateOfBirth,
      gender: member.gender,
      phone: member.phone,
      notes: member.notes,
      bloodGroup: member.bloodGroup,
      rasiId: member.rasiId,
      nakshatraId: member.nakshatraId,
      gothram: member.gothram,
      important: member.important,
    });
    this.panelOpen.set(true);
  }
  protected viewMember(member: FamilyMember): void {
    this.viewingRecord.set({ tab: 'members', value: member });
  }
  protected closeRecordDetails(): void {
    this.viewingRecord.set(null);
  }
  protected editHospital(record: HospitalOpRecord): void {
    this.activeTab.set('hospital');
    this.viewingRecord.set(null);
    this.editingRecord.set({ tab: 'hospital', value: record });
    this.hospitalForm.reset({
      hospitalName: record.hospitalName,
      branch: record.branch,
      contacts: record.contacts.join(', '),
      patientName: record.patientName,
      familyMemberId: record.familyMemberId,
      opNumber: record.opNumber,
      department: record.department,
      doctorName: record.doctorName,
      lastVisitDate: record.lastVisitDate,
      website: record.website,
      notes: record.notes,
      important: record.important,
    });
    this.panelOpen.set(true);
  }
  protected viewHospital(record: HospitalOpRecord): void {
    this.viewingRecord.set({ tab: 'hospital', value: record });
  }
  protected editInsurance(record: MedicalInsurance): void {
    this.activeTab.set('insurance');
    this.viewingRecord.set(null);
    this.editingRecord.set({ tab: 'insurance', value: record });
    this.insuranceForm.reset({
      providerName: record.providerName,
      policyName: record.policyName,
      policyNumber: record.policyNumber,
      tpaName: record.tpaName,
      contacts: record.contacts.join(', '),
      emails: record.emails.join(', '),
      website: record.website,
      coveredFamilyMemberIds: [...record.coveredFamilyMemberIds],
      startDate: record.startDate,
      expiryDate: record.expiryDate,
      notes: record.notes,
      important: record.important,
    });
    this.panelOpen.set(true);
  }
  protected viewInsurance(record: MedicalInsurance): void {
    this.viewingRecord.set({ tab: 'insurance', value: record });
  }
  protected editImportantItem(item: ImportantItem): void {
    this.activeTab.set('items');
    this.viewingRecord.set(null);
    this.editingRecord.set({ tab: 'items', value: item });
    this.itemForm.reset({
      name: item.name,
      itemType: item.itemType,
      usedFor: item.usedFor,
      familyMemberId: item.familyMemberId,
      brand: item.brand,
      form: item.form,
      strength: item.strength,
      usageInstructions: item.usageInstructions,
      doctorOrHospital: item.doctorOrHospital,
      notes: item.notes,
      favourite: item.favourite,
    });
    this.panelOpen.set(true);
  }
  protected viewImportantItem(item: ImportantItem): void {
    this.viewingRecord.set({ tab: 'items', value: item });
  }
  protected editBloodGroup(record: BloodGroupRecord): void {
    this.activeTab.set('blood');
    this.viewingRecord.set(null);
    this.editingRecord.set({ tab: 'blood', value: record });
    this.bloodForm.reset({
      personName: record.personName,
      familyMemberId: record.familyMemberId,
      bloodGroup: record.bloodGroup,
      customBloodGroup: record.customBloodGroup,
      notes: record.notes,
      lastVerifiedDate: record.lastVerifiedDate,
      source: record.source,
    });
    this.panelOpen.set(true);
  }
  protected viewBloodGroup(record: BloodGroupRecord): void {
    this.viewingRecord.set({ tab: 'blood', value: record });
  }
  protected async selectTimelineKind(kind: TimelineKind): Promise<void> {
    if (this.editingRecord() || kind === this.timelineKind()) return;
    const currentForm =
      this.timelineKind() === 'residence' ? this.residenceForm : this.employmentForm;
    if (currentForm.dirty) {
      const result = await this.dialogs.open({
        title: 'Discard unsaved changes?',
        description: `Switching to ${kind} will clear the ${this.timelineKind()} information you entered.`,
        confirmText: 'Discard & switch',
        cancelText: 'Keep editing',
        destructive: true,
        icon: 'alert',
      });
      if (!result.confirmed) return;
    }
    this.timelineKind.set(kind);
    if (kind === 'residence') this.resetResidenceForm();
    else this.resetEmploymentForm();
  }
  protected selectTimelineView(kind: TimelineKind): void {
    this.timelineViewKind.set(kind);
  }
  protected editResidence(record: ResidenceHistoryRecord): void {
    this.activeTab.set('timeline');
    this.timelineKind.set('residence');
    this.viewingRecord.set(null);
    this.editingRecord.set({ tab: 'timeline', kind: 'residence', value: record });
    const start = this.partialDateParts(record.startDate);
    const end = this.partialDateParts(record.endDate);
    this.residenceForm.reset({
      location: record.location,
      fullAddress: record.fullAddress,
      contactNumber: record.contactNumber,
      startYear: start.year,
      startMonth: start.month,
      startDay: start.day,
      endYear: end.year,
      endMonth: end.month,
      endDay: end.day,
      current: record.current,
      notes: record.notes,
    });
    this.panelOpen.set(true);
  }
  protected viewResidence(record: ResidenceHistoryRecord): void {
    this.viewingRecord.set({ tab: 'timeline', kind: 'residence', value: record });
  }
  protected editEmployment(record: EmploymentHistoryRecord): void {
    this.activeTab.set('timeline');
    this.timelineKind.set('employment');
    this.viewingRecord.set(null);
    this.editingRecord.set({ tab: 'timeline', kind: 'employment', value: record });
    const start = this.partialDateParts(record.startDate);
    const end = this.partialDateParts(record.endDate);
    this.employmentForm.reset({
      companyName: record.companyName,
      jobTitle: record.jobTitle,
      place: record.place,
      employmentType: record.employmentType,
      employmentMode: record.employmentMode,
      startYear: start.year,
      startMonth: start.month,
      startDay: start.day,
      endYear: end.year,
      endMonth: end.month,
      endDay: end.day,
      current: record.current,
      notes: record.notes,
    });
    this.panelOpen.set(true);
  }
  protected viewEmployment(record: EmploymentHistoryRecord): void {
    this.viewingRecord.set({ tab: 'timeline', kind: 'employment', value: record });
  }
  protected residenceCurrentChanged(): void {
    if (this.residenceForm.controls.current.value) {
      this.residenceForm.patchValue({ endYear: '', endMonth: '', endDay: '' });
    }
    this.residenceForm.updateValueAndValidity();
  }
  protected employmentCurrentChanged(): void {
    if (this.employmentForm.controls.current.value) {
      this.employmentForm.patchValue({ endYear: '', endMonth: '', endDay: '' });
    }
    this.employmentForm.updateValueAndValidity();
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    const editing = this.editingRecord();
    this.saving.set(true);
    try {
      switch (this.activeTab()) {
        case 'members': {
          if (this.memberForm.invalid) {
            this.memberForm.markAllAsTouched();
            return;
          }
          const value = this.memberForm.getRawValue();
          const existing = editing?.tab === 'members' ? editing.value : null;
          await this.repository.saveMember({
            ...value,
            ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
            photoRef: existing?.photoRef ?? '',
            archived: existing?.archived ?? false,
          });
          break;
        }
        case 'hospital': {
          if (this.hospitalForm.invalid) {
            this.hospitalForm.markAllAsTouched();
            return;
          }
          const value = this.hospitalForm.getRawValue();
          const existing = editing?.tab === 'hospital' ? editing.value : null;
          await this.repository.saveHospital({
            ...value,
            ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
            contacts: this.csv(value.contacts),
            archived: existing?.archived ?? false,
          });
          break;
        }
        case 'insurance': {
          if (this.insuranceForm.invalid) {
            this.insuranceForm.markAllAsTouched();
            return;
          }
          const value = this.insuranceForm.getRawValue();
          const existing = editing?.tab === 'insurance' ? editing.value : null;
          await this.repository.saveInsurance({
            ...value,
            ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
            contacts: this.csv(value.contacts),
            emails: this.csv(value.emails),
            attachmentIds: existing?.attachmentIds ?? [],
            archived: existing?.archived ?? false,
          });
          break;
        }
        case 'items': {
          if (this.itemForm.invalid) {
            this.itemForm.markAllAsTouched();
            return;
          }
          const existing = editing?.tab === 'items' ? editing.value : null;
          await this.repository.saveImportantItem({
            ...this.itemForm.getRawValue(),
            ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
            archived: existing?.archived ?? false,
          });
          break;
        }
        case 'blood': {
          if (this.bloodForm.invalid) {
            this.bloodForm.markAllAsTouched();
            return;
          }
          const existing = editing?.tab === 'blood' ? editing.value : null;
          await this.repository.saveBloodGroup({
            ...this.bloodForm.getRawValue(),
            ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
            archived: existing?.archived ?? false,
          });
          break;
        }
        case 'timeline': {
          if (this.timelineKind() === 'residence') {
            if (this.residenceForm.invalid) {
              this.residenceForm.markAllAsTouched();
              return;
            }
            const value = this.residenceForm.getRawValue();
            const existing =
              editing?.tab === 'timeline' && editing.kind === 'residence' ? editing.value : null;
            await this.repository.saveResidence({
              location: value.location.trim(),
              fullAddress: value.fullAddress.trim(),
              contactNumber: value.contactNumber.trim(),
              startDate: this.formPartialDate(value, 'start'),
              endDate: value.current ? '' : this.formPartialDate(value, 'end'),
              current: value.current,
              notes: value.notes.trim(),
              archived: existing?.archived ?? false,
              ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
            });
          } else {
            if (this.employmentForm.invalid) {
              this.employmentForm.markAllAsTouched();
              return;
            }
            const value = this.employmentForm.getRawValue();
            const existing =
              editing?.tab === 'timeline' && editing.kind === 'employment' ? editing.value : null;
            await this.repository.saveEmployment({
              companyName: value.companyName.trim(),
              jobTitle: value.jobTitle.trim(),
              place: value.place.trim(),
              employmentType: value.employmentType,
              employmentMode: value.employmentMode,
              startDate: this.formPartialDate(value, 'start'),
              endDate: value.current ? '' : this.formPartialDate(value, 'end'),
              current: value.current,
              notes: value.notes.trim(),
              archived: existing?.archived ?? false,
              ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
            });
          }
          break;
        }
      }
      this.panelOpen.set(false);
      this.editingRecord.set(null);
      this.feedback.notify(editing ? 'Record updated' : 'Record saved locally');
      await this.load();
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'Record could not be saved.',
        'error',
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(
    table: Parameters<FamilyRepository['remove']>[0],
    id: string,
    label: string,
  ): Promise<void> {
    const result = await this.dialogs.open({
      title: 'Delete record?',
      description: `${label} will be removed from this device.`,
      confirmText: 'Delete',
      destructive: true,
      icon: 'trash',
    });
    if (!result.confirmed) return;
    await this.repository.remove(table, id);
    this.feedback.notify('Record deleted');
    await this.load();
  }
  protected memberName(id: string): string {
    return this.members().find((item) => item.id === id)?.name ?? '';
  }
  protected memberNames(ids: readonly string[]): string {
    const names = ids.map((id) => this.memberName(id)).filter(Boolean);
    return names.length ? names.join(', ') : 'Not linked';
  }
  protected rasiName(id: string): string {
    const item = this.rasis.find((value) => value.id === id);
    return item ? `${item.english} (${item.western}) - ${item.tamil}` : '';
  }
  protected nakshatraName(id: string): string {
    const item = this.nakshatras.find((value) => value.id === id);
    return item ? `${item.english} - ${item.tamil}` : '';
  }
  protected age(dateOfBirth: string): number | null {
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    if (!year || !month || !day) return null;

    const today = new Date();
    let age = today.getFullYear() - year;
    const birthdayHasPassed =
      today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
    if (!birthdayHasPassed) age -= 1;

    return age >= 0 ? age : null;
  }
  protected bloodLabel(item: BloodGroupRecord): string {
    return item.bloodGroup === 'Unknown'
      ? 'Blood group not recorded'
      : item.bloodGroup === 'Custom'
        ? item.customBloodGroup || 'Blood group not recorded'
        : item.bloodGroup;
  }
  protected employmentTypeLabel(value: EmploymentType): string {
    return this.employmentTypeOptions.find((option) => option.value === value)?.label ?? value;
  }
  protected employmentModeLabel(value: EmploymentMode): string {
    return this.employmentModeOptions.find((option) => option.value === value)?.label ?? value;
  }
  protected call(number: string): void {
    window.location.href = `tel:${number.replace(/[^+\d]/g, '')}`;
  }
  protected copy(value: string, label: string): void {
    void navigator.clipboard.writeText(value).then(() => this.feedback.notify(`${label} copied`));
  }

  protected sanitizeContactInput(
    event: Event,
    control: FormControl<string>,
    allowCommas = false,
  ): void {
    const inputElement = event.target as HTMLInputElement;
    const disallowedCharacters = allowCommas ? /[^\d+\-, ]/g : /[^\d+\- ]/g;
    const sanitizedValue = inputElement.value.replace(disallowedCharacters, '');
    if (sanitizedValue === inputElement.value) return;

    inputElement.value = sanitizedValue;
    control.setValue(sanitizedValue);
  }

  private csv(value: string): readonly string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  private formPartialDate(value: TimelineDateFormValue, prefix: 'start' | 'end'): string {
    return buildPartialDate({
      year: String(value[`${prefix}Year`] ?? ''),
      month: String(value[`${prefix}Month`] ?? ''),
      day: String(value[`${prefix}Day`] ?? ''),
    });
  }
  private partialDateParts(value: string): {
    readonly year: string;
    readonly month: string;
    readonly day: string;
  } {
    const [year = '', month = '', day = ''] = value.split('-');
    return { year, month, day: day ? String(Number(day)) : '' };
  }
  private sortTimelineRecords<
    T extends { readonly current: boolean; readonly startDate: string; readonly updatedAt: string },
  >(records: readonly T[]): readonly T[] {
    return [...records].sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1;
      return (
        partialDateSortKey(b.startDate).localeCompare(partialDateSortKey(a.startDate)) ||
        b.updatedAt.localeCompare(a.updatedAt)
      );
    });
  }
  private resetResidenceForm(): void {
    this.residenceForm.reset({
      location: '',
      fullAddress: '',
      contactNumber: '',
      startYear: '',
      startMonth: '',
      startDay: '',
      endYear: '',
      endMonth: '',
      endDay: '',
      current: false,
      notes: '',
    });
  }
  private resetEmploymentForm(): void {
    this.employmentForm.reset({
      companyName: '',
      jobTitle: '',
      place: '',
      employmentType: 'full-time',
      employmentMode: 'office',
      startYear: '',
      startMonth: '',
      startDay: '',
      endYear: '',
      endMonth: '',
      endDay: '',
      current: false,
      notes: '',
    });
  }
  private resetActiveForm(): void {
    this.memberForm.reset({
      name: '',
      relationship: '',
      dateOfBirth: '',
      gender: '',
      phone: '',
      notes: '',
      bloodGroup: '',
      rasiId: '',
      nakshatraId: '',
      gothram: '',
      important: false,
    });
    this.hospitalForm.reset({
      hospitalName: '',
      branch: '',
      contacts: '',
      patientName: '',
      familyMemberId: '',
      opNumber: '',
      department: '',
      doctorName: '',
      lastVisitDate: '',
      website: '',
      notes: '',
      important: false,
    });
    this.insuranceForm.reset({
      providerName: '',
      policyName: '',
      policyNumber: '',
      tpaName: '',
      contacts: '',
      emails: '',
      website: '',
      coveredFamilyMemberIds: [],
      startDate: '',
      expiryDate: '',
      notes: '',
      important: false,
    });
    this.itemForm.reset({
      name: '',
      itemType: 'medicine',
      usedFor: '',
      familyMemberId: '',
      brand: '',
      form: '',
      strength: '',
      usageInstructions: '',
      doctorOrHospital: '',
      notes: '',
      favourite: false,
    });
    this.bloodForm.reset({
      personName: '',
      familyMemberId: '',
      bloodGroup: 'Unknown',
      customBloodGroup: '',
      notes: '',
      lastVerifiedDate: '',
      source: '',
    });
    this.resetResidenceForm();
    this.resetEmploymentForm();
  }
}
