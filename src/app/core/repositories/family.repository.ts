import { inject, Injectable } from '@angular/core';
import { DATABASE } from '../database/database.port';
import {
  BloodGroupRecord,
  EmploymentHistoryRecord,
  FamilyMember,
  HospitalOpRecord,
  ImportantItem,
  MedicalInsurance,
  ResidenceHistoryRecord,
  newId,
  normalizeText,
  nowIso,
} from '../models/app.models';

export type FamilyEntity =
  | FamilyMember
  | HospitalOpRecord
  | MedicalInsurance
  | ImportantItem
  | BloodGroupRecord
  | ResidenceHistoryRecord
  | EmploymentHistoryRecord;

@Injectable({ providedIn: 'root' })
export class FamilyRepository {
  private readonly database = inject(DATABASE);

  async members(query = ''): Promise<readonly FamilyMember[]> {
    return this.search(await this.database.getAll('family_members'), query, (item) =>
      [item.name, item.relationship, item.phone, item.bloodGroup, item.gothram, item.notes].join(
        ' ',
      ),
    );
  }

  async hospitalRecords(query = ''): Promise<readonly HospitalOpRecord[]> {
    return this.search(await this.database.getAll('hospital_op_records'), query, (item) =>
      [
        item.hospitalName,
        item.branch,
        ...item.contacts,
        item.patientName,
        item.opNumber,
        item.department,
        item.doctorName,
        item.notes,
      ].join(' '),
    );
  }

  async insurance(query = ''): Promise<readonly MedicalInsurance[]> {
    return this.search(await this.database.getAll('medical_insurance'), query, (item) =>
      [
        item.providerName,
        item.policyName,
        item.policyNumber,
        item.tpaName,
        ...item.contacts,
        ...item.emails,
        item.notes,
      ].join(' '),
    );
  }

  async importantItems(
    type?: ImportantItem['itemType'],
    query = '',
  ): Promise<readonly ImportantItem[]> {
    const items = (await this.database.getAll('important_items')).filter(
      (item) => !type || item.itemType === type,
    );
    return this.search(items, query, (item) =>
      [item.name, item.usedFor, item.brand, item.doctorOrHospital, item.notes].join(' '),
    );
  }

  async bloodGroups(query = ''): Promise<readonly BloodGroupRecord[]> {
    return this.search(await this.database.getAll('blood_group_records'), query, (item) =>
      [item.personName, item.bloodGroup, item.customBloodGroup, item.notes].join(' '),
    );
  }

  async residences(query = ''): Promise<readonly ResidenceHistoryRecord[]> {
    return this.search(await this.database.getAll('residence_history'), query, (item) =>
      [
        item.location,
        item.fullAddress,
        item.contactNumber,
        item.startDate,
        item.endDate,
        item.notes,
      ].join(' '),
    );
  }

  async employment(query = ''): Promise<readonly EmploymentHistoryRecord[]> {
    return this.search(await this.database.getAll('employment_history'), query, (item) =>
      [
        item.companyName,
        item.jobTitle,
        item.place,
        item.employmentType,
        item.employmentMode,
        item.startDate,
        item.endDate,
        item.notes,
      ].join(' '),
    );
  }

  async saveMember(
    value: Omit<FamilyMember, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<FamilyMember, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.save('family_members', value);
  }

  async saveHospital(
    value: Omit<HospitalOpRecord, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<HospitalOpRecord, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.save('hospital_op_records', value);
  }

  async saveInsurance(
    value: Omit<MedicalInsurance, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<MedicalInsurance, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.save('medical_insurance', value);
  }

  async saveImportantItem(
    value: Omit<ImportantItem, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<ImportantItem, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.save('important_items', value);
  }

  async saveBloodGroup(
    value: Omit<BloodGroupRecord, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<BloodGroupRecord, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.save('blood_group_records', value);
  }

  async saveResidence(
    value: Omit<ResidenceHistoryRecord, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<ResidenceHistoryRecord, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.save('residence_history', value);
  }

  async saveEmployment(
    value: Omit<EmploymentHistoryRecord, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<EmploymentHistoryRecord, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.save('employment_history', value);
  }

  async remove(
    table:
      | 'family_members'
      | 'hospital_op_records'
      | 'medical_insurance'
      | 'important_items'
      | 'blood_group_records'
      | 'residence_history'
      | 'employment_history',
    id: string,
  ): Promise<void> {
    await this.database.delete(table, id);
  }

  private async save<
    K extends
      | 'family_members'
      | 'hospital_op_records'
      | 'medical_insurance'
      | 'important_items'
      | 'blood_group_records'
      | 'residence_history'
      | 'employment_history',
  >(
    table: K,
    value: Omit<
      import('../models/app.models').TableRecordMap[K],
      'id' | 'createdAt' | 'updatedAt'
    > &
      Partial<Pick<import('../models/app.models').TableRecordMap[K], 'id' | 'createdAt'>>,
  ): Promise<void> {
    const timestamp = nowIso();
    await this.database.put(table, {
      ...value,
      id: value.id ?? newId(),
      createdAt: value.createdAt ?? timestamp,
      updatedAt: timestamp,
    } as import('../models/app.models').TableRecordMap[K]);
  }

  private search<
    T extends { readonly archived: boolean; readonly createdAt: string; readonly id: string },
  >(items: readonly T[], query: string, text: (item: T) => string): readonly T[] {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    return items
      .filter((item) => !item.archived)
      .filter((item) => terms.every((term) => normalizeText(text(item)).includes(term)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }
}
