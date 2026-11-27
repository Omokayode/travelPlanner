#!/usr/bin/env node
// Prompts for a password (not echoed) and prints APP_PASSWORD_HASH=... to stdout, for the secrets file.
// Usage (prod):  docker run --rm -it omokayj/travelplanner:<ver> node scripts/hash-password.mjs >> <secrets file>
import { scryptSync, randomBytes } from 'node:crypto'

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
process.stdout.write(`APP_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${hash.toString('hex')}\n`)
console.error('Done. Restart the app to use it.')
