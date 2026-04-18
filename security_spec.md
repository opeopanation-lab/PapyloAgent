# Security Specification: Nation Agent

## Data Invariants
1. **Sovereign Isolation**: An operator can only read and write their own data. No cross-user access is permitted under any circumstances.
2. **Transmission Integrity**: Transmissions are immutable once created. An operator cannot edit or delete individual logs (enforcing audit integrity for "Real App" status).
3. **Identity Veracity**: The `userId` path variable must strictly match the `request.auth.uid`.
4. **Content Guarding**: Transmissions must have a maximum size to prevent resource abuse.

## The "Dirty Dozen" Payloads (Red Team Test Cases)
1. **Identity Spoofing**: Attempt to create a user document with a UID that doesn't match the auth token.
2. **Log Tampering**: Attempt to update a transmission content field after creation.
3. **Cross-Tenant Read**: User A tries to read User B's transmissions.
4. **Cross-Tenant Write**: User A tries to write a log to User B's transmissions subcollection.
5. **Schema Poisoning**: Attempt to inject a 2MB string into a log content field.
6. **Role Escalation**: Attempt to set a `role: 'admin'` field on a user document (not defined in schema, but testing generic protection).
7. **System ID Hijack**: Attempt to use `NATION_CORE` as a document ID via path variables.
8. **Orphaned Write**: Attempt to create a transmission without a corresponding user document (verified via exists).
9. **Unverified Extraction**: Attempt to list all users' transmissions via a recursive query.
10. **Field Injection**: Adding a `isVerified: true` field to the user settings.
11. **Timestamp Spoofing**: Sending a client-side timestamp for `createdAt` instead of `request.time`.
12. **Anonymous Breach**: Attempting to read logs while not authenticated.

## Rules Verification
These payloads will be tested against the draft rules.
