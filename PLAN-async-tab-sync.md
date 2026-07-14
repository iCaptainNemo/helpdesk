# Async Hybrid Tab Sync Implementation Plan

## Overview
Implement cross-device tab synchronization for AD Objects page with:
- **Local-first**: localStorage for instant performance
- **Async sync**: Non-blocking background sync to server
- **Offline resilience**: Queue changes when offline, sync when back online
- **User opt-in**: Toggle in Profile to enable/disable sync
- **Refresh-based polling**: No continuous polling, sync on page refresh

---

## Files to Create

### Backend
- [ ] `Backend/routes/tabs.js` - API endpoints for tab sync
  - `POST /api/tabs/sync` - Save tabs to server
  - `GET /api/tabs/load` - Load tabs from server
  - `POST /api/tabs/toggle-sync` - Enable/disable sync preference

### Frontend
- [ ] `frontend/src/utils/tabSyncService.js` - Sync service utility
  - Handles localStorage + async server sync
  - Offline queue management
  - Auto-retry when back online

---

## Files to Modify

### Backend
- [ ] `Backend/db/migrations.js` - Add new migration
  - Create `user_tabs` table
  - Add `tab_sync_enabled` column to `Admins` table

- [ ] `Backend/server.js` - Register new route
  - Import and register `/api/tabs` route

### Frontend
- [ ] `frontend/src/pages/ModernADProperties.js` - Use sync service
  - Replace `sessionStorage` with `localStorage`
  - Integrate `tabSyncService` for background sync
  - Load from server on mount (if sync enabled)

- [ ] `frontend/src/pages/Profile.js` - Add sync toggle
  - Add "Sync tabs across devices" checkbox
  - Save preference to server and localStorage

---

## Database Schema Changes

### New Table: `user_tabs`
```sql
CREATE TABLE user_tabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  tabs TEXT NOT NULL,           -- JSON array of tab objects
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_tabs_user_id ON user_tabs(user_id);
```

### Alter Table: `Admins`
```sql
ALTER TABLE Admins ADD COLUMN tab_sync_enabled INTEGER DEFAULT 0;
-- 0 = disabled (default), 1 = enabled
```

---

## Implementation Steps

### Phase 1: Backend (Database + API)
- [ ] 1.1 Add migration in `migrations.js` for `user_tabs` table
- [ ] 1.2 Add migration for `tab_sync_enabled` column on `Admins`
- [ ] 1.3 Create `Backend/routes/tabs.js` with endpoints
- [ ] 1.4 Register route in `server.js`
- [ ] 1.5 Test endpoints manually (Postman/curl)

### Phase 2: Frontend Sync Service
- [ ] 2.1 Create `tabSyncService.js` utility
- [ ] 2.2 Implement localStorage operations
- [ ] 2.3 Implement async server sync (non-blocking)
- [ ] 2.4 Implement offline queue with retry
- [ ] 2.5 Add online/offline event listeners

### Phase 3: AD Properties Integration
- [ ] 3.1 Import `tabSyncService` in `ModernADProperties.js`
- [ ] 3.2 Replace `sessionStorage.getItem/setItem` with service calls
- [ ] 3.3 Load tabs from server on page mount (if sync enabled)
- [ ] 3.4 Trigger async sync on tab open/close/toggle

### Phase 4: Profile Toggle
- [ ] 4.1 Add state for `tabSyncEnabled` in `Profile.js`
- [ ] 4.2 Fetch current preference from profile API
- [ ] 4.3 Add toggle UI in Preferences card
- [ ] 4.4 Handle toggle change (update server + localStorage)
- [ ] 4.5 Push current tabs to server when enabling sync

### Phase 5: Testing
- [ ] 5.1 Test local-only mode (sync disabled)
- [ ] 5.2 Test cross-device sync (phone + desktop)
- [ ] 5.3 Test offline -> online queue sync
- [ ] 5.4 Test toggle ON/OFF behavior
- [ ] 5.5 Test page refresh syncing

---

## API Specifications

### POST /api/tabs/sync
**Request:**
```json
{
  "tabs": [
    { "name": "JSMITH", "data": {...}, "showAdvanced": false },
    { "name": "HSHPCOMPUTER01", "data": {...}, "showAdvanced": true }
  ]
}
```
**Response:** `{ "success": true }`

### GET /api/tabs/load
**Response:**
```json
{
  "tabs": [...],
  "updated_at": "2025-01-18T12:00:00Z"
}
```

### POST /api/tabs/toggle-sync
**Request:** `{ "enabled": true }`
**Response:** `{ "success": true }`

---

## User Experience Flow

### Sync Disabled (Default)
1. Tabs stored in localStorage only
2. Persist across browser sessions
3. Device-specific (phone != desktop)

### Sync Enabled
1. User enables sync in Profile
2. Current local tabs pushed to server
3. On page refresh: local tabs load instantly, then merge with server
4. On tab change: save to localStorage (instant) + async sync to server
5. If offline: changes queued, synced when back online

---

## Estimated Effort
- Backend: ~2 hours
- Frontend sync service: ~1.5 hours
- AD Properties integration: ~1 hour
- Profile toggle: ~30 minutes
- Testing: ~1 hour

**Total: ~6 hours**
