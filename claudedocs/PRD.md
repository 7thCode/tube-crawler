# Product Requirements Document: Tube Crawler

**Version**: 1.0
**Last Updated**: 2025-10-18
**Status**: Draft
**Project Type**: Desktop Application (macOS)

---

## 1. Executive Summary

### 1.1 Project Overview
Tube Crawler is a lightweight macOS desktop application built with Electron and Svelte that enables users to manage YouTube video collections for personal learning and research purposes. The application provides functionality to download, organize, and play YouTube videos offline.

### 1.2 Core Purpose
- Personal video library management for educational content
- Offline playback capability for research and learning
- Simple, intuitive interface inspired by Spotify

### 1.3 Target User
- Individual users conducting research or learning activities
- macOS users only (initial version)
- No public distribution (personal use)

---

## 2. Technical Stack

### 2.1 Confirmed Technologies

```yaml
Frontend Framework: Svelte + TypeScript
Build Tool: Vite
Desktop Platform: Electron
Video Player: Plyr
Video Downloader: yt-dlp (CLI)
Database: SQLite (better-sqlite3)
Styling: Tailwind CSS
Package Manager: npm/pnpm
```

### 2.2 Key Dependencies

```json
{
  "electron": "^28.0.0",
  "svelte": "^4.0.0",
  "vite": "^5.0.0",
  "better-sqlite3": "^9.0.0",
  "plyr": "^3.7.0",
  "tailwindcss": "^3.4.0"
}
```

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌───────────────────────────────────────────────────┐
│            Renderer Process (Svelte)              │
│  ┌─────────────────────────────────────────────┐  │
│  │         UI Layer (Components)               │  │
│  │  - VideoList, SearchBar, Player, AddVideo  │  │
│  ├─────────────────────────────────────────────┤  │
│  │         State Management (Stores)           │  │
│  │  - videosStore, playerStore, searchStore   │  │
│  └─────────────────────────────────────────────┘  │
└────────────────────┬──────────────────────────────┘
                     │ IPC Bridge (contextBridge)
                     │
┌────────────────────▼──────────────────────────────┐
│             Main Process (Node.js)                │
│  ┌─────────────────────────────────────────────┐  │
│  │            IPC Handlers Layer               │  │
│  │  - video:add, video:download, video:search │  │
│  ├─────────────────────────────────────────────┤  │
│  │            Services Layer                   │  │
│  │  - YtDlpService (metadata, download)       │  │
│  │  - DatabaseService (SQLite operations)     │  │
│  │  - FileService (storage management)        │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │  File System         │
         │  - SQLite DB         │
         │  - Downloaded Videos │
         │  - Thumbnails        │
         └──────────────────────┘
```

### 3.2 Process Communication (IPC)

```typescript
// Renderer → Main
ipcRenderer.invoke('video:add', url)
ipcRenderer.invoke('video:download', videoId)
ipcRenderer.invoke('video:getAll')
ipcRenderer.invoke('video:search', query)
ipcRenderer.invoke('video:delete', videoId)

