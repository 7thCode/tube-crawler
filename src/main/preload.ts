const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  video: {
    add: (url) => ipcRenderer.invoke('video:add', url),
    getAll: () => ipcRenderer.invoke('video:getAll'),
    delete: (videoId) => ipcRenderer.invoke('video:delete', videoId),
    download: (videoId, url) => ipcRenderer.invoke('video:download', videoId, url),
    cancelDownload: (videoId) => ipcRenderer.invoke('video:cancelDownload', videoId),
    onDownloadProgress: (callback) => {
      ipcRenderer.on('download:progress', (event, data) => callback(data))
    }
  },
  system: {
    checkYtDlp: () => ipcRenderer.invoke('system:checkYtDlp'),
    getDownloadsPath: () => ipcRenderer.invoke('system:getDownloadsPath')
  }
})
