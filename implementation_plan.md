# Migration Plan: Remaining Components to TypeScript

## Goal
Complete the migration of `TaskDetail`, `Calendar`, and `SettingsModal` to TypeScript to ensure full type safety and project consistency.

## Components to Migrate

### 1. TaskDetail/index.jsx -> index.tsx
- [ ] Rename file to `.tsx`
- [ ] Add interface for props (e.g., `taskId`, `onClose`, etc.)
- [ ] Fix any implicit `any` errors
- [ ] Ensure correct usage of `Task` type from `src/types/index.ts`

### 2. Calendar/index.jsx -> index.tsx
- [ ] Rename file to `.tsx` (Note: Check if it's currently generic `Calendar` or a specific file like `CalendarView`)
- [ ] Add prop types
- [ ] Type calendar events and date handling logic

### 3. SettingsModal/index.jsx -> index.tsx
- [ ] Rename file to `.tsx`
- [ ] Add prop types (`isOpen`, `onClose`)
- [ ] Type user settings state if applicable

## Verification
- Run `tsc --noEmit` to check for errors after each migration.
- Verify application still runs via `npm run dev`.
