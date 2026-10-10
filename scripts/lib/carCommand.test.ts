// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Logger } from '@gltf-transform/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildCarFixture, fixtureConfig } from './carFixture.ts'
import { createIO, runCar } from './carCommand.ts'
import { CarError } from './carTypes.ts'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'car-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function writeFixture(): Promise<string> {
  const sourceDir = join(dir, 'src')
  await mkdir(sourceDir)
  await (await createIO()).write(join(sourceDir, 'scene.gltf'), await buildCarFixture())
  return sourceDir
}

describe('runCar', () => {
  it('writes a meshopt-compressed glb that keeps the four wheels', async () => {
    const sourceDir = await writeFixture()
    const outFile = join(dir, 'out', 'car.glb')
    const lines: string[] = []
    const result = await runCar({ sourceDir, outFile, config: fixtureConfig(), log: (line) => lines.push(line) })
    expect(lines.join('\n')).toContain('car_wheel_FL_car_tire_0')
    expect(result.bytes).toBe((await stat(outFile)).size)

    const doc = await (await createIO()).read(outFile)
    const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)
    expect(used).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'EXT_texture_webp', 'KHR_materials_clearcoat']))
    const wheels = doc.getRoot().listNodes().map((node) => node.getExtras().wheel).filter((wheel) => wheel !== undefined)
    expect(wheels.sort()).toEqual(['BL', 'BR', 'FL', 'FR'])
  }, 30_000)

  it('reads the model with warnings-only logging already in place', async () => {
    const sourceDir = await writeFixture()
    const doc = await (await createIO()).read(join(sourceDir, 'scene.gltf'))
    expect(doc.getLogger()).toHaveProperty('verbosity', Logger.Verbosity.WARN)
  })

  it('explains how to get the model when the folder is missing', async () => {
    const run = () => runCar({ sourceDir: join(dir, 'nope'), outFile: join(dir, 'car.glb'), config: fixtureConfig() })
    await expect(run()).rejects.toThrow(CarError)
    await expect(run()).rejects.toThrow(/Sketchfab/)
  })

  it('passes on folder errors other than a missing folder', async () => {
    const notAFolder = join(dir, 'scene.gltf')
    await writeFile(notAFolder, '{}')
    const error = await runCar({ sourceDir: notAFolder, outFile: join(dir, 'car.glb'), config: fixtureConfig() }).catch((caught: unknown) => caught)
    expect(error).not.toBeInstanceOf(CarError)
    expect(error).toHaveProperty('code', 'ENOTDIR')
  })

  it('explains a folder without a model file', async () => {
    await mkdir(join(dir, 'empty'))
    await expect(runCar({ sourceDir: join(dir, 'empty'), outFile: join(dir, 'car.glb'), config: fixtureConfig() })).rejects.toThrow(CarError)
  })

  it('refuses to guess between several model files', async () => {
    const sourceDir = await writeFixture()
    await writeFile(join(sourceDir, 'other.glb'), '')
    const run = () => runCar({ sourceDir, outFile: join(dir, 'car.glb'), config: fixtureConfig() })
    await expect(run()).rejects.toThrow(CarError)
    await expect(run()).rejects.toThrow(/other\.glb.*scene\.gltf/)
  })

  it('refuses to overwrite the old model with an oversized one', async () => {
    const sourceDir = await writeFixture()
    const outFile = join(dir, 'car.glb')
    await writeFile(outFile, 'old')
    const error = await runCar({ sourceDir, outFile, config: fixtureConfig({ maxBytes: 100 }) }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(CarError)
    expect(error).toHaveProperty('message', expect.stringMatching(/超过上限/))
    expect(await readFile(outFile, 'utf8')).toBe('old')
  }, 30_000)

  it('leaves no temporary file behind when the model cannot be put in place', async () => {
    const sourceDir = await writeFixture()
    const outFile = join(dir, 'car.glb')
    await mkdir(outFile)
    await writeFile(join(outFile, 'keep'), '')
    await expect(runCar({ sourceDir, outFile, config: fixtureConfig() })).rejects.toThrow()
    expect(await readdir(dir)).not.toContain('car.glb.tmp')
  }, 30_000)
})
