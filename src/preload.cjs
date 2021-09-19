const { contextBridge, ipcRenderer } = require('electron')

let saveDirectory = getSavedDirectory()
function getSavedDirectory() {
  return ipcRenderer.sendSync('current-save-directory')
}
contextBridge.exposeInMainWorld('primo', {
  config: {
    getSavedDirectory,
    selectDirectory: async () => {
      ipcRenderer.send('set-save-directory')
      const { canceled, filePaths } = await new Promise((resolve) => {
        ipcRenderer.on('get-save-directory', (event, arg) => {
          resolve(arg)
        })
      })
      return canceled ? null : filePaths[0]
    },
    setHosts: (hosts) => {
      const success = ipcRenderer.sendSync('set-hosts', hosts)
      return success
    },
    getHosts: () => {
      const hosts = ipcRenderer.sendSync('get-hosts')
      return hosts
    }
  },
  data: {
    deleteSite: (siteID) => {
      ipcRenderer.sendSync('delete-site', siteID)
    },
    load: () => {
      const data = ipcRenderer.sendSync('load-data', saveDirectory)
      return data
    },
    save: (data) => {
      const success = ipcRenderer.sendSync('save-data', data)
      return success
    }
  }
})
