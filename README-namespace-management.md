# Namespace Management

## Manual vs Managed Skills

Skill Organizer tracks materialized folders in `.skill-organizer.manifest.json`:

```json
{
  "managedFolders": ["repo-skill-a", "repo-skill-b"],
  "manualFolders": ["my-local-skill"]
}
```

- `managedFolders` are owned by sync/update operations.
- `manualFolders` are protected from automatic overwrite/removal.
- Legacy manifests that only contain `managedFolders` are auto-migrated to include `manualFolders: []`.

## Commands

- `Skill Organizer: Apply Sync (Overwrite Managed Skills)`
  - Updates/removes only managed folders.
  - Skips manual folders automatically.
- `Skill Organizer: Mark as Manual`
  - Moves a folder from `managedFolders` to `manualFolders`.
- `Skill Organizer: Mark as Managed`
  - Moves a folder from `manualFolders` to `managedFolders`.
- `Skill Organizer: Update Managed Skill`
  - Updates one managed folder from currently enabled source skills.
  - Not available for manual folders.
- `Skill Organizer: Uninstall Materialized Skill`
  - Removes a folder and its manifest reference.
  - Manual folders require force confirmation.

## Migration Path

1. Upgrade extension.
2. Run sync once.
3. Existing manifest is migrated automatically to include `manualFolders`.
4. Mark any hand-crafted folders as manual using `Mark as Manual`.

## Backwards Compatibility

- Existing manifests with only `managedFolders` continue to work.
- Tools that only read `managedFolders` remain compatible.
- Folders not tracked in the manifest are not modified by sync unless explicitly marked and managed.

## Troubleshooting

- **A folder keeps changing on sync**
  - Mark it as manual and sync again.
- **Cannot update a folder**
  - If it is manual, convert it to managed first.
- **Cannot uninstall a manual folder**
  - Use force confirmation in the uninstall flow.
- **Legacy manifest missing `manualFolders`**
  - Run any command that loads the manifest (sync/list); migration is automatic.
