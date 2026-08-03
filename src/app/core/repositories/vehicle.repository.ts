import { inject, Injectable } from '@angular/core';
import { DATABASE } from '../database/database.port';
import {
  Vehicle,
  newId,
  normalizeText,
  normalizeVehicleRegistration,
  nowIso,
} from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class VehicleRepository {
  private readonly database = inject(DATABASE);

  async list(query = ''): Promise<readonly Vehicle[]> {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    const registrationQuery = normalizeVehicleRegistration(query);
    return (await this.database.getAll('vehicles'))
      .filter((item) => !item.archived)
      .filter((item) => {
        const text = normalizeText(
          [
            item.nickname,
            item.registrationNumber,
            item.make,
            item.model,
            item.owner,
            item.notes,
          ].join(' '),
        );
        return (
          terms.every((term) => text.includes(term)) ||
          Boolean(registrationQuery && item.normalizedRegistration.includes(registrationQuery))
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async save(
    value: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'normalizedRegistration'> &
      Partial<Pick<Vehicle, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const timestamp = nowIso();
    await this.database.put('vehicles', {
      ...value,
      id: value.id ?? newId(),
      createdAt: value.createdAt ?? timestamp,
      updatedAt: timestamp,
      normalizedRegistration: normalizeVehicleRegistration(value.registrationNumber),
    });
  }

  async remove(id: string): Promise<void> {
    await this.database.delete('vehicles', id);
  }
}
