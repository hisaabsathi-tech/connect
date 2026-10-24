import { describe, expect, test } from "bun:test";

import { manifestPincodes, manifestRows } from "@/features/sheet/lib/manifest";

const workbook = {
  sheetOrder: ["s1"],
  sheets: {
    s1: {
      cellData: {
        0: { 0: { v: "*AWB NO" }, 1: { v: "CLIENT NAME" }, 2: { v: "*DESTINATION PINCODE" } },
        1: { 0: { v: "26186200062943" }, 1: { v: "ADITI" }, 2: { v: "700144" } },
        2: { 0: { v: "26186200062944" }, 1: { v: "ADITI" }, 2: { v: 999999 } },
      },
    },
  },
};

describe("manifestRows", () => {
  test("puts each destination pincode's city right after it", () => {
    expect(manifestRows(workbook, { "700144": "Kolkata" })).toEqual([
      ["AWB No", "Client Name", "Dest Pincode*", "City", "Receiver Name", "Phone"],
      ["26186200062943", "ADITI", "700144", "Kolkata", "", ""],
      ["26186200062944", "ADITI", "999999", "", "", ""],
    ]);
  });

  test("lists the pincodes to look the cities up", () => {
    expect(manifestPincodes(workbook)).toEqual(["700144", "999999"]);
  });
});
