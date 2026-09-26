'use strict';

const fs = require('fs');

async function main() {
  fs.truncateSync('/tmp/ha-large.pdf', 30 * 1024 * 1024);
  fs.truncateSync('/tmp/ha-large.cbr', 30 * 1024 * 1024);

  const pdf = require('/app/dist/modules/metadata/lib/pdf-parser.js');
  const cbx = require('/app/dist/modules/metadata/lib/cbz-metadata.js');
  const cbrCover = require('/app/dist/modules/metadata/lib/cover-cbr.js');

  if (!pdf.__haLowMemoryPatched) throw new Error('PDF parser hook not attached');
  if (!cbx.__haLowMemoryPatched) throw new Error('comic metadata hook not attached');
  if (!cbrCover.__haLowMemoryPatched) throw new Error('CBR cover hook not attached');

  const parsed = await pdf.parsePdfFile('/tmp/ha-large.pdf');
  if (!parsed || parsed.coverBuffer !== null) throw new Error('large PDF safe path failed');

  const meta = await cbx.extractCbrMetadata('/tmp/ha-large.cbr');
  const cover = await cbrCover.extractCbrCover('/tmp/ha-large.cbr');
  if (meta !== null || cover !== null) throw new Error('large CBR safe path failed');

  process.stdout.write('Pi-safe large-file hook verified\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
