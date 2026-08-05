import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BloodGroupRecord,
  Checklist,
  FamilyMember,
  HospitalOpRecord,
  ImportantItem,
  MedicalInsurance,
  Note,
  SavedContent,
  Vehicle,
} from '../../core/models/app.models';
import { ChecklistRepository } from '../../core/repositories/checklist.repository';
import { ContentRepository } from '../../core/repositories/content.repository';
import { FamilyRepository } from '../../core/repositories/family.repository';
import { NoteRepository } from '../../core/repositories/note.repository';
import { VehicleRepository } from '../../core/repositories/vehicle.repository';
import { AppStore } from '../../core/services/app-store.service';
import { AppIcon } from '../../shared/components/app-icon';
import { SelectPicker, SelectPickerOption } from '../../shared/components/select-picker';

type SearchScope = 'all' | 'content' | 'family' | 'vehicles' | 'notes' | 'checklists';

@Component({
  selector: 'app-search',
  imports: [ReactiveFormsModule, RouterLink, AppIcon, SelectPicker],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search {
  private readonly contentRepository = inject(ContentRepository);
  private readonly familyRepository = inject(FamilyRepository);
  private readonly vehicleRepository = inject(VehicleRepository);
  private readonly noteRepository = inject(NoteRepository);
  private readonly checklistRepository = inject(ChecklistRepository);
  private readonly store = inject(AppStore);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly query = this.formBuilder.nonNullable.control('');
  protected readonly scope = this.formBuilder.nonNullable.control<SearchScope>('all');
  protected readonly searched = signal(false);
  protected readonly loading = signal(false);
  protected readonly scopeOptions: readonly SelectPickerOption[] = [
    { value: 'all', label: 'All modules' },
    { value: 'content', label: 'Saved Content' },
    { value: 'family', label: 'Family & Health' },
    { value: 'vehicles', label: 'Vehicles' },
    { value: 'notes', label: 'Notes' },
    { value: 'checklists', label: 'Checklists' },
  ];
  protected readonly content = signal<readonly SavedContent[]>([]);
  protected readonly members = signal<readonly FamilyMember[]>([]);
  protected readonly hospitals = signal<readonly HospitalOpRecord[]>([]);
  protected readonly insurance = signal<readonly MedicalInsurance[]>([]);
  protected readonly items = signal<readonly ImportantItem[]>([]);
  protected readonly blood = signal<readonly BloodGroupRecord[]>([]);
  protected readonly vehicles = signal<readonly Vehicle[]>([]);
  protected readonly notes = signal<readonly Note[]>([]);
  protected readonly checklists = signal<readonly Checklist[]>([]);
  protected async search(): Promise<void> {
    const query = this.query.value.trim();
    if (!query) return;
    this.loading.set(true);
    const scope = this.scope.value;
    const include = (value: SearchScope) => scope === 'all' || scope === value;
    const empty = Promise.resolve([] as const);
    const [content, members, hospitals, insurance, items, blood, vehicles, notes, checklists] =
      await Promise.all([
        include('content') ? this.searchContent(query) : empty,
        include('family') ? this.familyRepository.members(query) : empty,
        include('family') ? this.familyRepository.hospitalRecords(query) : empty,
        include('family') ? this.familyRepository.insurance(query) : empty,
        include('family') ? this.familyRepository.importantItems(undefined, query) : empty,
        include('family') ? this.familyRepository.bloodGroups(query) : empty,
        include('vehicles') ? this.vehicleRepository.list(query) : empty,
        include('notes') ? this.noteRepository.list(query, 25).then((page) => page.items) : empty,
        include('checklists')
          ? this.checklistRepository
              .lists()
              .then((lists) =>
                lists
                  .filter((list) =>
                    `${list.title} ${list.description}`
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
                  )
                  .slice(0, 25),
              )
          : empty,
      ]);
    this.content.set(content);
    this.members.set(members.slice(0, 25));
    this.hospitals.set(hospitals.slice(0, 25));
    this.insurance.set(insurance.slice(0, 25));
    this.items.set(items.slice(0, 25));
    this.blood.set(blood.slice(0, 25));
    this.vehicles.set(vehicles.slice(0, 25));
    this.notes.set(notes);
    this.checklists.set(checklists);
    this.searched.set(true);
    this.loading.set(false);
  }
  protected total(): number {
    return (
      this.content().length +
      this.members().length +
      this.hospitals().length +
      this.insurance().length +
      this.items().length +
      this.blood().length +
      this.vehicles().length +
      this.notes().length +
      this.checklists().length
    );
  }
  private async searchContent(query: string): Promise<readonly SavedContent[]> {
    const base = {
      query,
      contentType: '' as const,
      platform: '',
      categoryId: '',
      tagId: '',
      recipientId: '',
      sent: 'all' as const,
      favouriteOnly: false,
      consumed: 'all' as const,
      adultOnly: false,
      excludeAdult: false,
      dateFrom: '',
      dateTo: '',
      sort: 'recent' as const,
    };
    const [videos, posts] = await Promise.all([
      this.contentRepository.list(
        { ...base, section: 'videos' },
        this.store.settings().showAdultContent,
        25,
      ),
      this.contentRepository.list(
        { ...base, section: 'posts' },
        this.store.settings().showAdultContent,
        25,
      ),
    ]);
    return [...videos.items, ...posts.items]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 25);
  }
}
