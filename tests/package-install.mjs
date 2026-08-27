import { Buffer } from 'node:buffer'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { accessSync, constants, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'

const repositoryDirectory = resolve(import.meta.dirname, '..')
const packageMetadata = JSON.parse(readFileSync(join(repositoryDirectory, 'package.json'), 'utf8'))
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const maximumOutputBytes = 10 * 1024 * 1024
const tools = [
  { command: 'website-qa-http', name: 'http', tool: 'http-check', arguments: [] },
  { command: 'website-qa-crawl', name: 'crawl', tool: 'crawl-check', arguments: ['--max-pages=1', '--max-resources=5'] },
  { command: 'website-qa-browser', name: 'browser', tool: 'browser-check', arguments: ['--max-pages=1', '--max-requests=50', '--profiles=desktop'] },
  { command: 'website-qa-social', name: 'social', tool: 'social-preview-check', arguments: ['--max-pages=1', '--max-sitemaps=1'] },
  { command: 'website-qa-lighthouse', name: 'lighthouse', tool: 'lighthouse-check', arguments: ['--max-requests=100'] },
]

function terminateProcessTree(child) {
  if (!child.pid) {
    return
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-child.pid, 'SIGKILL')
  }
  catch {
    child.kill('SIGKILL')
  }
}

function run(command, arguments_, options = {}) {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 180_000
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd || repositoryDirectory,
      detached: process.platform !== 'win32',
      env: options.env || process.env,
      shell: options.shell || false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const output = { stderr: '', stdout: '' }
    let outputBytes = 0
    let terminationError
    const terminate = (error) => {
      if (!terminationError) {
        terminationError = error
        terminateProcessTree(child)
      }
    }
    const timer = setTimeout(() => {
      terminate(new Error(`${command} überschritt ${timeoutMilliseconds} ms.`))
    }, timeoutMilliseconds)

    const collect = key => (chunk) => {
      if (terminationError) {
        return
      }
      outputBytes += chunk.length
      if (outputBytes > maximumOutputBytes) {
        terminate(new Error(`${command} erzeugte mehr als ${maximumOutputBytes} Byte Ausgabe.`))
        return
      }
      output[key] += chunk.toString()
    }
    child.stdout.on('data', collect('stdout'))
    child.stderr.on('data', collect('stderr'))
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimeout(timer)
      if (terminationError) {
        reject(terminationError)
        return
      }
      resolvePromise({ ...output, code, signal })
    })
  })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function commandFailure(command, execution) {
  return `${command} endete mit ${execution.code ?? execution.signal}.\nSTDOUT:\n${execution.stdout}\nSTDERR:\n${execution.stderr}`
}

function isolatedNpmEnvironment(userConfig, globalConfig) {
  const environment = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toLowerCase().startsWith('npm_config_')) {
      environment[key] = value
    }
  }
  return {
    ...environment,
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_USERCONFIG: userConfig,
  }
}

function chromiumExecutable() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    process.env.WEBSITE_QA_CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    }
    catch {}
  }
  throw new Error('Kein Chromium-/Chrome-Binary für die Paketprüfung gefunden.')
}

