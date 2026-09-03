/**
 * Headless diagram export via Chrome + Archify.exportMenu.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ChromeVisualBrowser,
  findChrome,
} from '../../archify/bin/visual-check.mjs';

export const EXPORT_FORMATS = Object.freeze([
  'svg',
  'png',
  'jpeg',
  'webp',
  'webm',
  'share-card',
  'route-share-card',
  'reach-share-card',
]);

const MIME_BY_FORMAT = Object.freeze({
  svg: 'image/svg+xml',
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  webm: 'video/webm',
  'share-card': 'image/png',
  'route-share-card': 'image/png',
  'reach-share-card': 'image/png',
});

export class HeadlessExportError extends Error {
  constructor(message, code, status = 422) {
    super(message);
    this.name = 'HeadlessExportError';
    this.code = code;
    this.status = status;
  }
}

async function evaluate(cdp, sessionId, expression, awaitPromise = false, timeoutMs = 60000) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  }, sessionId, timeoutMs);
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description
      || response.exceptionDetails.text
      || 'Runtime.evaluate failed');
  }
  return response.result?.value;
}

function defaultMime(format, reported) {
  if (reported && typeof reported === 'string' && reported.length) return reported;
  return MIME_BY_FORMAT[format] || 'application/octet-stream';
}

/**
 * Export a delivered Archify HTML artifact.
 *
 * @param {object} options
 * @param {string} [options.artifactUrl] http(s) URL preferred
 * @param {string} [options.artifactPath] local HTML path (file:// fallback)
 * @param {string} options.format
 * @param {{ source: string, target: string }} [options.route]
 * @param {{ nodeId: string, direction: string }} [options.reach]
 * @param {string} [options.theme]
 * @param {boolean} [options.omitText]
 * @param {number} [options.timeoutMs]
 * @param {() => string|null} [options.resolveChrome]
 * @param {(chromePath: string) => Promise<ChromeVisualBrowser>|ChromeVisualBrowser} [options.browserFactory]
 */
