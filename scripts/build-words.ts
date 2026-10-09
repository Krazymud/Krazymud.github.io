import { createReadStream, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'csv-parse'
import { isCetWord, rankOf, toEntry, type EcdictRow, type WordEntry } from './lib/ecdict.ts'

const CHUNK_SIZE = 500
const csvPath = process.argv[2] ?? 'scripts/.cache/ecdict.csv'
const outDir = process.argv[3] ?? 'public/words'

const picked = new Map<string, { entry: WordEntry; rank: number }>()
const parser = createReadStream(csvPath).pipe(parse({ columns: true, relax_quotes: true }))
for await (const row of parser as AsyncIterable<EcdictRow>) {
  if (!isCetWord(row.tag) || picked.has(row.word)) continue
  const entry = toEntry(row)
  if (entry) picked.set(row.word, { entry, rank: rankOf(row) })
}

const sorted = [...picked.values()]
  .sort((a, b) => a.rank - b.rank || a.entry.w.localeCompare(b.entry.w))
  .map((item) => item.entry)

mkdirSync(outDir, { recursive: true })
for (const file of readdirSync(outDir)) {
  if (/^chunk-\d+\.json$/.test(file)) rmSync(join(outDir, file))
}

const chunkCount = Math.ceil(sorted.length / CHUNK_SIZE)
for (let id = 0; id < chunkCount; id++) {
  const chunk = sorted.slice(id * CHUNK_SIZE, (id + 1) * CHUNK_SIZE)
  writeFileSync(join(outDir, `chunk-${String(id).padStart(3, '0')}.json`), JSON.stringify(chunk))
}
writeFileSync(
  join(outDir, 'index.json'),
  JSON.stringify({ version: 1, chunkSize: CHUNK_SIZE, words: sorted.map((w) => w.w) }),
)

console.log(`${sorted.length} words -> ${chunkCount} chunks in ${outDir}`)
