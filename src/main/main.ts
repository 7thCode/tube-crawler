import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { databaseService } from './services/database.service.js'
import { downloadService } from './services/download.service.js'
import { youtubeService } from './services/youtube.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null

/**
 * Register custom protocol for serving local video files
 * This allows secure access to videos without disabling webSecurity
 */
function registerVideoProtocol() {
  protocol.registerFileProtocol('tube', (request, callback) => {
    // Extract file path from tube://video/{videoId}.mp4
    const url = request.url.substr(7) // Remove 'tube://'
    const videoPath = path.join(downloadService.getDownloadsPath(), url)

    console.log('📺 Custom protocol request:', request.url)
    console.log('📺 Serving file:', videoPath)

    // Verify file exists and is within downloads directory
    if (fs.existsSync(videoPath) && videoPath.startsWith(downloadService.getDownloadsPath())) {
      callback({ path: videoPath })
    } else {
      console.error('📺 File not found or unauthorized:', videoPath)
      callback({ error: -6 }) // FILE_NOT_FOUND
    }
  })

  console.log('📺 Custom protocol "tube://" registered')
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true // Using custom protocol for secure local file access
    },
    backgroundColor: '#1a1a1a',
    title: 'Tube Crawler'
  })

  // Load Vite dev server in development, or built files in production
  const isDev = !app.isPackaged

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools() // Disabled - press Cmd+Option+I to open manually
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Register custom protocol for video files
  registerVideoProtocol()

  // Initialize database
  databaseService.initialize()

  // Initialize Youtube.js client (singleton)
  await youtubeService.initialize()

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
 * Add video by URL - fetch metadata using Youtube.js
 */
ipcMain.handle('video:add', async (event, url: string) => {
  try {
    // Get Youtube.js client from singleton service
    const youtube = await youtubeService.getClient()

    console.log('Fetching metadata for:', url)

    // Extract video ID from URL
    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&\n?#]+)/)
    if (!videoIdMatch) {
      throw new Error('Invalid YouTube URL')
    }
    const videoId = videoIdMatch[1]

    // Get video info using Youtube.js
    const info = await youtube.getInfo(videoId)
    const basicInfo = info.basic_info

    // Check for duplicates
    const existing = databaseService.getVideoByVideoId(videoId)
    if (existing) {
      throw new Error('Video already added')
    }

    // Extract metadata
    const title = basicInfo.title || 'Untitled'
    const thumbnailUrl = basicInfo.thumbnail?.[0]?.url || ''
    const duration = basicInfo.duration || 0
    const channelName = basicInfo.author || 'Unknown'
    const description = basicInfo.short_description || ''
    const uploadDate = basicInfo.start_timestamp?.toISOString().split('T')[0] || ''

    // Add to database
    const video = databaseService.addVideo({
      videoId,
      url,
      title,
      thumbnailUrl,
      duration,
      channelName,
      description,
      uploadDate
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
      filePath: v.filePath || undefined,
      downloadStatus: v.downloadStatus,
      downloadProgress: v.downloadProgress,
      fileSize: v.fileSize || undefined
    }))

    return { success: true, videos }
  } catch (error) {
    console.error('Error getting videos:', error)
    return { success: false, error: 'Failed to get videos' }
  }
})

/**
 * Search videos in local database
 */
ipcMain.handle('video:search', async (event, query: string) => {
  try {
    console.log('Local search request received:', query)
    const dbVideos = databaseService.searchVideos(query)
    console.log('Local search results:', dbVideos.length, 'videos found')

    // Convert to frontend format
    const videos = dbVideos.map(v => ({
      id: v.videoId,
      url: v.url,
      title: v.title,
      thumbnail: v.thumbnailUrl,
      duration: v.duration,
      channel: v.channelName,
      filePath: v.filePath || undefined,
      downloadStatus: v.downloadStatus,
      downloadProgress: v.downloadProgress,
      fileSize: v.fileSize || undefined
    }))

    return { success: true, videos }
  } catch (error) {
    console.error('Error searching videos:', error)
    return { success: false, error: 'Failed to search videos' }
  }
})

/**
 * Search videos on YouTube
 */
ipcMain.handle('video:searchYouTube', async (event, query: string) => {
  try {
    // Get Youtube.js client from singleton service
    const youtube = await youtubeService.getClient()

    console.log('YouTube search request:', query)

    const searchResults = await youtube.search(query, { type: 'video' })
    const videos = searchResults.videos?.slice(0, 10).map((video: any) => ({
      id: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      title: video.title?.text || 'Untitled',
      thumbnail: video.thumbnails?.[0]?.url || video.best_thumbnail?.url || '',
      duration: video.duration?.seconds || 0,
      channel: video.author?.name || 'Unknown',
      viewCount: video.view_count?.text || '',
      publishedDate: video.published?.text || ''
    })) || []

    console.log('YouTube search results:', videos.length, 'videos found')

    return { success: true, videos }
  } catch (error) {
    console.error('Error searching YouTube:', error)
    return { success: false, error: 'Failed to search YouTube' }
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

    // Delete downloaded file if exists
    if (video.filePath && fs.existsSync(video.filePath)) {
      fs.unlinkSync(video.filePath)
      console.log('Deleted file:', video.filePath)
    }

    databaseService.deleteVideoByVideoId(videoId)
    console.log('Video deleted:', videoId)
    return { success: true }
  } catch (error) {
    console.error('Error deleting video:', error)
    return { success: false, error: 'Failed to delete video' }
  }
})

/**
 * Check system status (Youtube.js is bundled, no external dependencies needed)
 */
ipcMain.handle('system:checkYtDlp', async () => {
  // Youtube.js is bundled with the app, no external dependencies required
  return {
    success: true,
    installed: true,
    message: 'Using Youtube.js (no external dependencies required)'
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

    // Send completion event to trigger UI update
    event.sender.send('download:complete', { videoId, filePath: result.filePath })

    return { success: true, ...result }
  } catch (error) {
    console.error('Error downloading video:', error)

    // Send error event
    event.sender.send('download:error', { videoId, error: error instanceof Error ? error.message : 'Failed to download video' })

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

