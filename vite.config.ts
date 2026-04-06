import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  server: {
    watch: {
      ignored: ['**/*.log'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        admin: 'admin.html',
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
