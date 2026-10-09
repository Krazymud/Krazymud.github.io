// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  it('explains how to get the model when the folder is missing', async () => {
    await expect(runCar({ sourceDir: join(dir, 'nope'), outFile: join(dir, 'car.glb'), config: fixtureConfig() })).rejects.toThrow(/Sketchfab/)
  })

  it('explains a folder without a model file', async () => {
    await mkdir(join(dir, 'empty'))
    await expect(runCar({ sourceDir: join(dir, 'empty'), outFile: join(dir, 'car.glb'), config: fixtureConfig() })).rejects.toThrow(CarError)
  })

  it('refuses to overwrite the old model with an oversized one', async () => {
    const sourceDir = await writeFixture()
    const outFile = join(dir, 'car.glb')
    await writeFile(outFile, 'old')
    await expect(runCar({ sourceDir, outFile, config: fixtureConfig({ maxBytes: 100 }) })).rejects.toThrow(/超过上限/)
    expect(await readFile(outFile, 'utf8')).toBe('old')
  }, 30_000)
})
