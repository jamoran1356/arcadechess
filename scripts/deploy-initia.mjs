#!/usr/bin/env node
/**
 * Deploy arcade_escrow.move to Initia testnet (initiation-2)
 *
 * Usage:
 *   node scripts/deploy-initia.mjs
 *
 * What it does:
 *   1. Derives deployer address from INITIA_ADMIN_SEED
 *   2. Compiles the Move module (needs initiad or Docker)
 *   3. Checks account balance (shows faucet URL if unfunded)
 *   4. Broadcasts MsgPublish on initiation-2
 *   5. Updates .env with the deployed contract address
 *
 * Module address after deploy = sender wallet address.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CONTRACT_DIR = resolve(ROOT, 'contracts/initia')
const CONTRACT_DIR_POSIX = CONTRACT_DIR.replace(/\\/g, '/')
const MOVE_TOML = resolve(CONTRACT_DIR, 'Move.toml')
const BUILD_DIR = resolve(CONTRACT_DIR, 'build/playchess_arcade/bytecode_modules')
const MV_FILE = resolve(BUILD_DIR, 'arcade_escrow_v2.mv')
const ENV_FILE = resolve(ROOT, '.env')

const REST_URL = 'https://rest.testnet.initia.xyz'
const FAUCET_URL = 'https://app.testnet.initia.xyz/faucet'
const EXPLORER = 'https://scan.testnet.initia.xyz/initiation-2'
const DOCKER_IMAGES = [
  'ghcr.io/initia-labs/initia:latest',
  'kantandadui/initia:latest',
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadEnv() {
  const lines = readFileSync(ENV_FILE, 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    // strip inline comments (e.g.  "" # comment)
    const commentIdx = val.indexOf('#')
    if (commentIdx !== -1) val = val.slice(0, commentIdx).trim()
    env[key] = val
  }
  return env
}

/**
 * Standard bech32 decode (no external lib needed).
 * Returns the raw bytes of the address.
 */
