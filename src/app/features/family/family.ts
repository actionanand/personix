import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

type FamilyTab = 'members' | 'hospital' | 'insurance' | 'items' | 'blood';

@Component({
  selector: 'app-family',
  imports: [ReactiveFormsModule, AppIcon, SelectPicker],
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
    ...RASI_OPTIONS.map((item) => ({ value: item.id, label: `${item.english} · ${item.tamil}` })),
  ];
  protected readonly nakshatraOptions: readonly SelectPickerOption[] = [
    { value: '', label: 'Not recorded' },
    ...NAKSHATRA_OPTIONS.map((item) => ({
      value: item.id,
      label: `${item.english} · ${item.tamil}`,
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
    phone: [''],
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
    contacts: ['', Validators.required],
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
    contacts: [''],
    emails: [''],
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
    this.resetActiveForm();
    this.panelOpen.set(true);
  }
  protected close(): void {
    this.panelOpen.set(false);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      switch (this.activeTab()) {
        case 'members': {
          if (this.memberForm.invalid) {
            this.memberForm.markAllAsTouched();
            return;
          }
          const value = this.memberForm.getRawValue();
          await this.repository.saveMember({ ...value, photoRef: '', archived: false });
          break;
        }
        case 'hospital': {
          if (this.hospitalForm.invalid) {
            this.hospitalForm.markAllAsTouched();
            return;
          }
          const value = this.hospitalForm.getRawValue();
          await this.repository.saveHospital({
            ...value,
            contacts: this.csv(value.contacts),
            archived: false,
          });
          break;
        }
        case 'insurance': {
          if (this.insuranceForm.invalid) {
            this.insuranceForm.markAllAsTouched();
            return;
          }
          const value = this.insuranceForm.getRawValue();
          await this.repository.saveInsurance({
            ...value,
            contacts: this.csv(value.contacts),
            emails: this.csv(value.emails),
            attachmentIds: [],
            archived: false,
          });
          break;
        }
        case 'items': {
          if (this.itemForm.invalid) {
            this.itemForm.markAllAsTouched();
            return;
          }
          await this.repository.saveImportantItem({
            ...this.itemForm.getRawValue(),
            archived: false,
          });
          break;
        }
        case 'blood': {
          if (this.bloodForm.invalid) {
            this.bloodForm.markAllAsTouched();
            return;
          }
          await this.repository.saveBloodGroup({
            ...this.bloodForm.getRawValue(),
            archived: false,
          });
          break;
        }
      }
      this.panelOpen.set(false);
      this.feedback.notify('Record saved locally');
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
  protected rasiName(id: string): string {
    const item = this.rasis.find((value) => value.id === id);
    return item ? `${item.english} · ${item.tamil}` : '';
  }
  protected nakshatraName(id: string): string {
    const item = this.nakshatras.find((value) => value.id === id);
    return item ? `${item.english} · ${item.tamil}` : '';
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
