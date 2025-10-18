import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { databaseService } from './services/database.service.js'
import { downloadService } from './services/download.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const execAsync = promisify(exec)

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Required for local file access (TODO: use custom protocol in production)
    },
    backgroundColor: '#1a1a1a',
    title: 'Tube Crawler'
  })

  // Load Vite dev server in development, or built files in production
  const isDev = !app.isPackaged

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Initialize database
  databaseService.initialize()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  databaseService.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers

/**
 * Add video by URL - fetch metadata using yt-dlp
 */
ipcMain.handle('video:add', async (event, url: string) => {
  try {
    console.log('Fetching metadata for:', url)

    // Execute yt-dlp to get metadata
    const { stdout } = await execAsync(
      `yt-dlp --dump-json --no-warnings "${url}"`
    )

    const data = JSON.parse(stdout)

    // Check for duplicates
    const existing = databaseService.getVideoByVideoId(data.id)
    if (existing) {
      throw new Error('Video already added')
    }

    // Add to database
    const video = databaseService.addVideo({
      videoId: data.id,
      url: url,
      title: data.title || 'Untitled',
      thumbnailUrl: data.thumbnail || '',
      duration: data.duration || 0,
      channelName: data.uploader || data.channel || 'Unknown',
      description: data.description,
      uploadDate: data.upload_date
    })

    console.log('Video added:', video.title)

    // Return in format compatible with frontend
    return {
      success: true,
      video: {
        id: video.videoId,
        url: video.url,
        title: video.title,
        thumbnail: video.thumbnailUrl,
        duration: video.duration,
        channel: video.channelName
      }
    }
  } catch (error) {
    console.error('Error adding video:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add video'
    }
  }
})

/**
 * Get all videos
 */
ipcMain.handle('video:getAll', async () => {
  try {
    const dbVideos = databaseService.getAllVideos()

    // Convert to frontend format
    const videos = dbVideos.map(v => ({
      id: v.videoId,
      url: v.url,
      title: v.title,
      thumbnail: v.thumbnailUrl,
      duration: v.duration,
      channel: v.channelName,
      filePath: v.filePath || undefined
    }))

    return { success: true, videos }
  } catch (error) {
    console.error('Error getting videos:', error)
    return { success: false, error: 'Failed to get videos' }
  }
})

/**
 * Delete video
 */
ipcMain.handle('video:delete', async (event, videoId: string) => {
  try {
    const video = databaseService.getVideoByVideoId(videoId)
    if (!video) {
      throw new Error('Video not found')
    }

    databaseService.deleteVideo(video.id)
    console.log('Video deleted:', videoId)
    return { success: true }
  } catch (error) {
    console.error('Error deleting video:', error)
    return { success: false, error: 'Failed to delete video' }
  }
})

/**
 * Check if yt-dlp is installed
 */
ipcMain.handle('system:checkYtDlp', async () => {
  try {
    await execAsync('yt-dlp --version')
    return { success: true, installed: true }
  } catch (error) {
    return {
      success: false,
      installed: false,
      error: 'yt-dlp not found. Please install: brew install yt-dlp'
    }
  }
})

/**
 * Download video
 */
ipcMain.handle('video:download', async (event, videoId: string, url: string) => {
  try {
    console.log('Starting download for:', videoId)

    const result = await downloadService.downloadVideo(videoId, url, (progress) => {
      // Send progress updates to renderer
      event.sender.send('download:progress', { videoId, progress })
    })

    console.log('Download completed:', videoId, result.filePath)
    return { success: true, ...result }
  } catch (error) {
    console.error('Error downloading video:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download video'
    }
  }
})

/**
 * Cancel download
 */
ipcMain.handle('video:cancelDownload', async (event, videoId: string) => {
  try {
    const cancelled = downloadService.cancelDownload(videoId)
    return { success: true, cancelled }
  } catch (error) {
    console.error('Error cancelling download:', error)
    return { success: false, error: 'Failed to cancel download' }
  }
})

/**
 * Get downloads path
 */
ipcMain.handle('system:getDownloadsPath', async () => {
  try {
    const downloadsPath = downloadService.getDownloadsPath()
    return { success: true, path: downloadsPath }
  } catch (error) {
    return { success: false, error: 'Failed to get downloads path' }
  }
})
