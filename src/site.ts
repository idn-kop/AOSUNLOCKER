import './bootstrap-lite.css'
import './style.css'
import { startIconHydration } from './icons'

startIconHydration()

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
