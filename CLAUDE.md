# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Tube Crawler** is an Electron + Svelte desktop application for macOS that manages YouTube video collections for personal learning and research. Users can add videos via URL, download them using Youtube.js, and play them offline with an integrated Plyr video player.

**Tech Stack**: Electron, Svelte, TypeScript, Vite, SQLite, Plyr, Tailwind CSS, Youtube.js

**Purpose**: Personal use only - educational content management and offline playback

---

## Development Commands

### Setup
```bash
# Install dependencies
npm install

# No external dependencies required - Youtube.js is bundled!
```

### Development
```bash
# Run in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Package for macOS distribution
npm run package

# Create .dmg installer
npm run make
```

### Database
```bash
# Initialize SQLite database
npm run db:init

# Reset database (dangerous - deletes all data)
npm run db:reset

# View database contents
npm run db:inspect
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test src/main/services/download.service.test.ts
```

### Code Quality
```bash
# Type checking
npm run typecheck

# Lint code
npm run lint

# Format code
npm run format
```

---

## Architecture Overview

### Two-Process Model

```
Renderer Process (Svelte)      Main Process (Node.js)
─────────────────────          ──────────────────────
UI Components                  IPC Handlers
  ↓                              ↓
Svelte Stores                  Services Layer
  ↓                              ↓
IPC API Wrapper      ←──→      - DownloadService (Youtube.js)
                                - DatabaseService
                                  ↓
                               File System
                                - SQLite DB
                                - Downloaded Videos
```

### Key Design Patterns

1. **IPC Communication**: All renderer-to-main communication goes through typed IPC channels defined in `src/main/ipc/channels.ts`

2. **Service Layer**: Business logic is encapsulated in services (`src/main/services/`)
   - `download.service.ts`: Video downloads using Youtube.js (no external dependencies)
   - `database.service.ts`: SQLite operations with better-sqlite3

3. **State Management**: Svelte stores (`src/renderer/stores/`) manage app state
   - `videos.store.ts`: Video library state
   - `player.store.ts`: Playback state
   - `search.store.ts`: Search and filtering

4. **Component Structure**: Flat hierarchy organized by domain
   - `layout/`: Header, Sidebar, MainContent
   - `video/`: VideoList, VideoItem, AddVideoInput, VideoPlayer
   - `ui/`: Reusable UI components

---

## Critical Implementation Details

### Youtube.js Integration

**No External Dependencies**: Youtube.js is a pure JavaScript library bundled with the app - no Python, ffmpeg, or CLI tools required!

**Metadata Extraction**:
```typescript
const youtube = await Innertube.create()
const info = await youtube.getInfo(videoId)
const basicInfo = info.basic_info

// Extract metadata
const title = basicInfo.title
const thumbnail = basicInfo.thumbnail?.[0]?.url
const duration = basicInfo.duration
const channelName = basicInfo.author
```

**Video Download**:
```typescript
const info = await youtube.getInfo(videoId)

// Choose format
const format = info.chooseFormat({
  type: 'video+audio',
  quality: 'best'
})

// Download stream
const stream = await info.download({
  type: 'video+audio',
  quality: 'best',
  format: 'mp4'
})

// Save to file with progress tracking
```

**Progress Tracking**: Track download progress by monitoring stream chunks and calculating percentage based on content length.

**Error Handling**:
- Network errors: Handled by Promise rejection
- Invalid URL: Regex validation before API call
- YouTube API changes: Youtube.js actively maintained and updated

### SQLite Schema

```sql
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  thumbnail_path TEXT,
  duration INTEGER,
  channel_name TEXT,
  file_path TEXT,
  download_status TEXT DEFAULT 'pending',
  download_progress INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key Indexes**: `video_id`, `title`, `download_status`

### File Storage Locations

```
~/Library/Application Support/TubeCrawler/
├── database/videos.db          # SQLite database
├── downloads/{video_id}.mp4    # Downloaded videos
├── thumbnails/{video_id}.jpg   # Cached thumbnails
└── logs/app.log                # Application logs
```

Access via `app.getPath('userData')` in Electron.

### Video Playback

Uses Plyr library with local `file://` protocol:

