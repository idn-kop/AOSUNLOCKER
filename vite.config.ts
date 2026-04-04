import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/apps-script/**', '**/apps-script-public/**', '**/*.log'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        download: 'download.html',
        downloads: 'downloads.html',
        solutionFiles: 'solution-files.html',
        firmware: 'firmware.html',
        huaweiUpdate: 'huawei-update.html',
        anaAn00: 'ana-an00.html',
        huawei: 'huawei.html',
        honor: 'honor.html',
        kirinTools: 'kirin-tools.html',
        harmonyosFiles: 'harmonyos-files.html',
        remoteService: 'remote-service.html',
      },
    },
  },
})
