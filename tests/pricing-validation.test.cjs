/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");

const { parsePublicPricingRows } = require("../.foundation-test-build/integrations/pricing/validation.js");

const safeRow = {
  item_slug: "shirt",
  item_name: "Shirt",
  service_slug: "wash-and-iron",
  service_name: "Wash & Iron",
  price_amount_minor: 15000,
  currency: "BDT",
  unit_label: "per item",
};

test("maps only the deliberately public pricing contract", () => {
  assert.deepEqual(parsePublicPricingRows([safeRow]), [
    {
      slug: "shirt",
      name: "Shirt",
      services: [
        {
          slug: "wash-and-iron",
          name: "Wash & Iron",
          amountMinor: 15000,
          currency: "BDT",
          unitLabel: "per item",
        },
      ],
    },
  ]);
});

test("rejects malformed rows and unexpected private fields", () => {
  assert.throws(() => parsePublicPricingRows([{ ...safeRow, internal_cost: 4000 }]));
  assert.throws(() => parsePublicPricingRows([{ ...safeRow, price_amount_minor: -1 }]));
  assert.throws(() => parsePublicPricingRows({ rows: [safeRow] }));
});

const { rankPriceItems, searchWords } = require("../.foundation-test-build/integrations/pricing/validation.js");
const item = (name) => ({ slug: name.toLowerCase(), name, services: [] });

test("search: best match first, every word must match", () => {
  const items = ["B. Kameez Suit (2pc)", "Kabuli Suit", "Suit (2pc)", "Suit (1pc)", "Safari Suit", "Track Suit (2pc)", "Suit (3pc)"].map(item);
  assert.deepEqual(rankPriceItems(items, "suit").slice(0, 3).map((i) => i.name), ["Suit (1pc)", "Suit (2pc)", "Suit (3pc)"]);
  assert.deepEqual(rankPriceItems(items, "suit 1pc").map((i) => i.name), ["Suit (1pc)"]);
  assert.deepEqual(rankPriceItems(items, "Suit 2pc").map((i) => i.name), ["Suit (2pc)", "Track Suit (2pc)", "B. Kameez Suit (2pc)"]);
  assert.deepEqual(rankPriceItems([item("Blazer")], "blaz").map((i) => i.name), ["Blazer"]);
  assert.deepEqual(searchWords("  Suit   1PC "), ["suit", "1pc"]);
});