function bech32Decode(str) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
  const lower = str.toLowerCase()
  const pos = lower.lastIndexOf('1')
  const dataStr = lower.slice(pos + 1, lower.length - 6) // strip 6-char checksum
  const words = Array.from(dataStr).map(ch => {
    const idx = CHARSET.indexOf(ch)
    if (idx === -1) throw new Error(`Invalid bech32 char: ${ch}`)
    return idx
  })
  // 5-bit → 8-bit
  const bytes = []
  let acc = 0, bits = 0
  for (const v of words) {
    acc = (acc << 5) | v
    bits += 5
    while (bits >= 8) {
      bits -= 8
      bytes.push((acc >> bits) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

/**
 * Convert init1... bech32 to 32-byte 0x-prefixed hex (Move address format).
 * Cosmos addresses are 20 bytes; Move addresses are 32 bytes (left-pad zeros).
 */
function toMoveHex(bech32Addr) {
  const bytes = bech32Decode(bech32Addr) // 20 bytes
  const padded = Buffer.alloc(32, 0)
  bytes.copy(padded, 32 - bytes.length)
  return '0x' + padded.toString('hex')
}

function cmd(command, opts = {}) {
  return execSync(command, { stdio: 'pipe', ...opts }).toString().trim()
}

function tryExec(command) {
  try { execSync(command, { stdio: 'ignore' }); return true }
  catch { return false }
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`)
}

function extractUinitBalance(rawBalance) {
  // initia.js may return:
  // 1) Coin[]
  // 2) [Coin[] | stringified Coin[], pagination]
  // 3) Coins-like object
  const candidates = []

  if (Array.isArray(rawBalance)) {
    if (rawBalance.length > 0) candidates.push(rawBalance[0])
    candidates.push(rawBalance)
  } else {
    candidates.push(rawBalance)
  }

  for (const candidate of candidates) {
    let coins = candidate

    if (typeof coins === 'string') {
      try {
        coins = JSON.parse(coins)
      } catch {
        continue
      }
    }

    if (coins && typeof coins.toArray === 'function') {
      coins = coins.toArray()
    }

    if (!Array.isArray(coins)) continue

    const uinit = coins.find(c => c && c.denom === 'uinit')
    if (uinit) {
      const amount = Number(uinit.amount)
      return Number.isFinite(amount) ? amount : 0
    }
  }

  return 0
}

function setNamedAddressInMoveToml(moveHex) {
  const toml = readFileSync(MOVE_TOML, 'utf8')
  const pattern = /playchess\s*=\s*"[^"]*"/
  if (!pattern.test(toml)) {
    throw new Error('Could not update playchess named address in Move.toml')
  }
  const next = toml.replace(pattern, `playchess = "${moveHex}"`)
  writeFileSync(MOVE_TOML, next, 'utf8')
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('PlayChess — Initia Move Deploy Script')
  console.log('Target: initiation-2 testnet\n')

  const env = loadEnv()
  const mnemonic = env.INITIA_ADMIN_SEED
  const chainId  = env.NEXT_PUBLIC_INITIA_CHAIN_ID ?? 'initiation-2'

  if (!mnemonic) {
    console.error('✗ INITIA_ADMIN_SEED not set in .env')
    process.exit(1)
  }

  // ── 1. Load initia.js and derive address ──────────────────────────────────
  section('Step 1: Derive deployer address')

  let initiajs
  try {
    initiajs = await import('@initia/initia.js')
  } catch {
    console.error('✗ @initia/initia.js not installed. Run:')
    console.error('    pnpm add @initia/initia.js')
    process.exit(1)
  }

  const { RESTClient, MnemonicKey, MsgPublish, Wallet } = initiajs

  const key         = new MnemonicKey({ mnemonic: mnemonic.trim(), coinType: 60 })
  const senderBech32 = key.accAddress
  const moveHex     = toMoveHex(senderBech32)

  console.log('  Bech32  :', senderBech32)
  console.log('  Move hex:', moveHex)
  console.log(`  Scanner : ${EXPLORER}/accounts/${senderBech32}`)

  // ── 2. Compile Move module ────────────────────────────────────────────────
  section('Step 2: Compile Move module')

  // v0.2.x initiad doesn't support --named-addresses on move build,
  // so we stamp the deploy address into Move.toml before compilation.
  setNamedAddressInMoveToml(moveHex)

  if (existsSync(MV_FILE)) {
    console.log('  ✓ Bytecode already compiled:', MV_FILE)
  } else {
    console.log('  No compiled bytecode found — attempting compilation...')

    const hasInitiad = tryExec('initiad version')
    const hasDocker  = tryExec('docker info')

    if (hasInitiad) {
      console.log('  Using initiad...')
      execSync(
        `initiad move build --named-addresses playchess=${moveHex}`,
        { cwd: CONTRACT_DIR, stdio: 'inherit' }
      )
      console.log('  ✓ Compiled with initiad')

    } else if (hasDocker) {
      let builtWithDocker = false
      for (const image of DOCKER_IMAGES) {
        try {
          console.log(`  Using Docker image: ${image}`)
          execSync(
            `docker run --rm -v "${CONTRACT_DIR_POSIX}:/workspace" ` +
            `${image} ` +
            `initiad move build --path /workspace`,
            { stdio: 'inherit' }
          )
          builtWithDocker = true
          break
        } catch {
          console.log(`  Image failed: ${image}`)
        }
      }
      if (!builtWithDocker) {
        throw new Error('No Docker image could compile the Move package')
      }
      console.log('  ✓ Compiled with Docker')

    } else {
      console.error('\n  ✗ Neither initiad nor Docker is available.')
      console.error('\n  Option A — Install initiad (Linux/macOS/WSL):')
      console.error('    https://docs.initia.xyz/hackathon/get-started#step-6')
      console.error('\n  Option B — Install Docker Desktop:')
      console.error('    https://docs.docker.com/desktop/')
      console.error('\n  Option C — Build in WSL then copy .mv here:')
      console.error('    ' + MV_FILE)
      process.exit(1)
    }

    if (!existsSync(MV_FILE)) {
      console.error('  ✗ Compilation finished but .mv file not found at:', MV_FILE)
      console.error('  Check the module name in contracts/initia/build/')
      process.exit(1)
    }
  }

  // ── 3. Check balance ──────────────────────────────────────────────────────
  section('Step 3: Check account balance')

  const rest = new RESTClient(REST_URL, {
    chainId,
    gasPrices:     '0.15uinit',
    gasAdjustment: '1.75',
  })

  let uinitBalance = 0
  try {
    const balances = await rest.bank.balance(senderBech32)
    uinitBalance = extractUinitBalance(balances)
    console.log(`  Balance: ${uinitBalance} uinit  (${(uinitBalance / 1e6).toFixed(4)} INIT)`)
  } catch {
    console.log('  Account has no on-chain history yet (unfunded).')
  }

  const MIN_UINIT = 100_000 // 0.1 INIT
  if (uinitBalance < MIN_UINIT) {
    console.error(`\n  ✗ Balance too low (need ≥ ${MIN_UINIT} uinit).`)
    console.error('  Fund this address at the faucet:')
    console.error(`    ${FAUCET_URL}`)
    console.error(`    Address: ${senderBech32}`)
    console.error('\n  Then re-run:  node scripts/deploy-initia.mjs')
    process.exit(1)
  }

  // ── 4. Publish ────────────────────────────────────────────────────────────
  section('Step 4: Broadcast MsgPublish')

  const bytecode  = readFileSync(MV_FILE)
  const codeB64   = bytecode.toString('base64')

  // Testnet: use COMPATIBLE for iterative development.
  const msg       = new MsgPublish(senderBech32, [codeB64], MsgPublish.Policy.COMPATIBLE)
  const wallet    = new Wallet(rest, key)

  console.log('  Signing and broadcasting...')
  const signedTx = await wallet.createAndSignTx({
    msgs: [msg],
    memo: 'playchess::arcade_escrow publish',
  })
  const result = await rest.tx.broadcast(signedTx)

  if (result.code !== 0) {
    console.error('  ✗ Transaction failed (code', result.code + ')')
    console.error('  raw_log:', result.raw_log)
    process.exit(1)
  }

  console.log('  ✓ Published successfully!')
  console.log('  TxHash      :', result.txhash)
  console.log('  Module addr :', senderBech32)
  console.log('  Explorer tx :', `${EXPLORER}/txs/${result.txhash}`)
  console.log('  Module page :', `${EXPLORER}/accounts/${senderBech32}`)

  // ── 5. Update .env ────────────────────────────────────────────────────────
  section('Step 5: Update .env')

  let envContent = readFileSync(ENV_FILE, 'utf8')
  // Replace or append NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS
  if (/^NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS=/m.test(envContent)) {
    envContent = envContent.replace(
      /^NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS=.*$/m,
      `NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS="${senderBech32}"`
    )
  } else {
    envContent += `\nNEXT_PUBLIC_INITIA_CONTRACT_ADDRESS="${senderBech32}"\n`
  }
  writeFileSync(ENV_FILE, envContent, 'utf8')
  console.log(`  ✓ .env updated`)
  console.log(`  NEXT_PUBLIC_INITIA_CONTRACT_ADDRESS="${senderBech32}"`)

  console.log('\n✓ Deploy complete.\n')
}

main().catch(err => {
  console.error('\nFatal error:', err?.message ?? err)
  const data = err?.response?.data
  if (data) {
    try {
      console.error('Response data:', JSON.stringify(data, null, 2))
    } catch {
      console.error('Response data:', data)
    }
  }
  if (err?.stack) {
    console.error(err.stack)
  }
  process.exit(1)
})
