import { mkdir, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Logger, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { describeCar, processCar } from './carModel.ts'
import { CarError, type CarConfig } from './carTypes.ts'

export async function findSource(dir: string): Promise<string> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    throw new CarError(`找不到 ${dir}。请登录 Sketchfab，以 glTF 格式下载「Fictional supercar - V12 Goblin」，解压到这个文件夹。`)
  }
  const model = names.find((name) => /\.(gltf|glb)$/i.test(name))
  if (!model) throw new CarError(`${dir} 里没有 .gltf 或 .glb 文件。请把 Sketchfab 下载的压缩包完整解压到这里。`)
  return join(dir, model)
}

export async function createIO(): Promise<NodeIO> {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
}

export interface CarRunOptions {
  sourceDir: string
  outFile: string
  config: CarConfig
  log?: (line: string) => void
}

export interface CarRunResult {
  bytes: number
  meshes: string[]
  materials: string[]
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)

export async function runCar({ sourceDir, outFile, config, log = () => {} }: CarRunOptions): Promise<CarRunResult> {
  const source = await findSource(sourceDir)
  const io = await createIO()
  const doc = await io.read(source)
  doc.setLogger(new Logger(Logger.Verbosity.WARN))
  const report = describeCar(doc)
  log(`网格：${report.meshes.join('、')}`)
  log(`材质：${report.materials.join('、')}`)

  await processCar(doc, config)
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const glb = await io.writeBinary(doc)
  if (glb.byteLength > config.maxBytes) {
    throw new CarError(`生成的模型有 ${mb(glb.byteLength)} MB，超过上限 ${mb(config.maxBytes)} MB，没有写入 ${outFile}`)
  }
  await mkdir(dirname(outFile), { recursive: true })
  const temporary = `${outFile}.tmp`
  await writeFile(temporary, glb)
  await rename(temporary, outFile)
  return { bytes: glb.byteLength, ...report }
}
