import { renderers } from './renderers.mjs';
import { c as createExports } from './chunks/entrypoint_Vh44kGrP.mjs';
import { manifest } from './manifest_DrAUpG64.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/auth.astro.mjs');
const _page2 = () => import('./pages/api/download/_fileid_.astro.mjs');
const _page3 = () => import('./pages/api/files.astro.mjs');
const _page4 = () => import('./pages/api/submit.astro.mjs');
const _page5 = () => import('./pages/test.astro.mjs');
const _page6 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/api/auth.ts", _page1],
    ["src/pages/api/download/[fileId].ts", _page2],
    ["src/pages/api/files.ts", _page3],
    ["src/pages/api/submit.ts", _page4],
    ["src/pages/test.astro", _page5],
    ["src/pages/index.astro", _page6]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "51e26277-306f-4ac1-b9bd-10e2f920c5ba",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;

export { __astrojsSsrVirtualEntry as default, pageMap };
