const { normalizeWwfDisplayList, toWwfDisplayLabel } = require("../src/lib/worldwidefm");

describe("Worldwide FM display normalization", () => {
  test("drops raw Cosmic ids and keeps readable labels", () => {
    expect(normalizeWwfDisplayList([
      "68668186414583e1cff6adf6",
      { id: "68668172414583e1cff6add7", slug: "soul", title: "soul" },
      { id: "68668189414583e1cff6adfb", slug: "house", title: "house" },
      { id: "68794cdad734651042fa6936", slug: "rohan-rakhit", title: "Rohan Rakhit" },
      "jazz",
      "",
      null
    ])).toEqual([
      "soul",
      "house",
      "Rohan Rakhit",
      "jazz"
    ]);
  });

  test("uses slug fallback when title is missing", () => {
    expect(toWwfDisplayLabel({ slug: "rohan-rakhit" })).toBe("Rohan Rakhit");
    expect(toWwfDisplayLabel("68794cdad734651042fa6936")).toBe("");
  });
});
