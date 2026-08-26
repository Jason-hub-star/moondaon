import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

/** dev 전용 씬 저장 — ?edit=1 편집기가 POST한 코드 블록으로 sceneProps.tsx의 마커 구간을 재작성한다. */
function sceneSave(): Plugin {
  let justSaved = 0
  return {
    name: 'scene-save',
    apply: 'serve',
    // 편집기 저장 직후의 HMR 푸시만 막는다 — 단 모듈 캐시는 무효화해서 다음 로드가 새 코드를 받게 한다
    // (invalidate 없이 []만 반환하면 vite가 옛 transform을 계속 서빙해 새로고침도 stale — 실측 2026-08-27)
    handleHotUpdate(ctx) {
      if (ctx.file.endsWith('scene/sceneProps.tsx') && Date.now() - justSaved < 2000) {
        ctx.modules.forEach((m) => ctx.server.moduleGraph.invalidateModule(m))
        return []
      }
    },
    configureServer(server) {
      server.middlewares.use('/__scene-save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const { props, walls } = JSON.parse(body) as { props?: string; walls?: string }
            const file = path.resolve(ROOT, 'src/scene/sceneProps.tsx')
            let src = fs.readFileSync(file, 'utf8')
            if (props) src = src.replace(/(\/\/ <scene-props>\n)[\s\S]*?(\n\/\/ <\/scene-props>)/, `$1${props}$2`)
            if (walls) src = src.replace(/(\/\/ <wall-params>\n)[\s\S]*?(\n\/\/ <\/wall-params>)/, `$1${walls}$2`)
            justSaved = Date.now()
            fs.writeFileSync(file, src)
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String(e))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sceneSave()],
})
