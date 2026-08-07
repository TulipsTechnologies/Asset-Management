/**
 * Permission ids belonging to the **HRM hub** (`AuthToken`), not to this module.
 *
 * Deliberately separate from `./permissions.ts`: that enum mirrors the backend
 * `TulipsHRM.AssetManagement.Domain.Enums.Permissions` append-only enum, so its
 * id space is the module's and will eventually reach these numbers with an
 * entirely different meaning. The two sets are never interchangeable — see the
 * `hubPermissions` vs `userPermissions` split in `@/contexts/AuthContext`.
 *
 * Only the ids the shared `@tulipstechnologies/common` chrome actually reads
 * belong here.
 */
export enum HubPermission {
  /** Gates the admin/employee view toggle and the admin sidebar menu fetch. */
  AdminMode = 67,
}
