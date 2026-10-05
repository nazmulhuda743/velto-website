/**
 * Writes docs/technical/gtm/velto-gtm-container.json: the GTM container for www.velto.com.bd.
 *
 * The container is deliberately generic. The website decides what every event means to GA4 and
 * Meta (src/lib/analytics/destinations.ts) and pushes one `velto_track` entry per event:
 *   { event: "velto_track", ga4_event, meta_event, meta_custom_event, event_id, page_path, service, ... }
 * so GTM needs one GA4 event tag and one Meta event tag, never a tag per event.
 *
 *   node scripts/build-gtm-container.mjs
 */
import { writeFileSync } from "node:fs";

const OUT = "docs/technical/gtm/velto-gtm-container.json";
const ALL_PAGES = "2147479553";
const ids = { account: "0", container: "0" };
const base = { accountId: ids.account, containerId: ids.container };

const consent = (type) => ({
  consentStatus: "NEEDED",
  consentType: { type: "LIST", list: [{ type: "TEMPLATE", value: type }] },
});
const tpl = (key, value) => ({ type: "TEMPLATE", key, value });
const row = (parameter, parameterValue) => ({
  type: "MAP",
  map: [tpl("parameter", parameter), tpl("parameterValue", parameterValue)],
});

/* -------------------------------------------------------------- variables */
const PARAMS = ["page_path", "service", "button_location", "section", "branch", "item", "lead_source", "content_name", "content_category"];
const DLV_KEYS = ["ga4_event", "meta_event", "meta_custom_event", "event_id", ...PARAMS];

let nextId = 1;
const variable = [
  { ...base, variableId: String(nextId++), name: "GA4 Measurement ID", type: "c", parameter: [tpl("value", "G-XXXXXXXXXX")] },
  { ...base, variableId: String(nextId++), name: "Meta Pixel ID", type: "c", parameter: [tpl("value", "000000000000000")] },
  ...DLV_KEYS.map((key) => ({
    ...base,
    variableId: String(nextId++),
    name: `DLV - ${key}`,
    type: "v",
    parameter: [
      { type: "INTEGER", key: "dataLayerVersion", value: "2" },
      { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
      tpl("name", key),
    ],
  })),
];

/* --------------------------------------------------------------- triggers */
const triggerGa4 = String(nextId++);
const triggerMeta = String(nextId++);
const trigger = [
  {
    ...base,
    triggerId: triggerGa4,
    name: "velto_track - GA4",
    type: "CUSTOM_EVENT",
    customEventFilter: [{ type: "EQUALS", parameter: [tpl("arg0", "{{_event}}"), tpl("arg1", "velto_track")] }],
    filter: [{ type: "MATCH_REGEX", parameter: [tpl("arg0", "{{DLV - ga4_event}}"), tpl("arg1", "^[a-z][a-z0-9_]{0,39}$")] }],
  },
  {
    ...base,
    triggerId: triggerMeta,
    name: "velto_track - Meta",
    type: "CUSTOM_EVENT",
    customEventFilter: [{ type: "EQUALS", parameter: [tpl("arg0", "{{_event}}"), tpl("arg1", "velto_track")] }],
  },
];

/* ------------------------------------------------------------------- tags */
const metaBase = `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
// Page views come from the website's own page_view event (once per page, client-side navigation
// included). Without this the Pixel would also send its own PageView on every history change.
fbq.disablePushState = true;
// No automatically detected button clicks or page metadata: only the events the website sends.
fbq('set', 'autoConfig', false, {{Meta Pixel ID}});
fbq('init', {{Meta Pixel ID}});
</script>`;

const metaEvent = `<script>
(function () {
  var standard = {{DLV - meta_event}};
  var custom = {{DLV - meta_custom_event}};
  if (!standard && !custom) return;
  var values = {
${PARAMS.map((p) => `    ${p}: {{DLV - ${p}}}`).join(",\n")}
  };
  var data = {};
  for (var key in values) if (values[key]) data[key] = values[key];
  var options = { eventID: {{DLV - event_id}} };
  if (standard) window.fbq('track', standard, data, options);
  if (custom) window.fbq('trackCustom', custom, data, options);
})();
</script>`;

const tag = [
  {
    ...base,
    tagId: String(nextId++),
    name: "GA4 - Google tag",
    type: "googtag",
    parameter: [tpl("tagId", "{{GA4 Measurement ID}}"), { type: "LIST", key: "configSettingsTable", list: [row("send_page_view", "false")] }],
    firingTriggerId: [ALL_PAGES],
    tagFiringOption: "ONCE_PER_LOAD",
    consentSettings: consent("analytics_storage"),
  },
  {
    ...base,
    tagId: String(nextId++),
    name: "GA4 - event (velto_track)",
    type: "gaawe",
    parameter: [
      tpl("eventName", "{{DLV - ga4_event}}"),
      tpl("measurementIdOverride", "{{GA4 Measurement ID}}"),
      { type: "LIST", key: "eventSettingsTable", list: PARAMS.filter((p) => !p.startsWith("content_")).map((p) => row(p, `{{DLV - ${p}}}`)) },
    ],
    firingTriggerId: [triggerGa4],
    tagFiringOption: "ONCE_PER_EVENT",
    consentSettings: consent("analytics_storage"),
    setupTag: [{ tagName: "GA4 - Google tag", stopOnSetupFailure: true }],
  },
  {
    ...base,
    tagId: String(nextId++),
    name: "Meta - Pixel base",
    type: "html",
    parameter: [tpl("html", metaBase), { type: "BOOLEAN", key: "supportDocumentWrite", value: "false" }],
    firingTriggerId: [ALL_PAGES],
    tagFiringOption: "ONCE_PER_LOAD",
    consentSettings: consent("ad_storage"),
    priority: { type: "INTEGER", value: "10" },
  },
  {
    ...base,
    tagId: String(nextId++),
    name: "Meta - event (velto_track)",
    type: "html",
    parameter: [tpl("html", metaEvent), { type: "BOOLEAN", key: "supportDocumentWrite", value: "false" }],
    firingTriggerId: [triggerMeta],
    tagFiringOption: "ONCE_PER_EVENT",
    consentSettings: consent("ad_storage"),
    setupTag: [{ tagName: "Meta - Pixel base", stopOnSetupFailure: true }],
  },
  {
    ...base,
    tagId: String(nextId++),
    name: "Google Ads - Conversion Linker",
    type: "gclidw",
    parameter: [{ type: "BOOLEAN", key: "enableCrossDomain", value: "false" }],
    firingTriggerId: [ALL_PAGES],
    tagFiringOption: "ONCE_PER_LOAD",
    consentSettings: consent("ad_storage"),
  },
];

const container = {
  exportFormatVersion: 2,
  exportTime: "2026-10-06 00:00:00",
  containerVersion: {
    path: "accounts/0/containers/0/versions/0",
    ...base,
    containerVersionId: "0",
    container: {
      path: "accounts/0/containers/0",
      ...base,
      name: "Velto website",
      publicId: "GTM-XXXXXXX",
      usageContext: ["WEB"],
    },
    tag,
    trigger,
    variable,
    builtInVariable: [
      { ...base, type: "PAGE_URL", name: "Page URL" },
      { ...base, type: "EVENT", name: "Event" },
    ],
  },
};

writeFileSync(OUT, `${JSON.stringify(container, null, 2)}\n`);
console.log(`wrote ${OUT}: ${tag.length} tags, ${trigger.length} triggers, ${variable.length} variables`);
