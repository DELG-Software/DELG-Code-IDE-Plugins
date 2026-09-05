import { createHash } from 'node:crypto'
import { deflateRawSync } from 'node:zlib'
import { readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('.', import.meta.url))
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (manifest.version !== metadata.version) throw new Error('manifest and package versions must match')
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) } return (crc ^ 0xffffffff) >>> 0 }
function u16(value) { const b = Buffer.alloc(2); b.writeUInt16LE(value); return b }
function u32(value) { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); return b }
function zip(files) { const local = [], central = []; let offset = 0; for (const [name, bytes] of files) { const n = Buffer.from(name); const crc = crc32(bytes); const compressed = deflateRawSync(bytes,{level:9}); const method = compressed.length < bytes.length ? 8 : 0; const payload = method === 8 ? compressed : bytes; const h = Buffer.concat([Buffer.from('PK\x03\x04','binary'),u16(20),u16(0),u16(method),u16(0),u16(0),u32(crc),u32(payload.length),u32(bytes.length),u16(n.length),u16(0),n]); local.push(h,payload); central.push(Buffer.concat([Buffer.from('PK\x01\x02','binary'),u16(20),u16(20),u16(0),u16(method),u16(0),u16(0),u32(crc),u32(payload.length),u32(bytes.length),u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),n])); offset += h.length + payload.length } const d = Buffer.concat(central); return Buffer.concat([...local,d,Buffer.from('PK\x05\x06\x00\x00\x00\x00','binary'),u16(files.length),u16(files.length),u32(d.length),u32(offset),u16(0)]) }
async function collect(directory, output = []) { for (const entry of await readdir(directory,{withFileTypes:true})) { const path=join(directory,entry.name); if(entry.isDirectory()) await collect(path,output); else if(entry.isFile()&&!entry.name.endsWith('.delg-plugin')&&path!==join(root,'package.json')&&path!==join(root,'build.mjs')&&path!==join(root,'manifest.json')) output.push(path) } return output }
const files = [['manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')]]; for (const path of await collect(root)) files.push([relative(root,path).replaceAll('\\','/'),await readFile(path)])
const bytes=zip(files); const output=join(root,`${manifest.id.replaceAll('.','-')}-${manifest.version}.delg-plugin`); for(const name of await readdir(root))if(name.endsWith('.delg-plugin'))await rm(join(root,name),{force:true}); await writeFile(output,bytes); console.log(`Created ${output}`); console.log(`SHA-256 ${createHash('sha256').update(bytes).digest('hex').toUpperCase()}`)
