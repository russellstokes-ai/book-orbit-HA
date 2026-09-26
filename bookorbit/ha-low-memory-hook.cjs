'use strict';

/**
 * Home Assistant / low-memory compatibility layer for BookOrbit.
 *
 * BookOrbit 3.1.0 can read very large PDF, CBR and CB7 files fully into Node
 * memory while extracting metadata/covers. On small HA hosts this can trigger
 * the Linux OOM killer (exit 137) and take the whole server offline.
 *
 * This preload hook keeps upstream BookOrbit untouched:
 *  - large PDFs use poppler/pdfinfo for bounded-memory metadata extraction
 *  - large CBR/CB7 files skip embedded metadata/cover extraction so BookOrbit
 *    falls back to filename metadata
 *  - files below the configured threshold keep upstream behaviour
 */

const Module = require('module');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const thresholdMbRaw = Number.parseInt(process.env.BOOKORBIT_HA_SAFE_SCAN_MB || '25', 10);
const thresholdMb = Number.isFinite(thresholdMbRaw) && thresholdMbRaw > 0 ? thresholdMbRaw : 25;
const thresholdBytes = thresholdMb * 1024 * 1024;
const enabled = process.env.BOOKORBIT_HA_LOW_MEMORY_MODE !== 'false';

function isPath(resolved, suffix) {
  return typeof resolved === 'string' && resolved.replace(/\\/g, '/').endsWith(suffix);
}

async function isLarge(path) {
  try {
    const stat = await fs.stat(path);
    return stat.size >= thresholdBytes;
  } catch {
    return false;
  }
}

function clean(value) {
  if (!value) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function splitPeople(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, sortName: null }));
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function lowMemoryPdf(path, options) {
  let stdout = '';
  try {
    ({ stdout } = await execFileAsync('pdfinfo', [path], {
      maxBuffer: 2 * 1024 * 1024,
      timeout: 30000,
    }));
  } catch {
    // Returning a blank metadata object still lets PdfFormatExtractor fall
    // back to filename parsing without loading the document into Node memory.
  }

  const fields = new Map();
  for (const line of String(stdout).split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) fields.set(match[1].trim().toLowerCase(), match[2].trim());
  }

  const pages = Number.parseInt(fields.get('pages') || '', 10);
  options?.onWarning?.({
    code: 'buffered-large-pdf',
    absolutePath: path,
    sizeBytes: (await fs.stat(path).catch(() => ({ size: 0 }))).size,
    thresholdBytes,
  });

  return {
    title: clean(fields.get('title')),
    subtitle: null,
    authors: splitPeople(fields.get('author')),
    description: clean(fields.get('subject')),
    publisher: null,
    publishedDate: null,
    publishedYear: null,
    language: null,
    genres: [],
    tags: splitList(fields.get('keywords')),
    isbn10: null,
    isbn13: null,
    seriesName: null,
    seriesIndex: null,
    rating: null,
    pageCount: Number.isFinite(pages) ? pages : null,
    googleBooksId: null,
    goodreadsId: null,
    amazonId: null,
    hardcoverId: null,
    hardcoverEditionId: null,
    openLibraryId: null,
    ranobedbId: null,
    koboId: null,
    lubimyczytacId: null,
    aladinId: null,
    itunesId: null,
    coverBuffer: null,
  };
}

const originalLoad = Module._load;
const wrappedModules = new Map();

function markPatched(exportsObject) {
  Object.defineProperty(exportsObject, '__haLowMemoryPatched', {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return exportsObject;
}

Module._load = function patchedLoad(request, parent, isMain) {
  let resolved = '';
  try {
    resolved = Module._resolveFilename(request, parent, isMain);
  } catch {
    // Let Node's normal loader produce the real error.
  }

  const loaded = originalLoad.apply(this, arguments);
  if (!enabled || !loaded || typeof loaded !== 'object') return loaded;

  if (wrappedModules.has(resolved)) return wrappedModules.get(resolved);

  if (isPath(resolved, '/modules/metadata/lib/pdf-parser.js') && typeof loaded.parsePdfFile === 'function') {
    const upstream = loaded.parsePdfFile;
    const wrapped = {
      ...loaded,
      parsePdfFile: async function haSafeParsePdfFile(path, options = {}) {
        if (!(await isLarge(path))) return upstream(path, options);
        return lowMemoryPdf(path, options);
      },
    };
    markPatched(wrapped);
    wrappedModules.set(resolved, wrapped);
    return wrapped;
  }

  if (isPath(resolved, '/modules/metadata/lib/cbz-metadata.js')) {
    const wrapped = { ...loaded };

    if (typeof loaded.extractCbrMetadata === 'function') {
      const upstreamCbr = loaded.extractCbrMetadata;
      wrapped.extractCbrMetadata = async function haSafeCbrMetadata(path, ...args) {
        if (await isLarge(path)) return null;
        return upstreamCbr(path, ...args);
      };
    }

    if (typeof loaded.extractCb7Metadata === 'function') {
      const upstreamCb7 = loaded.extractCb7Metadata;
      wrapped.extractCb7Metadata = async function haSafeCb7Metadata(path, ...args) {
        if (await isLarge(path)) return null;
        return upstreamCb7(path, ...args);
      };
    }

    markPatched(wrapped);
    wrappedModules.set(resolved, wrapped);
    return wrapped;
  }

  for (const [suffix, key] of [
    ['/modules/metadata/lib/cover-cbr.js', 'extractCbrCover'],
    ['/modules/metadata/lib/cover-cb7.js', 'extractCb7Cover'],
  ]) {
    if (isPath(resolved, suffix) && typeof loaded[key] === 'function') {
      const upstream = loaded[key];
      const wrapped = {
        ...loaded,
        [key]: async function haSafeArchiveCover(path, ...args) {
          if (await isLarge(path)) return null;
          return upstream(path, ...args);
        },
      };
      markPatched(wrapped);
      wrappedModules.set(resolved, wrapped);
      return wrapped;
    }
  }

  return loaded;
};
