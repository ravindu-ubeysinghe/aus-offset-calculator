import { useId, useRef, useState } from 'react';
import { Card } from './Card';
import { DownloadIcon, UploadIcon, WarningIcon } from './icons';
import { saveTextFile, slugify } from '../lib/download';
import { csvToProfile, profileToCsv, ProfileParseError } from '../lib/profile';
import type { Profile } from '../lib/state';

interface ProfileCardProps {
  profile: Profile;
  onNameChange: (name: string) => void;
  onImport: (profile: Profile) => void;
}

type Status =
  | { kind: 'error'; message: string }
  | { kind: 'imported'; message: string; previous: Profile }
  | null;

/** True if there is anything here worth warning the user about losing. */
function hasContent(profile: Profile): boolean {
  return (
    Object.entries(profile).some(
      ([key, value]) => key !== 'name' && typeof value === 'string' && value.trim() !== '',
    ) ||
    profile.contributions.length > 0 ||
    profile.lumps.length > 0 ||
    profile.expenses.length > 0
  );
}

export function ProfileCard({ profile, onNameChange, onImport }: ProfileCardProps) {
  const nameId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);

  const handleExport = () => {
    setStatus(null);
    const filename = `${slugify(profile.name, 'offset-profile')}.csv`;
    void saveTextFile(filename, profileToCsv(profile));
  };

  const handleFile = async (file: File) => {
    const previous = profile;
    try {
      const { profile: imported, skipped } = csvToProfile(await file.text());
      onImport(imported);

      const label = imported.name ? `"${imported.name}"` : file.name;
      setStatus({
        kind: 'imported',
        previous,
        message:
          skipped.length === 0
            ? `Loaded ${label}.`
            : `Loaded ${label}, but skipped ${skipped.length} row${skipped.length === 1 ? '' : 's'}. ${skipped[0]}`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof ProfileParseError
            ? error.message
            : 'That file could not be read as CSV.',
      });
    }
  };

  const undo = (previous: Profile) => {
    onImport(previous);
    setStatus(null);
  };

  return (
    <Card title="Profile">
      <div className="field">
        <label className="field__label" htmlFor={nameId}>Profile name</label>
        <input
          id={nameId}
          className="input"
          type="text"
          autoComplete="off"
          placeholder="e.g. Main home loan"
          value={profile.name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>

      <div className="profile__actions">
        <button
          type="button"
          className="btn"
          onClick={handleExport}
          disabled={!hasContent(profile)}
          title={hasContent(profile) ? 'Save this profile as a CSV' : 'Nothing to export yet'}
        >
          <DownloadIcon /> Export
        </button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          <UploadIcon /> Import
        </button>
      </div>

      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept=".csv,text/csv"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so picking the same file twice in a row still fires a change.
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      {status && (
        <div
          className={`notice notice--compact ${status.kind === 'error' ? 'notice--error' : 'notice--info'}`}
          role="status"
        >
          {status.kind === 'error' && (
            <span className="notice__icon"><WarningIcon size={15} /></span>
          )}
          <span>{status.message}</span>
          {status.kind === 'imported' && (
            <button
              type="button"
              className="notice__action"
              onClick={() => undo(status.previous)}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