function localFixture() {
  const methods = []
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const server = createServer((request, response) => {
    methods.push(request.method)
    const origin = `http://${request.headers.host}`
    const path = new URL(request.url, origin).pathname
    const headers = {
      'cache-control': 'no-store',
      'content-security-policy': `default-src 'self'; img-src 'self'; style-src 'unsafe-inline'`,
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-content-type-options': 'nosniff',
    }
    if (path === '/') {
      response.writeHead(200, { ...headers, 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Paketprüfung</title><meta name="description" content="Lokale, ausschließlich lesende Paketprüfung."><link rel="canonical" href="${origin}/"><meta property="og:title" content="Paketprüfung"><meta property="og:description" content="Lokale Paketprüfung"><meta property="og:type" content="website"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/preview.png"><style>body{font:18px/1.5 sans-serif;margin:2rem}main{max-width:70ch}</style></head><body><header><nav aria-label="Hauptnavigation"><a href="/">Startseite</a></nav></header><main><h1>Paketprüfung</h1><p>Installierter Tarball mit passiven GET-Prüfungen.</p></main></body></html>`)
      return
    }
    if (path === '/robots.txt') {
      response.writeHead(200, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
      response.end(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`)
      return
    }
    if (path === '/sitemap.xml') {
      response.writeHead(200, { ...headers, 'content-type': 'application/xml; charset=utf-8' })
      response.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`)
      return
    }
    if (path === '/preview.png' || path === '/favicon.ico') {
      response.writeHead(200, { ...headers, 'content-length': png.length, 'content-type': 'image/png' })
      response.end(png)
      return
    }
    response.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
    response.end('Nicht gefunden')
  })
  return { methods, server }
}

async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  assert(address && typeof address === 'object', 'Der lokale Testserver besitzt keine Adresse.')
  return `http://127.0.0.1:${address.port}/`
}

async function close(server) {
  await new Promise((resolvePromise, reject) => server.close(error => error ? reject(error) : resolvePromise()))
}

function exportedSchema(consumerDirectory, name) {
  const requireFromConsumer = createRequire(join(consumerDirectory, 'package.json'))
  const path = requireFromConsumer.resolve(`${packageMetadata.name}/${name}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function reportValidator(consumerDirectory) {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  ajv.addSchema(exportedSchema(consumerDirectory, 'technical-report.common.schema.json'))
  for (const { name } of tools) {
    ajv.addSchema(exportedSchema(consumerDirectory, `${name}-report.schema.json`))
  }
  return ajv.compile(exportedSchema(consumerDirectory, 'technical-report.schema.json'))
}

async function main() {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'website-qa-package-'))
  const packageDirectory = join(temporaryDirectory, 'package')
  const consumerDirectory = join(temporaryDirectory, 'consumer')
  const reportDirectory = join(consumerDirectory, 'reports')
  const npmGlobalConfig = join(temporaryDirectory, 'global.npmrc')
  const npmUserConfig = join(temporaryDirectory, 'user.npmrc')
  const npmEnvironment = isolatedNpmEnvironment(npmUserConfig, npmGlobalConfig)
  const fixture = localFixture()
  let listening = false

  try {
    mkdirSync(packageDirectory)
    mkdirSync(consumerDirectory)
    mkdirSync(reportDirectory)
    writeFileSync(npmGlobalConfig, '')
    writeFileSync(npmUserConfig, '')
    writeFileSync(join(consumerDirectory, 'package.json'), JSON.stringify({ name: 'website-qa-package-consumer', private: true, version: '1.0.0' }, null, 2))

    const pack = await run(npmCommand, ['pack', '--json', '--ignore-scripts=true', '--pack-destination', packageDirectory], {
      env: npmEnvironment,
      timeoutMilliseconds: 300_000,
    })
    assert(pack.code === 0, commandFailure('npm pack', pack))
    let packResult
    try {
      packResult = JSON.parse(pack.stdout)
    }
    catch {
      throw new Error(`npm pack erzeugte keine strukturierte Ausgabe:\n${pack.stdout}`)
    }
    assert(Array.isArray(packResult) && packResult.length === 1, `npm pack meldete ${packResult?.length ?? 'keine'} Tarballs.`)
    const tarballName = packResult[0].filename
    assert(typeof tarballName === 'string' && tarballName.endsWith('.tgz'), `npm pack meldete keinen Tarball:\n${pack.stdout}`)
    const tarballPath = join(packageDirectory, basename(tarballName))
    const tarball = readFileSync(tarballPath)
    const tarballShasum = createHash('sha1').update(tarball).digest('hex')
    const tarballHash = createHash('sha256').update(tarball).digest('hex')
    assert(tarballShasum === packResult[0].shasum, 'Der erzeugte Tarball stimmt nicht mit der strukturierten npm-pack-Ausgabe überein.')

    const install = await run(npmCommand, [
      'install',
      '--audit=false',
      '--bin-links=true',
      '--fund=false',
      '--ignore-scripts=false',
      '--include=optional',
      '--package-lock=true',
      tarballPath,
    ], {
      cwd: consumerDirectory,
      env: npmEnvironment,
      timeoutMilliseconds: 300_000,
    })
    assert(install.code === 0, commandFailure('npm install', install))

    const installedPackageDirectory = join(consumerDirectory, 'node_modules', '@mktcode', 'website-qa')
    const installedMetadata = JSON.parse(readFileSync(join(installedPackageDirectory, 'package.json'), 'utf8'))
    assert(installedMetadata.name === packageMetadata.name, `Installierter Paketname ist ${installedMetadata.name}.`)
    assert(installedMetadata.version === packageMetadata.version, `Installierte Paketversion ist ${installedMetadata.version}.`)

    const chromiumPath = chromiumExecutable()
    const chromiumVersion = await run(chromiumPath, ['--version'])
    assert(chromiumVersion.code === 0, commandFailure(chromiumPath, chromiumVersion))
    const npmVersion = await run(npmCommand, ['--version'])
    assert(npmVersion.code === 0, commandFailure('npm --version', npmVersion))

    const target = await listen(fixture.server)
    listening = true
    const validate = reportValidator(consumerDirectory)
    const reportSummaries = []

    for (const tool of tools) {
      const binaryName = process.platform === 'win32' ? `${tool.command}.cmd` : tool.command
      const binary = join(consumerDirectory, 'node_modules', '.bin', binaryName)
      accessSync(binary, constants.X_OK)
      if (process.platform !== 'win32') {
        assert(realpathSync(binary).startsWith(`${installedPackageDirectory}/`), `${tool.command} verweist nicht in das installierte Paket.`)
      }
      // Installed commands run sequentially to keep browser resource use deterministic.
      // oxlint-disable-next-line no-await-in-loop
      const help = await run(binary, ['--help'], { cwd: consumerDirectory, shell: process.platform === 'win32' })
      assert(help.code === 0, commandFailure(`${tool.command} --help`, help))
      assert(help.stdout.includes(`${packageMetadata.name} ${packageMetadata.version}`), `${tool.command} dokumentiert nicht ${packageMetadata.name} ${packageMetadata.version}.`)

      const reportPath = join(reportDirectory, `${tool.name}.json`)
      const browserArguments = ['browser', 'lighthouse'].includes(tool.name) ? [`--chromium-path=${chromiumPath}`] : []
      const requestOffset = fixture.methods.length
      // oxlint-disable-next-line no-await-in-loop
      const execution = await run(binary, [
        target,
        '--allow-http',
        '--allow-private',
        ...tool.arguments,
        ...browserArguments,
        `--json-file=${reportPath}`,
      ], { cwd: consumerDirectory, shell: process.platform === 'win32', timeoutMilliseconds: 180_000 })
      assert(execution.code === 0 || execution.code === 1, commandFailure(tool.command, execution))
      const observedMethods = fixture.methods.slice(requestOffset)
      assert(observedMethods.length > 0, `${tool.command} hat den lokalen Testserver nicht abgerufen.`)
      assert(observedMethods.every(method => method === 'GET'), `${tool.command} erzeugte Nicht-GET-Methoden: ${observedMethods.join(', ')}`)
      const report = JSON.parse(readFileSync(reportPath, 'utf8'))
      assert(validate(report), `${tool.command} erzeugte keinen gültigen Paketbericht:\n${JSON.stringify(validate.errors, null, 2)}`)
      assert(report.tool === tool.tool, `${tool.command} meldete das Werkzeug ${report.tool}.`)
      assert(report.toolPackage?.name === packageMetadata.name, `${tool.command} meldete einen falschen Paketnamen.`)
      assert(report.toolPackage?.version === packageMetadata.version, `${tool.command} meldete die Version ${report.toolPackage?.version}.`)
      reportSummaries.push(`${tool.command}: Exit ${execution.code}, ${observedMethods.length} × GET, Schema gültig`)
    }

    assert(fixture.methods.length > 0, 'Die installierten Prüfer haben den lokalen Server nicht abgerufen.')

    console.info(`Node.js: ${process.version}`)
    console.info(`npm: ${npmVersion.stdout.trim()}`)
    console.info(`Chromium: ${chromiumVersion.stdout.trim()}`)
    console.info(`Paket: ${packageMetadata.name}@${packageMetadata.version}`)
    console.info(`Tarball: ${tarballName}`)
    console.info(`SHA-256: ${tarballHash}`)
    for (const summary of reportSummaries) {
      console.info(summary)
    }
    console.info(`Beobachtete Servermethoden: ${fixture.methods.length} × GET`)
  }
  finally {
    try {
      if (listening) {
        await close(fixture.server)
      }
    }
    finally {
      rmSync(temporaryDirectory, { force: true, recursive: true })
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
