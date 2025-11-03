import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const SRC_DIR = path.resolve('public/images')

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full)
    else if (/\.(png|jpg|jpeg)$/i.test(e.name)) {
      const out = full.replace(/\.(png|jpg|jpeg)$/i, '.webp')
      try {
        await sharp(full).webp({ quality: 80 }).toFile(out)
        console.log('converted:', path.relative(process.cwd(), out))
      } catch (err) {
        console.warn('convert failed:', full, err?.message)
      }
    }
  }
}

if (fs.existsSync(SRC_DIR)) {
  walk(SRC_DIR).then(() => console.log('✅ images converted to webp')).catch(err => {
    console.error('❌ convert failed', err)
    process.exit(1)
  })
} else {
  console.log('ℹ️ no public/images directory, skip conversion')
}