```svelte
<video id="plyr-player" src="file://{video.filePath}"></video>
```

**Important**: Requires `webSecurity: false` in BrowserWindow config, but keep `contextIsolation: true` and `nodeIntegration: false` for security.

### IPC API Surface

```typescript
// Renderer → Main
await window.api.video.add(url: string): Promise<Video>
await window.api.video.getAll(): Promise<Video[]>
await window.api.video.search(query: string): Promise<Video[]>
await window.api.video.download(videoId: string): Promise<void>
await window.api.video.delete(videoId: number): Promise<void>

// Main → Renderer (Events)
window.api.on('download:progress', (data) => { ... })
window.api.on('download:complete', (data) => { ... })
window.api.on('download:error', (data) => { ... })
```

All IPC is typed and exposed through `contextBridge` in `preload.ts`.

---

## Code Conventions

### File Naming
- Components: `PascalCase.svelte`
- TypeScript: `camelCase.ts`
- Services: `name.service.ts`
- Stores: `name.store.ts`
- Tests: `{filename}.test.ts`

### TypeScript
- Strict mode enabled
- Explicit return types on all functions
- Interfaces over types for objects
- Enums for status values (`DownloadStatus`, etc.)

### Svelte
- One component per file
- Props typed with TypeScript
- Use reactive statements (`$:`) for derived values
- Keep components small and focused

### Git Commits
```
<type>(<scope>): <subject>

Types: feat, fix, refactor, docs, style, test, chore
Scope: download, player, ui, db, ipc
Example: feat(download): add retry logic for failed downloads
```

---

## Common Development Tasks

### Adding a New IPC Channel

1. Define channel name in `src/main/ipc/channels.ts`:
   ```typescript
   export const IPC_CHANNELS = {
     VIDEO_EXPORT: 'video:export',
   } as const;
   ```

2. Add handler in `src/main/ipc/handlers.ts`:
   ```typescript
   ipcMain.handle(IPC_CHANNELS.VIDEO_EXPORT, async (event, videoId) => {
     return fileService.exportVideo(videoId);
   });
   ```

3. Expose in `src/main/preload.ts`:
   ```typescript
   contextBridge.exposeInMainWorld('api', {
     video: {
       export: (videoId: string) => ipcRenderer.invoke('video:export', videoId),
     }
   });
   ```

4. Use in renderer:
   ```typescript
   await window.api.video.export(videoId);
   ```

### Adding a New Service

1. Create file: `src/main/services/{name}.service.ts`
2. Export singleton instance:
   ```typescript
   class MyService {
     constructor() { /* init */ }
     async doSomething() { /* logic */ }
   }
   export const myService = new MyService();
   ```
3. Use in IPC handlers or other services

### Adding a New Svelte Component

1. Create file: `src/renderer/components/{domain}/{Name}.svelte`
2. Define props and types:
   ```svelte
   <script lang="ts">
     export let video: Video;
     export let onPlay: (id: number) => void;
   </script>
   ```
3. Import and use in parent component

### Database Migration

1. Create migration file: `migrations/{timestamp}_{description}.sql`
2. Add migration logic to `database.service.ts`:
   ```typescript
   private runMigrations() {
     // Execute migration SQL
   }
   ```
3. Run on app startup or via `npm run db:migrate`

---

## Debugging

### Main Process Debugging
```bash
# Enable DevTools for main process
npm run dev -- --inspect
```
Attach debugger in Chrome: `chrome://inspect`

### Renderer Process Debugging
- Open DevTools: `Cmd+Option+I`
- Logs in Console tab
- Network requests in Network tab

### SQLite Debugging
```bash
# Open database in CLI
sqlite3 ~/Library/Application\ Support/TubeCrawler/database/videos.db

# Useful queries
SELECT * FROM videos;
SELECT * FROM videos WHERE download_status = 'failed';
```

