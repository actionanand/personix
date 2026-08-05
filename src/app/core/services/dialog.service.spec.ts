import { DialogService } from './dialog.service';

describe('DialogService', () => {
  it('provides existing prompt content to edit dialogs', async () => {
    const dialogs = new DialogService();
    const resultPromise = dialogs.open({
      title: 'Edit note',
      description: 'Update the note.',
      promptLabel: 'Note text',
      promptValue: 'Previously saved text',
    });

    expect(dialogs.active()?.promptValue).toBe('Previously saved text');

    dialogs.close({ confirmed: false, value: '', checked: false });
    await expect(resultPromise).resolves.toEqual({ confirmed: false, value: '', checked: false });
  });
});
