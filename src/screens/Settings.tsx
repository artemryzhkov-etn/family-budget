import { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch, faCloud, faDownload, faMoon, faRightFromBracket, faSun, faUpload, faUsers } from '@fortawesome/free-solid-svg-icons';
import type { Household } from '../lib/types';
import { exportJSON, importJSON } from '../lib/store';
import { api, logout } from '../lib/cloud';
import { Button, Card } from '../ui';

type Props = {
  household: Household;
  userId: string;
  dark: boolean;
  onToggleDark: () => void;
};

export function Settings({ household: h, userId, dark, onToggleDark }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const me = h.users.find(u => u.id === userId);

  const doExport = () => {
    const blob = new Blob([exportJSON(h)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const data = importJSON(String(reader.result));
      if (!data) {
        alert('Не вдалося прочитати файл — перевірте, що це резервна копія цієї програми.');
        return;
      }
      setImporting(true);
      try {
        await api.importAll(data);
        alert('Дані імпортовано у спільну базу — вони вже синхронізуються.');
      } catch {
        alert('Помилка імпорту. Перевірте з’єднання з інтернетом і спробуйте ще раз.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Налаштування</h2>

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Ви увійшли як</p>
        <p className="font-medium">{me?.name} · {me?.email}</p>
        <Button variant="secondary" className="mt-3" onClick={() => logout()}>
          <FontAwesomeIcon icon={faRightFromBracket} /> Вийти
        </Button>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FontAwesomeIcon icon={faUsers} className="text-muted-foreground" /> Користувачі ({h.users.length})
        </h3>
        <ul className="space-y-1 text-sm">
          {h.users.map(u => (
            <li key={u.id} className="flex justify-between gap-2">
              <span>{u.name}{u.legacy ? ' (архівний)' : ''}</span>
              <span className="truncate text-muted-foreground">{u.email}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Новий користувач приєднується, створивши акаунт на екрані входу з цього ж сайту.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FontAwesomeIcon icon={faCloud} className="text-muted-foreground" /> Дані
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Дані зберігаються у хмарі (Firebase) і синхронізуються між усіма пристроями в
          реальному часі. Офлайн зміни підхопляться, щойно з’явиться інтернет.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doExport}>
            <FontAwesomeIcon icon={faDownload} /> Експорт (резервна копія)
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            <FontAwesomeIcon icon={importing ? faCircleNotch : faUpload} spin={importing} /> Імпорт
          </Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={e => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Імпорт підтримує резервні копії зі старої (localStorage) версії — так переносяться
          ваші попередні дані.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Вигляд</h3>
        <Button variant="secondary" onClick={onToggleDark}>
          <FontAwesomeIcon icon={dark ? faSun : faMoon} /> {dark ? 'Світла тема' : 'Темна тема'}
        </Button>
      </Card>
    </div>
  );
}
