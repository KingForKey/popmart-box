// 纯 JS 生成 .xlsx 文件（OOXML zip），不引入第三方依赖。
// 只支持我们需要的子集：多个工作表、字符串/数字单元格、UTF-8。
// 页面调用 buildXlsx(sheets) 拿到 ArrayBuffer，再交给 platform/file.js 下载。

// sheets: [{ name: string, rows: Array<Array<string|number|null>> }]
export function buildXlsx(sheets) {
  const names = sheets.map((s) => sanitizeSheetName(s.name))
  const files = {}

  files['[Content_Types].xml'] = buildContentTypes(sheets.length)
  files['_rels/.rels'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'
  files['docProps/core.xml'] = buildCoreProps()
  files['docProps/app.xml'] = buildAppProps(names)
  files['xl/workbook.xml'] = buildWorkbook(names)
  files['xl/_rels/workbook.xml.rels'] = buildWorkbookRels(sheets.length)
  files['xl/styles.xml'] = buildStyles()

  sheets.forEach((s, i) => {
    files['xl/worksheets/sheet' + (i + 1) + '.xml'] = buildSheet(s.rows || [])
  })

  return zipStore(files)
}

// ---------- 各 XML 部件 ----------

function sanitizeSheetName(name) {
  // Excel 表名限制：<=31 字符，不能含 : \ / ? * [ ]
  return String(name || 'Sheet')
    .replace(/[:\\/?*[\]]/g, ' ')
    .slice(0, 31) || 'Sheet'
}

function buildContentTypes(count) {
  let overrides = ''
  for (let i = 1; i <= count; i++) {
    overrides +=
      '<Override PartName="/xl/worksheets/sheet' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
  }
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    overrides +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>'
  )
}

function buildCoreProps() {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:creator>popmart-box</dc:creator>' +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>' +
    '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>' +
    '</cp:coreProperties>'
  )
}

function buildAppProps(names) {
  const vec = names.map((n) => '<vt:lpstr>' + escapeXml(n) + '</vt:lpstr>').join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>popmart-box</Application>' +
    '<TitlesOfParts><vt:vector size="' + names.length + '" baseType="lpstr">' + vec + '</vt:vector></TitlesOfParts>' +
    '</Properties>'
  )
}

function buildWorkbook(names) {
  const sheetTags = names
    .map(
      (n, i) =>
        '<sheet name="' + escapeXml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'
    )
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + sheetTags + '</sheets>' +
    '</workbook>'
  )
}

function buildWorkbookRels(count) {
  let rels = ''
  for (let i = 1; i <= count; i++) {
    rels +=
      '<Relationship Id="rId' + i + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + i + '.xml"/>'
  }
  rels +=
    '<Relationship Id="rId' + (count + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels +
    '</Relationships>'
  )
}

function buildStyles() {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '</styleSheet>'
  )
}

function colName(idx) {
  // 0 → A, 25 → Z, 26 → AA
  let s = ''
  let n = idx
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

function buildSheet(rows) {
  let maxCol = 0
  const body = rows
    .map((row, r) => {
      maxCol = Math.max(maxCol, row.length)
      const cells = row
        .map((v, c) => {
          if (v === null || v === undefined || v === '') return ''
          const ref = colName(c) + (r + 1)
          if (typeof v === 'number' && isFinite(v)) {
            return '<c r="' + ref + '"><v>' + v + '</v></c>'
          }
          return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
            escapeXml(String(v)) +
            '</t></is></c>'
        })
        .join('')
      return '<row r="' + (r + 1) + '">' + cells + '</row>'
    })
    .join('')

  const cols =
    maxCol > 0
      ? '<cols>' +
        Array.from({ length: maxCol }, (_, i) =>
          '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="16" customWidth="1"/>'
        ).join('') +
        '</cols>'
      : ''

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    cols +
    '<sheetData>' + body + '</sheetData>' +
    '</worksheet>'
  )
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ---------- 最小 zip（store 存储，无压缩） ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipStore(files) {
  const encoder = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0

  for (const name of Object.keys(files)) {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(files[name])
    const crc = crc32(data)

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // UTF-8 flag
    lv.setUint16(8, 0, true) // method: store
    lv.setUint16(10, 0, true) // time
    lv.setUint16(12, 0x21, true) // date (1980-01-01)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)

    parts.push(local, data)

    const cen = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cen.set(nameBytes, 46)
    central.push(cen)

    offset += local.length + data.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, central.length, true)
  ev.setUint16(10, central.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const total = offset + centralSize + end.length
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  for (const c of central) {
    out.set(c, pos)
    pos += c.length
  }
  out.set(end, pos)
  return out.buffer
}
