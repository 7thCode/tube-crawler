import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface Video {
  id: number
  videoId: string
  url: string
  title: string
  description?: string
  thumbnailUrl: string
  thumbnailPath?: string
  duration: number
  channelName: string
  uploadDate?: string
  filePath?: string
  fileSize?: number
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed'
  downloadProgress: number
  createdAt: string
  updatedAt: string
}

interface DbVideo {
  id: number
  video_id: string
  url: string
  title: string
  description?: string
  thumbnail_url: string
  thumbnail_path?: string
  duration: number
  channel_name: string
  upload_date?: string
  file_path?: string
  file_size?: number
  download_status: 'pending' | 'downloading' | 'completed' | 'failed'
  download_progress: number
  created_at: string
  updated_at: string
}

class DatabaseService {
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    // Use app's userData directory for database
    const userDataPath = app.getPath('userData')
    const dbDir = path.join(userDataPath, 'database')

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    this.dbPath = path.join(dbDir, 'videos.db')
    console.log('Database path:', this.dbPath)
  }

  /**
   * Convert database row (snake_case) to application object (camelCase)
   */
  private mapDbVideoToVideo(dbVideo: DbVideo): Video {
    return {
      id: dbVideo.id,
      videoId: dbVideo.video_id,
      url: dbVideo.url,
      title: dbVideo.title,
      description: dbVideo.description,
      thumbnailUrl: dbVideo.thumbnail_url,
      thumbnailPath: dbVideo.thumbnail_path,
      duration: dbVideo.duration,
      channelName: dbVideo.channel_name,
      uploadDate: dbVideo.upload_date,
      filePath: dbVideo.file_path,
      fileSize: dbVideo.file_size,
      downloadStatus: dbVideo.download_status,
      downloadProgress: dbVideo.download_progress,
      createdAt: dbVideo.created_at,
      updatedAt: dbVideo.updated_at
    }
  }

  initialize() {
    this.db = new Database(this.dbPath)
    this.createTables()
    console.log('Database initialized')
  }

  private createTables() {
    if (!this.db) throw new Error('Database not initialized')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT UNIQUE NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        thumbnail_path TEXT,
        duration INTEGER,
        channel_name TEXT,
        upload_date TEXT,
        file_path TEXT,
        file_size INTEGER,
        download_status TEXT DEFAULT 'pending',
        download_progress INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_video_id ON videos(video_id);
      CREATE INDEX IF NOT EXISTS idx_title ON videos(title);
      CREATE INDEX IF NOT EXISTS idx_download_status ON videos(download_status);

      CREATE TRIGGER IF NOT EXISTS update_videos_timestamp
      AFTER UPDATE ON videos
      BEGIN
        UPDATE videos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `)
  }

  addVideo(metadata: {
    videoId: string
    url: string
    title: string
    thumbnailUrl: string
    duration: number
    channelName: string
    description?: string
    uploadDate?: string
  }): Video {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      INSERT INTO videos (
        video_id, url, title, description, thumbnail_url,
        duration, channel_name, upload_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const info = stmt.run(
      metadata.videoId,
      metadata.url,
      metadata.title,
      metadata.description || null,
      metadata.thumbnailUrl,
      metadata.duration,
      metadata.channelName,
      metadata.uploadDate || null
    )

    return this.getVideoById(info.lastInsertRowid as number)!
  }

  getVideoById(id: number): Video | undefined {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('SELECT * FROM videos WHERE id = ?')
    const dbVideo = stmt.get(id) as DbVideo | undefined
    return dbVideo ? this.mapDbVideoToVideo(dbVideo) : undefined
  }

  getVideoByVideoId(videoId: string): Video | undefined {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('SELECT * FROM videos WHERE video_id = ?')
    const dbVideo = stmt.get(videoId) as DbVideo | undefined
    return dbVideo ? this.mapDbVideoToVideo(dbVideo) : undefined
  }

  getAllVideos(): Video[] {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('SELECT * FROM videos ORDER BY created_at DESC')
    const dbVideos = stmt.all() as DbVideo[]
    return dbVideos.map(dbVideo => this.mapDbVideoToVideo(dbVideo))
  }

  searchVideos(query: string): Video[] {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      SELECT * FROM videos
      WHERE title LIKE ? OR channel_name LIKE ?
      ORDER BY created_at DESC
    `)
    const searchTerm = `%${query}%`
    const dbVideos = stmt.all(searchTerm, searchTerm) as DbVideo[]
    return dbVideos.map(dbVideo => this.mapDbVideoToVideo(dbVideo))
  }

  updateDownloadStatus(
    videoId: string,
    status: 'pending' | 'downloading' | 'completed' | 'failed',
    progress: number = 0
  ) {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      UPDATE videos
      SET download_status = ?, download_progress = ?
      WHERE video_id = ?
    `)
    stmt.run(status, progress, videoId)
  }

  updateDownloadComplete(videoId: string, filePath: string, fileSize: number) {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      UPDATE videos
      SET download_status = 'completed',
          download_progress = 100,
          file_path = ?,
          file_size = ?
      WHERE video_id = ?
    `)
    stmt.run(filePath, fileSize, videoId)
  }

  deleteVideo(id: number) {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('DELETE FROM videos WHERE id = ?')
    stmt.run(id)
  }

  deleteVideoByVideoId(videoId: string) {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('DELETE FROM videos WHERE video_id = ?')
    stmt.run(videoId)
  }

  close() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

export const databaseService = new DatabaseService()
