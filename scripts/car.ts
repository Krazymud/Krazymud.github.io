import { carConfig } from './car.config.ts'
import { runCar } from './lib/carCommand.ts'
import { CarError } from './lib/carTypes.ts'

const SOURCE_DIR = 'assets-src/car'
const OUT_FILE = 'public/models/car.glb'

try {
  const result = await runCar({ sourceDir: SOURCE_DIR, outFile: OUT_FILE, config: carConfig, log: (line) => console.log(line) })
  console.log(`已写入 ${OUT_FILE}（${(result.bytes / 1024 / 1024).toFixed(2)} MB）`)
} catch (error) {
  if (!(error instanceof CarError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