// Main → Renderer (Events)
ipcRenderer.on('download:progress', (event, { videoId, progress }))
ipcRenderer.on('download:complete', (event, { videoId, filePath }))
ipcRenderer.on('download:error', (event, { videoId, error }))
```

---

## 4. Database Design

### 4.1 Schema Definition

```sql
-- Main videos table
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT UNIQUE NOT NULL,           -- YouTube video ID (e.g., 'dQw4w9WgXcQ')
  url TEXT NOT NULL,                       -- Full YouTube URL
  title TEXT NOT NULL,                     -- Video title
  description TEXT,                        -- Video description (optional)
  thumbnail_url TEXT,                      -- Remote thumbnail URL
  thumbnail_path TEXT,                     -- Local thumbnail file path
  duration INTEGER,                        -- Duration in seconds
  channel_name TEXT,                       -- Channel/uploader name
  upload_date TEXT,                        -- Original upload date (YYYY-MM-DD)
  file_path TEXT,                          -- Local video file path (null if not downloaded)
  file_size INTEGER,                       -- File size in bytes
  download_status TEXT DEFAULT 'pending',  -- pending/downloading/completed/failed
  download_progress INTEGER DEFAULT 0,     -- 0-100
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_video_id ON videos(video_id);
CREATE INDEX idx_title ON videos(title);
CREATE INDEX idx_download_status ON videos(download_status);
CREATE INDEX idx_created_at ON videos(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_videos_timestamp
AFTER UPDATE ON videos
BEGIN
  UPDATE videos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

### 4.2 Data Model

```typescript
interface Video {
  id: number;
  videoId: string;
  url: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  thumbnailPath?: string;
  duration: number; // seconds
  channelName: string;
  uploadDate: string;
  filePath?: string;
  fileSize?: number;
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed';
  downloadProgress: number; // 0-100
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. Core Features Specification

### 5.1 Feature: Add Video

**User Story**: As a user, I want to add YouTube videos to my library by pasting the URL.

**Acceptance Criteria**:
- User pastes YouTube URL into input field
- System validates URL format
- System fetches metadata using yt-dlp
- Video appears in library with thumbnail and metadata
- Duplicate URLs are detected and rejected

**Implementation Details**:
```typescript
// Main Process
async function addVideo(url: string): Promise<Video> {
  // 1. Validate YouTube URL
  // 2. Check for duplicates in database
  // 3. Execute: yt-dlp --dump-json <url>
  // 4. Parse JSON response
  // 5. Download thumbnail image
  // 6. Insert into SQLite database
  // 7. Return video object
}
```

**Error Handling**:
- Invalid URL → Show error toast
- Network error → Retry with exponential backoff
- Duplicate → Show "Already added" message

---

### 5.2 Feature: Download Video

**User Story**: As a user, I want to download videos in the highest quality for offline viewing.

**Acceptance Criteria**:
- Click download button on any video
- Progress bar shows download percentage
- Download happens in background
- User can continue browsing while downloading
- Downloaded video is playable immediately

**Implementation Details**:
```typescript
// Main Process
async function downloadVideo(videoId: string): Promise<void> {
  // 1. Update status to 'downloading'
  // 2. Execute: yt-dlp -f "bestvideo+bestaudio" --merge-output-format mp4 \
  //             --progress --newline <url> -o downloads/%(id)s.%(ext)s
  // 3. Parse progress output (regex: (\d+\.\d+)%)
  // 4. Send progress events to renderer
  // 5. On completion, update file_path and status
  // 6. Send completion event
}
```

**Storage Strategy**:
- Location: `~/Library/Application Support/TubeCrawler/downloads/`
- Format: `{video_id}.mp4` (always merge to MP4)
- Thumbnails: `~/Library/Application Support/TubeCrawler/thumbnails/{video_id}.jpg`

---

### 5.3 Feature: Video Playback

**User Story**: As a user, I want to play downloaded videos within the app.

**Acceptance Criteria**:
- Click play button on downloaded video
- Video loads in bottom player area
- Player controls: play/pause, seek, volume
- Player shows current time and total duration
- Can switch videos without closing player

**Implementation Details**:
```svelte
<!-- Renderer: VideoPlayer.svelte -->
<script lang="ts">
  import Plyr from 'plyr';

  export let video: Video;

  onMount(() => {
    const player = new Plyr('#player', {
      controls: ['play', 'progress', 'current-time', 'duration', 'volume']
    });
  });
</script>

<video id="player" src="file://{video.filePath}">
  <source src="file://{video.filePath}" type="video/mp4">
</video>
```

**File Protocol Handling**:
- Electron's `webSecurity: false` required for local file access
- Alternative: Use custom protocol `app://` for better security

---

### 5.4 Feature: Search Videos

**User Story**: As a user, I want to search my video library by title.

**Acceptance Criteria**:
- Search input at top of screen
- Results filter as user types (real-time)
- Search is case-insensitive
- Empty search shows all videos

**Implementation Details**:
```typescript
// Renderer: searchStore.ts
export const searchQuery = writable('');
export const filteredVideos = derived(
  [videosStore, searchQuery],
  ([$videos, $query]) => {
    if (!$query.trim()) return $videos;
    return $videos.filter(v =>
      v.title.toLowerCase().includes($query.toLowerCase())
    );
  }
);
```

**Performance Consideration**:
- For <1000 videos: Client-side filtering sufficient
- For >1000 videos: Move to SQLite LIKE query

---

### 5.5 Feature: Delete Video

**User Story**: As a user, I want to remove videos from my library and delete downloaded files.

**Acceptance Criteria**:
- Delete button on each video item
- Confirmation dialog before deletion
- Deletes database entry and video file
- Video disappears from list immediately

**Implementation Details**:
```typescript
// Main Process
async function deleteVideo(videoId: string): Promise<void> {
  // 1. Get video record from database
  // 2. Delete video file if exists (fs.unlink)
  // 3. Delete thumbnail file if exists
  // 4. Delete database record
  // 5. Send deletion event to renderer
}
```

---

## 6. User Interface Design

### 6.1 Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  🎬 Tube Crawler            [Search...]       ☰  🌙  │ ← Header (60px)
├─────────┬───────────────────────────────────────────┤
│         │  📎 Add Video URL:                         │
│         │  [_______________________________] [Add]   │ ← Add Section (80px)
│         │                                            │
│  Sidebar│  📹 My Videos (12)                         │
│         │  ┌──────────────────────────────────────┐ │
│  (120px)│  │ 🖼️  How to build Electron apps    ⬇️ │ │
│         │  │     25:30  [▶ Play] [🗑️]            │ │
│ Future: │  ├──────────────────────────────────────┤ │
│ - Home  │  │ 🖼️  Svelte Tutorial              ✅ │ │ ← Video List
│ - Lists │  │     15:45  [▶ Play] [🗑️]            │ │   (Scrollable)
│ - Tags  │  ├──────────────────────────────────────┤ │
│         │  │ 🖼️  TypeScript Deep Dive         ⏳ │ │
│         │  │     45:20  [⏸ 65%] [🗑️]            │ │
│         │  └──────────────────────────────────────┘ │
├─────────┴───────────────────────────────────────────┤
│  ▶ Now Playing: How to build Electron apps          │
│  ━━━━━━━━━━━━●──────────  [12:30/25:30]  🔊 ─────  │ ← Player (100px)
└─────────────────────────────────────────────────────┘
```

### 6.2 Color Scheme (Spotify-inspired)

```css
/* Dark Theme (Default) */
--bg-primary: #121212;      /* Main background */
--bg-secondary: #181818;    /* Sidebar, cards */
--bg-tertiary: #282828;     /* Hover states */
--text-primary: #FFFFFF;    /* Main text */
--text-secondary: #B3B3B3;  /* Secondary text */
--accent: #1DB954;          /* Primary action (green) */
--accent-hover: #1ED760;    /* Accent hover */
--error: #E22134;           /* Delete, errors */
--border: #282828;          /* Dividers */
```

### 6.3 Component Specifications

#### 6.3.1 VideoItem Component

```svelte
<!-- VideoItem.svelte -->
<div class="video-item">
  <img src={thumbnail} alt={title} class="thumbnail" />
  <div class="info">
    <h3 class="title">{title}</h3>
    <p class="meta">{channelName} • {formatDuration(duration)}</p>
  </div>
  <div class="actions">
    {#if downloadStatus === 'completed'}
      <button on:click={playVideo}>▶ Play</button>
    {:else if downloadStatus === 'downloading'}
      <progress value={downloadProgress} max="100">{downloadProgress}%</progress>
    {:else}
      <button on:click={downloadVideo}>⬇️ Download</button>
    {/if}
    <button on:click={deleteVideo} class="delete">🗑️</button>
  </div>
</div>

<!-- Dimensions: 100% width × 80px height -->
```

#### 6.3.2 AddVideoInput Component

```svelte
<!-- AddVideoInput.svelte -->
<div class="add-video-section">
  <label for="url-input">Add Video URL:</label>
  <div class="input-group">
    <input
      id="url-input"
      type="text"
      placeholder="https://www.youtube.com/watch?v=..."
      bind:value={url}
      on:keydown={handleEnter}
    />
    <button on:click={addVideo} disabled={!isValidUrl}>Add</button>
  </div>
  {#if error}
    <p class="error-message">{error}</p>
  {/if}
</div>
```

#### 6.3.3 VideoPlayer Component

```svelte
<!-- VideoPlayer.svelte -->
<div class="player-container">
  <div class="player-info">
    <span class="playing-label">▶ Now Playing:</span>
    <span class="video-title">{currentVideo.title}</span>
  </div>
  <video id="plyr-player" src="file://{currentVideo.filePath}"></video>
</div>

<!-- Fixed at bottom, 100px height -->
```

---

## 7. File System Organization

### 7.1 Project Structure

```
tube-crawler/
├── src/
│   ├── main/                       # Electron Main Process
│   │   ├── main.ts                 # Entry point, window management
│   │   ├── preload.ts              # Preload script for IPC bridge
│   │   ├── ipc/
│   │   │   ├── handlers.ts         # IPC handler registration
│   │   │   └── channels.ts         # IPC channel constants
│   │   ├── services/
│   │   │   ├── ytdlp.service.ts    # yt-dlp wrapper
│   │   │   ├── database.service.ts # SQLite operations
│   │   │   └── file.service.ts     # File system operations
│   │   └── utils/
│   │       ├── logger.ts           # Logging utility
│   │       └── config.ts           # App configuration
│   │
│   └── renderer/                   # Svelte Application
│       ├── App.svelte              # Root component
│       ├── main.ts                 # Renderer entry point
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.svelte
│       │   │   ├── Sidebar.svelte
│       │   │   └── MainContent.svelte
│       │   ├── video/
│       │   │   ├── VideoList.svelte
│       │   │   ├── VideoItem.svelte
│       │   │   ├── AddVideoInput.svelte
│       │   │   └── VideoPlayer.svelte
│       │   └── ui/
│       │       ├── SearchBar.svelte
│       │       ├── Button.svelte
│       │       └── ProgressBar.svelte
│       ├── stores/
│       │   ├── videos.store.ts     # Video list state
│       │   ├── player.store.ts     # Player state
│       │   └── search.store.ts     # Search state
│       ├── lib/
│       │   ├── api.ts              # IPC API wrapper
│       │   └── utils.ts            # Helper functions
│       └── styles/
│           └── global.css          # Global styles + Tailwind
│
├── resources/                      # Build resources
│   ├── icon.icns                   # macOS app icon
│   └── entitlements.plist          # macOS entitlements
│
├── claudedocs/                     # Documentation
│   ├── PRD.md                      # This file
│   └── ARCHITECTURE.md             # Technical details
│
├── electron-builder.yml            # Build configuration
├── vite.config.ts                  # Vite configuration
├── tailwind.config.js              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json
└── README.md
```

### 7.2 User Data Directories

```
~/Library/Application Support/TubeCrawler/
├── database/
│   └── videos.db                   # SQLite database
├── downloads/                      # Downloaded videos
│   ├── dQw4w9WgXcQ.mp4
│   └── jNQXAC9IVRw.mp4
├── thumbnails/                     # Cached thumbnails
│   ├── dQw4w9WgXcQ.jpg
│   └── jNQXAC9IVRw.jpg
└── logs/                           # Application logs
    └── app.log
```

---

## 8. Implementation Phases

### Phase 1: Project Setup & Infrastructure (Day 1)

**Tasks**:
1. Initialize Electron + Svelte + Vite project
2. Configure TypeScript for both processes
3. Set up Tailwind CSS
4. Install core dependencies
5. Create basic file structure
6. Set up SQLite database with schema
7. Verify yt-dlp installation

**Deliverables**:
- Runnable Electron app with blank window
- SQLite database initialized
- Development environment ready

---

### Phase 2: Backend Services (Day 2-3)

**Tasks**:
1. Implement DatabaseService
   - CRUD operations for videos
   - Search functionality
2. Implement YtDlpService
   - Metadata extraction
   - Download with progress tracking
3. Implement FileService
   - File storage management
   - Thumbnail caching
4. Set up IPC handlers
   - video:add, video:download, video:getAll, etc.
5. Implement error handling and logging

**Deliverables**:
- All backend services functional
- IPC communication working
- Unit tests for services

---

### Phase 3: Frontend UI (Day 4-5)

**Tasks**:
1. Build layout structure (Header, Sidebar, Main, Player)
2. Implement AddVideoInput component
3. Implement VideoList and VideoItem components
4. Implement SearchBar component
5. Set up Svelte stores
6. Integrate Plyr video player
7. Apply Tailwind styling (Spotify theme)

**Deliverables**:
- Complete UI implementation
- Responsive layout
- All components functional

---

### Phase 4: Integration & Testing (Day 6)

**Tasks**:
1. Connect frontend to backend via IPC
2. Test end-to-end flows:
   - Add video → Download → Play → Delete
3. Test search functionality
4. Test multiple concurrent downloads
5. Error handling and edge cases
6. Performance optimization

**Deliverables**:
- Fully functional MVP
- Bug-free core features
- Performance validated

---

### Phase 5: Build & Distribution (Day 7)

**Tasks**:
1. Configure electron-builder for macOS
2. Create app icon
3. Set up code signing (optional)
4. Build .dmg installer
5. Test installation on clean macOS
6. Document installation instructions

**Deliverables**:
- Installable .dmg file
- Installation guide
- User documentation

---

## 9. Development Guidelines

### 9.1 Coding Standards

**TypeScript**:
- Strict mode enabled
- Explicit return types for functions
- Interface over type for object shapes
- Use enums for status values

**Svelte**:
- Component filenames: PascalCase.svelte
- One component per file
- Props with TypeScript types
- Reactive statements ($:) for derived data

**File Naming**:
- TypeScript: camelCase.ts
- Services: name.service.ts
- Stores: name.store.ts
- Components: PascalCase.svelte

### 9.2 Git Workflow

**Branch Strategy**:
```
main              # Stable releases only
└── develop       # Active development
    ├── feature/add-video-ui
    ├── feature/download-service
    └── fix/player-bug
```

**Commit Message Format**:
```
<type>(<scope>): <subject>

Types: feat, fix, refactor, docs, style, test, chore
Example: feat(download): add progress tracking for video downloads
```

### 9.3 Testing Strategy

**Unit Tests**: Services and utility functions
**Integration Tests**: IPC communication
**E2E Tests**: User flows (add → download → play)

**Test Files**:
- Location: `__tests__/` next to source files
- Naming: `{filename}.test.ts`

---

## 10. Security Considerations

### 10.1 Electron Security

```typescript
// main.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,      // Disable Node in renderer
    contextIsolation: true,      // Enable context isolation
    sandbox: true,               // Enable sandbox
    webSecurity: false,          // Required for local file:// access
    preload: path.join(__dirname, 'preload.js')
  }
});
```

### 10.2 Data Validation

- Validate all YouTube URLs before processing
- Sanitize database inputs (parameterized queries)
- Validate file paths before file operations
- Check disk space before downloads

### 10.3 Error Handling

```typescript
// Example: Graceful error handling
try {
  const video = await ytdlpService.getMetadata(url);
} catch (error) {
  if (error instanceof NetworkError) {
    // Show retry option
  } else if (error instanceof InvalidUrlError) {
    // Show error message
  } else {
    // Log and show generic error
    logger.error('Unexpected error:', error);
  }
}
```

---

## 11. Performance Targets

### 11.1 Benchmarks

- **App Launch**: < 2 seconds
- **Add Video (metadata fetch)**: < 3 seconds
- **Search Response**: < 100ms (for 1000 videos)
- **Video Playback Start**: < 1 second
- **Memory Usage**: < 200MB idle, < 500MB during download

### 11.2 Optimization Strategies

- Lazy load video thumbnails (IntersectionObserver)
- Virtual scrolling for large video lists (>100 items)
- SQLite indexes on frequently queried columns
- Cache metadata to avoid repeated yt-dlp calls
- Limit concurrent downloads to 2

---

## 12. Future Enhancements (Post-MVP)

### Phase 2 Features
- Playlist organization
- Tags and categories
- Subtitle download and display
- Export/import library
- Playback speed control
- Keyboard shortcuts

### Phase 3 Features
- Cloud sync (iCloud, Google Drive)
- Advanced search filters
- Video quality selection
- Batch operations
- Statistics and insights

---

## 13. Dependencies & Requirements

### 13.1 System Requirements

**macOS Version**: 10.15 (Catalina) or later
**Disk Space**: 100MB app + storage for videos
**RAM**: 4GB minimum, 8GB recommended
**Internet**: Required for adding and downloading videos

### 13.2 External Dependencies

**Required**:
- `yt-dlp`: Install via Homebrew (`brew install yt-dlp`)
- `ffmpeg`: Install via Homebrew (`brew install ffmpeg`)

**Verification Script**:
```bash
#!/bin/bash
# check-dependencies.sh
command -v yt-dlp >/dev/null 2>&1 || { echo "yt-dlp not found. Install: brew install yt-dlp"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg not found. Install: brew install ffmpeg"; exit 1; }
echo "All dependencies installed ✓"
```

---

## 14. Success Metrics

### 14.1 MVP Success Criteria

- ✅ Can add YouTube videos via URL
- ✅ Can download videos in highest quality
- ✅ Can play downloaded videos smoothly
- ✅ Can search videos by title
- ✅ Can delete videos and files
- ✅ App launches and runs without crashes
- ✅ UI is intuitive and responsive

### 14.2 Quality Gates

- **Code Coverage**: >70% for services
- **Build Success**: Clean build with no warnings
- **Performance**: Meets all benchmarks in section 11.1
- **Memory Leaks**: None detected in 1-hour usage test

---

## 15. Known Limitations

### 15.1 Technical Constraints

- **YouTube Terms of Service**: Downloading content may violate ToS
- **Platform**: macOS only (no Windows/Linux initially)
- **Video Format**: MP4 only (no format selection)
- **Offline Only**: No streaming or online playback

### 15.2 Design Decisions

- **No Authentication**: No YouTube account integration
- **No Playlists**: Single flat list only (MVP)
- **No Editing**: Cannot trim or edit videos
- **No Sharing**: No export or share features

---

## Appendix A: API Reference

### A.1 IPC Channels

```typescript
// Main → Renderer
'video:added'                       // New video added
'download:progress'                 // Download progress update
'download:complete'                 // Download finished
'download:error'                    // Download failed

// Renderer → Main
'video:add'                         // Add new video by URL
'video:getAll'                      // Fetch all videos
'video:search'                      // Search videos
'video:download'                    // Download video
'video:delete'                      // Delete video
'app:openFolder'                    // Open downloads folder
```

### A.2 Database Queries

```typescript
// Common queries
interface DatabaseService {
  addVideo(metadata: VideoMetadata): Promise<Video>;
  getVideos(): Promise<Video[]>;
  getVideoById(id: number): Promise<Video | null>;
  searchVideos(query: string): Promise<Video[]>;
  updateDownloadStatus(id: number, status: DownloadStatus): Promise<void>;
  updateDownloadProgress(id: number, progress: number): Promise<void>;
  deleteVideo(id: number): Promise<void>;
}
```

---

## Document History

| Version | Date       | Author | Changes                    |
|---------|------------|--------|----------------------------|
| 1.0     | 2025-10-18 | Claude | Initial draft              |

---

**End of Document**