### Youtube.js Debugging
```typescript
// Test Youtube.js directly in Node.js REPL
const { Innertube } = require('youtubei.js')
const youtube = await Innertube.create()
const info = await youtube.getInfo('VIDEO_ID')
console.log(info.basic_info)
```

### Common Issues

**"Cannot play video file"**:
- Check `webSecurity: false` in main.ts
- Verify file exists: `ls ~/Library/Application Support/TubeCrawler/downloads/`

**"Download stuck at 0%"**:
- Check network connection
- Verify URL is valid YouTube link
- Check logs: Console in Electron DevTools

**"Database locked"**:
- Ensure only one app instance running
- Check for zombie processes: `ps aux | grep Electron`

---

## Performance Considerations

### Rendering
- Use virtual scrolling for >100 videos (consider `svelte-virtual-list`)
- Lazy load thumbnails with IntersectionObserver
- Debounce search input (300ms)

### Downloads
- Limit concurrent downloads to 2
- Queue additional downloads
- Stream progress updates (throttle to 100ms)

### Database
- Use prepared statements for repeated queries
- Index frequently queried columns
- Batch inserts when possible

### Memory
- Close video player when not in use
- Clean up event listeners in components
- Limit stored thumbnails (delete old ones)

---

## Security Notes

### Electron Security Checklist
- ✅ `nodeIntegration: false`
- ✅ `contextIsolation: true`
- ✅ `sandbox: true`
- ⚠️ `webSecurity: false` (required for local files)
- ✅ Use `contextBridge` for IPC

### Input Validation
- Validate all YouTube URLs before processing
- Use parameterized SQL queries (better-sqlite3 handles this)
- Sanitize file paths before file operations

### External Dependencies
- None! Youtube.js is bundled with the app
- npm packages: Regular `npm audit` and updates

---

## Build & Distribution

### macOS App Bundle
```bash
# Build app
npm run build

# Package .app
npm run package

# Create .dmg installer
npm run make
```

### Code Signing (Optional)
```bash
# Set up in electron-builder.yml
mac:
  identity: "Developer ID Application: Your Name"
  hardenedRuntime: true
  entitlements: "resources/entitlements.plist"
```

### Notarization (Optional)
Required for distribution outside App Store. Configure in `electron-builder.yml`.

---

## Testing Strategy

### Unit Tests
- All services (`src/main/services/*.service.ts`)
- Utility functions (`src/main/utils/*.ts`, `src/renderer/lib/*.ts`)
- Framework: Vitest or Jest

### Integration Tests
- IPC communication flows
- Database operations
- File system operations

### E2E Tests
- Add video → Download → Play → Delete
- Search and filtering
- Error handling scenarios

**Not Included in MVP**: Automated E2E tests (manual testing sufficient for personal use)

---

## External Documentation

### Key Libraries
- **Electron**: https://www.electronjs.org/docs
- **Svelte**: https://svelte.dev/docs
- **Vite**: https://vitejs.dev/guide
- **Plyr**: https://github.com/sampotts/plyr
- **better-sqlite3**: https://github.com/WiseLibs/better-sqlite3
- **Youtube.js**: https://github.com/LuanRT/YouTube.js

### Helpful Resources
- Electron + Vite template: https://github.com/electron-vite/electron-vite-vue
- Svelte + TypeScript: https://svelte.dev/docs/typescript
- Tailwind with Svelte: https://tailwindcss.com/docs/guides/sveltekit

---

## Project Roadmap

### MVP (Phase 1) ✓
- Add videos via URL
- Download with progress tracking
- Play videos offline
- Search by title
- Delete videos

### Future Features (Phase 2+)
- Playlist organization
- Tags and categories
- Subtitle support
- Export/import library
- Playback controls (speed, repeat)
- Keyboard shortcuts
- Cloud sync
- Video quality selection
- Batch operations

---

## Contact & Support

**Project Type**: Personal use only
**Platform**: macOS 10.15+
**License**: Not for public distribution

For issues or questions, refer to:
- PRD: `claudedocs/PRD.md`
- GitHub Issues: (if repository is public)
- Youtube.js issues: https://github.com/LuanRT/YouTube.js/issues
