import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  BLOOD_GROUPS,
  BloodGroupRecord,
  FamilyMember,
  HospitalOpRecord,
  ImportantItem,
  MedicalInsurance,
  NAKSHATRA_OPTIONS,
  RASI_OPTIONS,
} from '../../core/models/app.models';
import { FamilyRepository } from '../../core/repositories/family.repository';
import { DialogService } from '../../core/services/dialog.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { AppIcon } from '../../shared/components/app-icon';
import { SelectPicker, SelectPickerOption } from '../../shared/components/select-picker';
import { TokenInput } from '../../shared/components/token-input';
import { commaSeparatedEmailsValidator } from '../../shared/validators/comma-separated-emails.validator';
import {
  commaSeparatedContactNumbersValidator,
  contactNumberValidator,
} from '../../shared/validators/contact-number.validator';

type FamilyTab = 'members' | 'hospital' | 'insurance' | 'items' | 'blood';
type FamilyEditorRecord =
  | { readonly tab: 'members'; readonly value: FamilyMember }
  | { readonly tab: 'hospital'; readonly value: HospitalOpRecord }
  | { readonly tab: 'insurance'; readonly value: MedicalInsurance }
  | { readonly tab: 'items'; readonly value: ImportantItem }
  | { readonly tab: 'blood'; readonly value: BloodGroupRecord };

@Component({
  selector: 'app-family',
  imports: [DatePipe, ReactiveFormsModule, AppIcon, SelectPicker, TokenInput],
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
  protected readonly saving = signal(false);
  protected readonly query = this.formBuilder.nonNullable.control('');
  protected readonly members = signal<readonly FamilyMember[]>([]);
  protected readonly hospitals = signal<readonly HospitalOpRecord[]>([]);
  protected readonly insurance = signal<readonly MedicalInsurance[]>([]);
  protected readonly items = signal<readonly ImportantItem[]>([]);
  protected readonly bloodRecords = signal<readonly BloodGroupRecord[]>([]);

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
    const [members, hospitals, insurance, items, blood] = await Promise.all([
      this.repository.members(query),
      this.repository.hospitalRecords(query),
      this.repository.insurance(query),
      this.repository.importantItems(undefined, query),
      this.repository.bloodGroups(query),
    ]);
    this.members.set(members);
    this.hospitals.set(hospitals);
    this.insurance.set(insurance);
    this.items.set(items);
    this.bloodRecords.set(blood);
  }
  protected openAdd(): void {
    this.editingRecord.set(null);
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
  }
}
