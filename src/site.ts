import './bootstrap-lite.css'
import './style.css'
import { startIconHydration } from './icons'
import { loadBrandFolders, loadHomepageTickers, syncLiveCacheVersion } from './live-data'

startIconHydration()

let liveWarmTimer: number | null = null

const warmPrimaryLiveData = () => {
  void syncLiveCacheVersion().finally(() => {
    void loadBrandFolders()
    void loadHomepageTickers()
  })
}

const schedulePrimaryLiveWarm = (delay = 140) => {
  if (typeof window === 'undefined') return

  if (liveWarmTimer !== null) {
    window.clearTimeout(liveWarmTimer)
  }

  liveWarmTimer = window.setTimeout(() => {
    liveWarmTimer = null
    warmPrimaryLiveData()
  }, delay)
}

if (typeof window !== 'undefined') {
  schedulePrimaryLiveWarm()

  window.addEventListener('focus', () => {
    schedulePrimaryLiveWarm(80)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      schedulePrimaryLiveWarm(80)
    }
  })
}

export { renderPage } from './site-portal'
export { renderRemoteServicePage } from './site-portal'
export {
  renderAnaAn00ListPage,
  renderDownloadFlowDetailPage,
  renderDownloadPage,
  renderDownloadsHubPage,
  renderFirmwareHuaweiPage,
  renderHuaweiUpdateFoldersPage,
  renderSolutionFilesPage,
} from './site-download'
