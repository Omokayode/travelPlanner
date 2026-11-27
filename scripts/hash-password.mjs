#!/usr/bin/env node
// Prompts for a password (not echoed) and writes APP_PASSWORD_HASH=... for the env/secrets file.
//   node scripts/hash-password.mjs                  -> prints the line
//   node scripts/hash-password.mjs --append FILE    -> replaces/adds the line in FILE (mode 600)
// Use --append with `docker run -it`: a TTY mixes the prompts into stdout, so `>> file` would capture them.
// Docker: docker run --rm -it --user root -v "$PWD":/cfg <image> node scripts/hash-password.mjs --append /cfg/.env
import { scryptSync, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const appendIdx = process.argv.indexOf('--append')
const target = appendIdx > -1 ? process.argv[appendIdx + 1] : null
if (appendIdx > -1 && !target) {
  console.error('--append needs a file path')
  process.exit(2)
}

function ask(prompt) {
  return new Promise((resolve) => {
    process.stderr.write(prompt)
    const stdin = process.stdin
    let buf = ''
    if (stdin.isTTY) stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') process.exit(130)
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          stdin.removeListener('data', onData)
          if (stdin.isTTY) stdin.setRawMode(false)
          stdin.pause()
          process.stderr.write('\n')
          resolve(buf)
          return
        }
        if (ch === '\u007f' || ch === '\b') buf = buf.slice(0, -1)
        else buf += ch
      }
    }
    stdin.on('data', onData)
  })
}

const pw = await ask('New travelPlanner password (min 12 chars): ')
if (pw.length < 12) {
  console.error('Too short — use at least 12 characters.')
  process.exit(1)
}
if ((await ask('Again: ')) !== pw) {
  console.error('Passwords do not match.')
  process.exit(1)
}
const N = 16384
const r = 8
const p = 1
const salt = randomBytes(16)
const hash = scryptSync(pw, salt, 32, { N, r, p })
const line = `APP_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${hash.toString('hex')}`
if (target) {
  // keep every other line; replace an existing APP_PASSWORD_HASH line
  const kept = existsSync(target)
    ? readFileSync(target, 'utf8')
        .split('\n')
        .filter((l) => l !== '' && !l.startsWith('APP_PASSWORD_HASH='))
    : []
  writeFileSync(target, [...kept, line].join('\n') + '\n', { mode: 0o600 })
  chmodSync(target, 0o600) // mode above only applies to new files
  console.error(`Saved to ${target}. Restart the app to use it.`)
} else {
  process.stdout.write(line + '\n')
  console.error('Done. Put that line in your env file and restart the app.')
}
