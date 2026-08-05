import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FamilyMember, Vehicle, VehicleType } from '../../core/models/app.models';
import { FamilyRepository } from '../../core/repositories/family.repository';
import { VehicleRepository } from '../../core/repositories/vehicle.repository';
import { DialogService } from '../../core/services/dialog.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { AppIcon } from '../../shared/components/app-icon';
import { SelectPicker, SelectPickerOption } from '../../shared/components/select-picker';

@Component({
  selector: 'app-vehicles',
  imports: [ReactiveFormsModule, AppIcon, SelectPicker],
  templateUrl: './vehicles.html',
  styleUrl: './vehicles.scss',
})
export class Vehicles {
  private readonly repository = inject(VehicleRepository);
  private readonly familyRepository = inject(FamilyRepository);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(FeedbackService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly vehicles = signal<readonly Vehicle[]>([]);
  protected readonly members = signal<readonly FamilyMember[]>([]);
  protected readonly panelOpen = signal(false);
  protected readonly editingVehicle = signal<Vehicle | null>(null);
  protected readonly vehicleTypeOptions: readonly SelectPickerOption[] = [
    { value: 'car', label: 'Car' },
    { value: 'motorcycle', label: 'Motorcycle' },
    { value: 'scooter', label: 'Scooter' },
    { value: 'bicycle', label: 'Bicycle' },
    { value: 'commercial', label: 'Commercial vehicle' },
    { value: 'other', label: 'Other' },
  ];
  protected readonly memberOptions = computed<readonly SelectPickerOption[]>(() => [
    { value: '', label: 'Not linked' },
    ...this.members().map((member) => ({ value: member.id, label: member.name })),
  ]);
  protected readonly query = this.formBuilder.nonNullable.control('');
  protected readonly form = this.formBuilder.nonNullable.group({
    nickname: ['', Validators.required],
    registrationNumber: ['', Validators.required],
    make: ['', Validators.required],
    model: [''],
    variant: [''],
    vehicleType: ['car' as VehicleType],
    owner: [''],
    familyMemberId: [''],
    registrationDate: [''],
    insuranceProvider: [''],
    insuranceExpiry: [''],
    pollutionExpiry: [''],
    notes: [''],
    favourite: [false],
  });
  constructor() {
    void this.load();
    if (inject(ActivatedRoute).snapshot.queryParamMap.has('add'))
      window.setTimeout(() => this.open(), 0);
  }
  protected async load(): Promise<void> {
    const [vehicles, members] = await Promise.all([
      this.repository.list(this.query.value),
      this.familyRepository.members(),
    ]);
    this.vehicles.set(vehicles);
    this.members.set(members);
  }
  protected open(): void {
    this.editingVehicle.set(null);
    this.form.reset({
      nickname: '',
      registrationNumber: '',
      make: '',
      model: '',
      variant: '',
      vehicleType: 'car',
      owner: '',
      familyMemberId: '',
      registrationDate: '',
      insuranceProvider: '',
      insuranceExpiry: '',
      pollutionExpiry: '',
      notes: '',
      favourite: false,
    });
    this.panelOpen.set(true);
  }
  protected edit(vehicle: Vehicle): void {
    this.editingVehicle.set(vehicle);
    this.form.reset({
      nickname: vehicle.nickname,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      vehicleType: vehicle.vehicleType,
      owner: vehicle.owner,
      familyMemberId: vehicle.familyMemberId,
      registrationDate: vehicle.registrationDate,
      insuranceProvider: vehicle.insuranceProvider,
      insuranceExpiry: vehicle.insuranceExpiry,
      pollutionExpiry: vehicle.pollutionExpiry,
      notes: vehicle.notes,
      favourite: vehicle.favourite,
    });
    this.panelOpen.set(true);
  }
  protected closeEditor(): void {
    this.panelOpen.set(false);
    this.editingVehicle.set(null);
  }
  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const editingVehicle = this.editingVehicle();
    await this.repository.save({
      ...this.form.getRawValue(),
      archived: editingVehicle?.archived ?? false,
      id: editingVehicle?.id,
      createdAt: editingVehicle?.createdAt,
    });
    this.closeEditor();
    this.feedback.notify(editingVehicle ? 'Vehicle updated' : 'Vehicle saved locally');
    await this.load();
  }
  protected async remove(vehicle: Vehicle): Promise<void> {
    const result = await this.dialogs.open({
      title: 'Delete vehicle?',
      description: `${vehicle.nickname} (${vehicle.registrationNumber}) will be removed.`,
      confirmText: 'Delete',
      destructive: true,
      icon: 'trash',
    });
    if (!result.confirmed) return;
    await this.repository.remove(vehicle.id);
    this.feedback.notify('Vehicle deleted');
    await this.load();
  }
  protected owner(vehicle: Vehicle): string {
    return (
      this.members().find((member) => member.id === vehicle.familyMemberId)?.name ||
      vehicle.owner ||
      'Owner not recorded'
    );
  }
}
