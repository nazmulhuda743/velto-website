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
