const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  video: {
    add: (url: string) => ipcRenderer.invoke('video:add', url),
    getAll: () => ipcRenderer.invoke('video:getAll'),
    search: (query: string) => ipcRenderer.invoke('video:search', query),
    searchYouTube: (query: string) => ipcRenderer.invoke('video:searchYouTube', query),
    delete: (videoId: string) => ipcRenderer.invoke('video:delete', videoId),
    download: (videoId: string, url: string) => ipcRenderer.invoke('video:download', videoId, url),
    cancelDownload: (videoId: string) => ipcRenderer.invoke('video:cancelDownload', videoId),
    onDownloadProgress: (callback: (data: { videoId: string; progress: number }) => void) => {
      ipcRenderer.on('download:progress', (_event: any, data: { videoId: string; progress: number }) => callback(data))
    }
  },
  system: {
    checkYtDlp: () => ipcRenderer.invoke('system:checkYtDlp'),
    getDownloadsPath: () => ipcRenderer.invoke('system:getDownloadsPath')
  }
})
