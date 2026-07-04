const assert = require("node:assert/strict");
const {
  calculateLinearInterpolation,
  formatOutputValue,
  getCompleteSortedPoints,
  normalizeState,
  parsePastedTable,
  PAIR_COUNT,
} = require("../app");

function y(rows, x) {
  const result = calculateLinearInterpolation(rows, x);
  assert.equal(result.ok, true, result.message);
  return result.y;
}

const rows = [
  { x: "0", y: "0" },
  { x: "10", y: "100" },
  { x: "20", y: "200" },
];

assert.equal(y(rows, "5"), 50);
assert.equal(y(rows, "10"), 100);
assert.equal(y(rows, "-1"), 0);
assert.equal(y(rows, "25"), 200);
assert.equal(formatOutputValue(1 / 3), "0.333");
assert.equal(formatOutputValue(2), "2.000");
assert.equal(formatOutputValue(-0), "0.000");
assert.deepEqual(parsePastedTable("X\t0\t10\t20\nY\t0\t100\t200"), rows);
assert.deepEqual(parsePastedTable("0\t0\n10\t100\n20\t200"), rows);
assert.deepEqual(parsePastedTable("X\tY\n0\t0\n10\t100\n20\t200"), rows);

const unsortedRows = [
  { x: "20", y: "200" },
  { x: "0", y: "0" },
  { x: "10", y: "100" },
];

assert.equal(y(unsortedRows, "15"), 150);

const singlePoint = [{ x: "7", y: "70" }];
assert.equal(y(singlePoint, "2"), 70);

const duplicate = calculateLinearInterpolation(
  [
    { x: "1", y: "10" },
    { x: "1", y: "20" },
  ],
  "1",
);
assert.equal(duplicate.ok, false);
assert.match(duplicate.message, /Duplicate X/);

const invalidTarget = calculateLinearInterpolation(rows, "");
assert.equal(invalidTarget.ok, false);
assert.equal(invalidTarget.message, "Enter input X");

const incompleteRows = calculateLinearInterpolation(
  [
    { x: "0", y: "" },
    { x: "", y: "4" },
  ],
  "1",
);
assert.equal(incompleteRows.ok, false);
assert.equal(incompleteRows.message, "No complete rows");

const migratedState = normalizeState({
  targetX: "12.5",
  plotWidth: 900,
  plotHeight: 120,
  splitPercent: 60,
  updatedAt: "2026-07-04T00:00:00.000Z",
  tables: [
    {
      name: "Legacy Table",
      enabled: true,
      rows,
    },
  ],
});
assert.equal(migratedState.targetX, "12.5");
assert.equal(Object.hasOwn(migratedState.tables[0], "targetX"), false);
assert.equal(migratedState.tables[0].name, "Legacy Table");
assert.equal(migratedState.tables[1].name, "Legacy Table");
assert.equal(migratedState.tables[0].versionInfo, "Version A");
assert.equal(migratedState.tables[1].versionInfo, "Version B");
assert.equal(migratedState.tables.length, 8);
assert.equal(PAIR_COUNT, 4);
assert.equal(migratedState.updatedAt, "2026-07-04T00:00:00.000Z");
assert.equal(migratedState.plotWidth, 900);
assert.equal(migratedState.plotHeight, 120);
assert.equal(migratedState.splitPercent, 60);
assert.deepEqual(migratedState.pairSplits, [60, 60, 60, 60]);
assert.equal(migratedState.xAxisLabel, "X");
assert.equal(migratedState.yAxisLabel, "Y");
assert.deepEqual(migratedState.plotSettings, [
  { width: 900, height: 120, xAxisLabel: "X", yAxisLabel: "Y", xMin: "", xMax: "", yMin: "", yMax: "" },
  { width: 900, height: 120, xAxisLabel: "X", yAxisLabel: "Y", xMin: "", xMax: "", yMin: "", yMax: "" },
  { width: 900, height: 120, xAxisLabel: "X", yAxisLabel: "Y", xMin: "", xMax: "", yMin: "", yMax: "" },
  { width: 900, height: 120, xAxisLabel: "X", yAxisLabel: "Y", xMin: "", xMax: "", yMin: "", yMax: "" },
]);

const rangedState = normalizeState({
  plotSettings: [
    {
      width: 640,
      height: 260,
      xAxisLabel: "Speed",
      yAxisLabel: "Angle",
      xMin: "0",
      xMax: "80",
      yMin: "55",
      yMax: "430",
    },
  ],
});
assert.deepEqual(rangedState.plotSettings[0], {
  width: 640,
  height: 260,
  xAxisLabel: "Speed",
  yAxisLabel: "Angle",
  xMin: "0",
  xMax: "80",
  yMin: "55",
  yMax: "430",
});

assert.deepEqual(getCompleteSortedPoints(unsortedRows), [
  { x: 0, y: 0 },
  { x: 10, y: 100 },
  { x: 20, y: 200 },
]);

console.log("Interpolation tests passed");
