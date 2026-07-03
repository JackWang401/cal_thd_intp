const assert = require("node:assert/strict");
const { calculateLinearInterpolation } = require("../app");

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

console.log("Interpolation tests passed");
