// Assembles the built app into deploy/standalone/ for upload to the Infomaniak router
// (wcrpacademy/wcrp-academy-host, app "repo"), after `npm run build`.
// Usage: npm run build && npm run package:standalone
//
// Adapted from wcrpacademy/wcrp-academy's script of the same name — npm's node_modules is a plain
// nested tree (no pnpm-style `.pnpm` store of symlinks), so there's no link-dereferencing or
// hoisting step here, but the same safety checks apply: no .env files end up in the package, no
// links are left for the SFTP upload to silently drop, and server.js must find next/react/react-dom.
// - Adds what standalone leaves out: .next/static (browser files) and public/.
// Start on the server with:  node server.js   (PORT and HOSTNAME from the environment; see docs/hosting-plan.md)
import { createRequire } from 'node:module'
import { cpSync, existsSync, lstatSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')
const out = join(root, 'deploy', 'standalone')

if (!existsSync(join(standalone, 'server.js'))) {
  console.error("No build found: run `npm run build` first (next.config.ts has output: 'standalone').")
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })
cpSync(standalone, out, { recursive: true })
cpSync(join(root, '.next', 'static'), join(out, '.next', 'static'), { recursive: true })
if (existsSync(join(root, 'public'))) cpSync(join(root, 'public'), join(out, 'public'), { recursive: true })

// Safety: no environment files (secrets) in the upload — server settings belong in apps/repo/.env
// on the server, which the router copies into each release before starting it.
const envFiles = []
const walkForEnv = (dir, depth = 0) => {
  if (depth > 3) return
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name.startsWith('.env')) envFiles.push(p)
    else if (name !== 'node_modules' && statSync(p).isDirectory()) walkForEnv(p, depth + 1)
  }
}
walkForEnv(out)
if (envFiles.length) {
  console.error(`Refusing: environment files inside the package:\n${envFiles.join('\n')}`)
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}

// Safety: no links left (the SFTP upload skips them), and server.js must find its packages inside the package.
const links = []
const findLinks = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = lstatSync(p)
    if (s.isSymbolicLink()) links.push(p)
    else if (s.isDirectory()) findLinks(p)
  }
}
findLinks(out)
if (links.length) {
  console.error(`Refusing: ${links.length} links left in the package (the upload would skip them), e.g.\n${links.slice(0, 5).join('\n')}`)
  process.exit(1)
}
const requireFromServer = createRequire(join(out, 'server.js'))
for (const pkg of ['next', 'react', 'react-dom', 'next/dist/server/lib/start-server']) {
  try {
    const resolved = requireFromServer.resolve(pkg)
    if (!resolved.startsWith(out)) throw new Error(`found outside the package: ${resolved}`)
  } catch (err) {
    console.error(`Refusing: server.js cannot find "${pkg}" inside the package (${err.message}).`)
    process.exit(1)
  }
}

let bytes = 0
const size = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) size(p)
    else bytes += s.size
  }
}
size(out)
console.log(`Ready: deploy/standalone (${(bytes / 1e6).toFixed(1)} MB). Upload its contents; start with: node server.js`)