export async function exportDiagramArtifact(options = {}) {
  const format = options.format;
  if (!EXPORT_FORMATS.includes(format)) {
    throw new HeadlessExportError(`Unsupported format: ${format}`, 'bad_format', 400);
  }
  if (format === 'route-share-card') {
    if (!options.route?.source || !options.route?.target) {
      throw new HeadlessExportError('route.source and route.target are required', 'route_required', 400);
    }
  }
  if (format === 'reach-share-card') {
    if (!options.reach?.nodeId || !options.reach?.direction) {
      throw new HeadlessExportError('reach.nodeId and reach.direction are required', 'reach_required', 400);
    }
  }

  const resolveChrome = options.resolveChrome || findChrome;
  const chromePath = resolveChrome();
  if (!chromePath) {
    throw new HeadlessExportError(
      'Chrome/Chromium not found (set ARCHIFY_CHROME)',
      'chrome_missing',
      503,
    );
  }

  let url;
  if (options.artifactUrl) {
    url = options.artifactUrl;
  } else if (options.artifactPath) {
    url = pathToFileURL(path.resolve(options.artifactPath)).href;
  } else {
    throw new HeadlessExportError('artifactUrl or artifactPath is required', 'bad_artifact', 400);
  }

  if (options.theme) {
    const u = new URL(url);
    u.searchParams.set('theme', options.theme);
    url = u.href;
  }

  if (options.omitText === true) {
    const u = new URL(url);
    u.searchParams.set('exportOmitText', '1');
    url = u.href;
  }

  const timeoutMs = Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : (format === 'webm' ? 120000 : 60000);

  const browserFactory = options.browserFactory
    || (async (resolved) => new ChromeVisualBrowser(resolved));
  const browser = await browserFactory(chromePath);
  try {
    const sessionId = await browser.sessionPromise;
    const loaded = browser.cdp.waitFor('Page.loadEventFired', sessionId);
    const navigation = await browser.cdp.send('Page.navigate', { url }, sessionId);
    if (navigation.errorText) {
      throw new HeadlessExportError(
        `Chrome navigation failed: ${navigation.errorText}`,
        'export_failed',
        422,
      );
    }
    await loaded;

    await evaluate(browser.cdp, sessionId, `(async function () {
      var deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        if (window.Archify && Archify.exportMenu && typeof Archify.exportMenu.run === 'function') {
          if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (_) {}
          }
          if (Archify.readerLayout && typeof Archify.readerLayout.whenStable === 'function') {
            try { await Archify.readerLayout.whenStable(); } catch (_) {}
          }
          return true;
        }
        await new Promise(function (r) { setTimeout(r, 50); });
      }
      throw new Error('Archify.exportMenu did not become ready');
    })()`, true, timeoutMs);

    const route = options.route || null;
    const reach = options.reach || null;
    const payload = await evaluate(browser.cdp, sessionId, `(async function () {
      var format = ${JSON.stringify(format)};
      var route = ${JSON.stringify(route)};
      var reach = ${JSON.stringify(reach)};

      function blobToResult(blob) {
        if (!blob) throw new Error('export produced no blob');
        return blob.arrayBuffer().then(function (ab) {
          var bytes = new Uint8Array(ab);
          var binary = '';
          var chunk = 0x8000;
          for (var i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
          }
          return {
            base64: btoa(binary),
            mimeType: blob.type || '',
            bytes: blob.size
          };
        });
      }

      window.alert = function () {};

      if (format === 'route-share-card') {
        if (!Archify.routeProbe) throw new Error('routeProbe unavailable');
        Archify.routeProbe.begin({ source: route.source, focusNode: false });
        if (!Archify.routeProbe.choose(route.target, { updateUrl: false })) {
          throw new Error('route did not resolve');
        }
        if (!Archify.routeProbe.exportSnapshot()) {
          throw new Error('route exposed no export snapshot');
        }
        if (typeof Archify.exportMenu.syncRouteShare === 'function') {
          Archify.exportMenu.syncRouteShare();
        }
        return blobToResult(await Archify.exportMenu.downloadRouteShareCard());
      }

      if (format === 'reach-share-card') {
        if (!Archify.focus) throw new Error('focus unavailable');
        if (!Archify.focus.set(reach.nodeId, { toggle: false, updateUrl: false })) {
          throw new Error('focus origin did not resolve');
        }
        if (!Archify.focus.reach(reach.direction, { toggle: false, updateUrl: false, reveal: false })) {
          throw new Error('authored reach did not resolve');
        }
        if (!Archify.focus.reachabilitySnapshot()) {
          throw new Error('reach exposed no export snapshot');
        }
        if (typeof Archify.exportMenu.syncReachShare === 'function') {
          Archify.exportMenu.syncReachShare();
        }
        return blobToResult(await Archify.exportMenu.downloadReachShareCard());
      }

      if (format === 'share-card') {
        return blobToResult(await Archify.exportMenu.shareCard());
      }

      if (format === 'webm') {
        if (!Archify.motion || !Archify.motion.canRecord || !Archify.motion.canRecord()) {
          throw new Error('webm_unavailable');
        }
      }

      var captured = null;
      var orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function (blob) {
        if (blob && typeof Blob !== 'undefined' && blob instanceof Blob) captured = blob;
        return orig(blob);
      };
      try {
        await Archify.exportMenu.run(format === 'jpeg' ? 'jpeg' : format);
        var err = document.documentElement.getAttribute('data-last-export-error');
        if (err) throw new Error(err);
        if (!captured) throw new Error('export produced no blob');
        return blobToResult(captured);
      } finally {
        URL.createObjectURL = orig;
      }
    })()`, true, timeoutMs);

    if (!payload?.base64) {
      throw new HeadlessExportError('Export returned empty payload', 'export_failed', 422);
    }

    const buffer = Buffer.from(payload.base64, 'base64');
    return {
      buffer,
      mimeType: defaultMime(format, payload.mimeType),
      bytes: buffer.length,
      format,
    };
  } catch (err) {
    if (err instanceof HeadlessExportError) throw err;
    const message = err?.message || String(err);
    if (message.includes('webm_unavailable')) {
      throw new HeadlessExportError(
        'WebM export unavailable in this Chrome session (MediaRecorder)',
        'webm_unavailable',
        422,
      );
    }
    throw new HeadlessExportError(message, 'export_failed', 422);
  } finally {
    try {
      await browser.close();
    } catch {
      // ignore teardown errors
    }
  }
}

export { findChrome, MIME_BY_FORMAT };
