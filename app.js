(function (root, factory) {
  var app = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = app;
  }

  root.InterpolationApp = app;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TABLE_COUNT = 8;
  var DEFAULT_ROW_COUNT = 5;
  var MAX_ROW_COUNT = 64;
  var STORAGE_KEY = "linear-interpolation-tool-state-v1";

  function parseFiniteNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== "string") {
      return null;
    }

    var trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }

    var parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    if (Object.is(value, -0)) {
      return "0";
    }

    return Number(value.toPrecision(12)).toString();
  }

  function clampInteger(value, min, max, fallback) {
    var parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, parsed));
  }

  function makeRows(count, tableIndex, withSample) {
    var rows = [];
    var rowCount = clampInteger(count, 1, MAX_ROW_COUNT, DEFAULT_ROW_COUNT);

    for (var rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      var xValue = rowIndex * 25;
      var yValue = (tableIndex + 1) * 10 + rowIndex * (tableIndex + 2) * 3;
      rows.push({
        x: withSample ? String(xValue) : "",
        y: withSample ? String(yValue) : "",
      });
    }

    return rows;
  }

  function makeDefaultState() {
    return {
      targetX: "40",
      tables: Array.from({ length: TABLE_COUNT }, function (_, tableIndex) {
        return {
          name: "Table " + (tableIndex + 1),
          enabled: true,
          targetX: "40",
          rows: makeRows(DEFAULT_ROW_COUNT, tableIndex, true),
        };
      }),
    };
  }

  function normalizeRows(rows) {
    if (!Array.isArray(rows)) {
      return makeRows(DEFAULT_ROW_COUNT, 0, false);
    }

    return rows.slice(0, MAX_ROW_COUNT).map(function (row) {
      return {
        x: row && row.x !== undefined ? String(row.x) : "",
        y: row && row.y !== undefined ? String(row.y) : "",
      };
    });
  }

  function normalizeState(candidate) {
    var fallback = makeDefaultState();
    if (!candidate || typeof candidate !== "object") {
      return fallback;
    }

    var tables = Array.from({ length: TABLE_COUNT }, function (_, tableIndex) {
      var table = Array.isArray(candidate.tables)
        ? candidate.tables[tableIndex]
        : null;
      var fallbackTable = fallback.tables[tableIndex];
      var normalizedRows = normalizeRows(table && table.rows);

      return {
        name:
          table && typeof table.name === "string" && table.name.trim() !== ""
            ? table.name.slice(0, 32)
            : fallbackTable.name,
        enabled: table && typeof table.enabled === "boolean" ? table.enabled : true,
        targetX:
          table && table.targetX !== undefined && table.targetX !== null
            ? String(table.targetX)
            : candidate.targetX !== undefined && candidate.targetX !== null
              ? String(candidate.targetX)
              : fallback.targetX,
        rows: normalizedRows.length > 0 ? normalizedRows : makeRows(1, tableIndex, false),
      };
    });

    return {
      targetX:
        candidate.targetX !== undefined && candidate.targetX !== null
          ? String(candidate.targetX)
          : fallback.targetX,
      tables: tables,
    };
  }

  function calculateLinearInterpolation(rows, targetInput) {
    var target = parseFiniteNumber(targetInput);
    if (target === null) {
      return {
        ok: false,
        level: "error",
        y: null,
        message: "Enter input X",
        range: "--",
      };
    }

    var points = [];
    (Array.isArray(rows) ? rows : []).forEach(function (row, index) {
      var x = parseFiniteNumber(row && row.x);
      var y = parseFiniteNumber(row && row.y);
      if (x !== null && y !== null) {
        points.push({
          x: x,
          y: y,
          sourceIndex: index + 1,
        });
      }
    });

    if (points.length === 0) {
      return {
        ok: false,
        level: "error",
        y: null,
        message: "No complete rows",
        range: "--",
      };
    }

    points.sort(function (left, right) {
      return left.x - right.x;
    });

    for (var duplicateIndex = 1; duplicateIndex < points.length; duplicateIndex += 1) {
      if (points[duplicateIndex - 1].x === points[duplicateIndex].x) {
        return {
          ok: false,
          level: "error",
          y: null,
          message: "Duplicate X at " + formatNumber(points[duplicateIndex].x),
          range: "--",
        };
      }
    }

    if (points.length === 1) {
      return {
        ok: true,
        level: "warn",
        y: points[0].y,
        message: "Clamped to only point",
        range: "X = " + formatNumber(points[0].x),
      };
    }

    var first = points[0];
    var last = points[points.length - 1];

    if (target < first.x) {
      return {
        ok: true,
        level: "warn",
        y: first.y,
        message: "Below range, clamped",
        range: "min X " + formatNumber(first.x),
      };
    }

    if (target > last.x) {
      return {
        ok: true,
        level: "warn",
        y: last.y,
        message: "Above range, clamped",
        range: "max X " + formatNumber(last.x),
      };
    }

    for (var pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      if (target === points[pointIndex].x) {
        return {
          ok: true,
          level: "ok",
          y: points[pointIndex].y,
          message: "Exact breakpoint",
          range: "X = " + formatNumber(points[pointIndex].x),
        };
      }
    }

    for (var segmentIndex = 1; segmentIndex < points.length; segmentIndex += 1) {
      var low = points[segmentIndex - 1];
      var high = points[segmentIndex];

      if (target < high.x) {
        var ratio = (target - low.x) / (high.x - low.x);
        var interpolatedY = low.y + ratio * (high.y - low.y);
        return {
          ok: true,
          level: "ok",
          y: interpolatedY,
          message: "Interpolated",
          range: formatNumber(low.x) + " to " + formatNumber(high.x),
          ratio: ratio,
        };
      }
    }

    return {
      ok: false,
      level: "error",
      y: null,
      message: "Unable to calculate",
      range: "--",
    };
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : makeDefaultState();
    } catch (error) {
      return makeDefaultState();
    }
  }

  function saveState(state, statusNode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      statusNode.textContent = "Saved locally";
    } catch (error) {
      statusNode.textContent = "Not saved";
    }
  }

  function setRowCount(table, rowCount, tableIndex) {
    var nextCount = clampInteger(rowCount, 1, MAX_ROW_COUNT, table.rows.length || 1);
    var nextRows = table.rows.slice(0, nextCount);

    while (nextRows.length < nextCount) {
      nextRows.push({
        x: "",
        y: "",
      });
    }

    table.rows = nextRows.length > 0 ? nextRows : makeRows(1, tableIndex, false);
  }

  function renderBreakpointRows(body, table, tableIndex, onChange) {
    var documentRef = body.ownerDocument;
    var indexRow = documentRef.createElement("tr");
    var xRow = documentRef.createElement("tr");
    var yRow = documentRef.createElement("tr");
    var indexLabel = documentRef.createElement("th");
    var xLabel = documentRef.createElement("th");
    var yLabel = documentRef.createElement("th");

    body.replaceChildren();

    indexLabel.scope = "row";
    indexLabel.className = "axis-label";
    indexLabel.textContent = "#";
    xLabel.scope = "row";
    xLabel.className = "axis-label";
    xLabel.textContent = "X";
    yLabel.scope = "row";
    yLabel.className = "axis-label";
    yLabel.textContent = "Y";

    indexRow.appendChild(indexLabel);
    xRow.appendChild(xLabel);
    yRow.appendChild(yLabel);

    table.rows.forEach(function (row, rowIndex) {
      var indexCell = documentRef.createElement("td");
      var xCell = documentRef.createElement("td");
      var yCell = documentRef.createElement("td");
      var xInput = documentRef.createElement("input");
      var yInput = documentRef.createElement("input");

      indexCell.className = "point-cell point-number";
      indexCell.textContent = String(rowIndex + 1);
      xCell.className = "point-cell";
      yCell.className = "point-cell";

      xInput.type = "number";
      xInput.step = "any";
      xInput.inputMode = "decimal";
      xInput.value = row.x;
      xInput.setAttribute("aria-label", "Table " + (tableIndex + 1) + " row " + (rowIndex + 1) + " X");
      xInput.addEventListener("input", function () {
        row.x = xInput.value;
        onChange();
      });

      yInput.type = "number";
      yInput.step = "any";
      yInput.inputMode = "decimal";
      yInput.value = row.y;
      yInput.setAttribute("aria-label", "Table " + (tableIndex + 1) + " row " + (rowIndex + 1) + " Y");
      yInput.addEventListener("input", function () {
        row.y = yInput.value;
        onChange();
      });

      xCell.appendChild(xInput);
      yCell.appendChild(yInput);
      indexRow.appendChild(indexCell);
      xRow.appendChild(xCell);
      yRow.appendChild(yCell);
    });

    body.append(indexRow, xRow, yRow);
  }

  function startApp(doc) {
    var documentRef = doc || document;
    var state = loadState();
    var allTargetInput = documentRef.getElementById("all-target-x");
    var applyTargetButton = documentRef.getElementById("apply-target-x");
    var allRowCountInput = documentRef.getElementById("all-row-count");
    var applyRowCountButton = documentRef.getElementById("apply-row-count");
    var resetSampleButton = documentRef.getElementById("reset-sample");
    var clearAllButton = documentRef.getElementById("clear-all");
    var saveStateNode = documentRef.getElementById("save-state");
    var tableGrid = documentRef.getElementById("table-grid");
    var template = documentRef.getElementById("table-card-template");
    var tableViews = [];

    function calculateAll() {
      state.tables.forEach(function (table, tableIndex) {
        var view = tableViews[tableIndex];
        var result = table.enabled
          ? calculateLinearInterpolation(table.rows, table.targetX)
          : {
              ok: false,
              level: "warn",
              y: null,
              message: "Disabled",
              range: "--",
            };

        var resultText = result.ok ? formatNumber(result.y) : "--";
        var statusClass =
          result.level === "ok"
            ? "status-ok"
            : result.level === "warn"
              ? "status-warn"
              : "status-error";

        view.card.classList.toggle("disabled", !table.enabled);
        view.resultY.textContent = resultText;
        view.resultDetail.textContent = result.message + " | " + result.range;
        view.resultDetail.className = "table-result-detail " + statusClass;
      });
    }

    function persistAndCalculate() {
      saveState(state, saveStateNode);
      calculateAll();
    }

    function renderTable(table, tableIndex) {
      var fragment = template.content.cloneNode(true);
      var card = fragment.querySelector(".table-card");
      var enabledInput = fragment.querySelector(".table-enabled");
      var nameInput = fragment.querySelector(".table-name");
      var tableTargetInput = fragment.querySelector(".table-target-x");
      var rowCountInput = fragment.querySelector(".row-count");
      var sampleButton = fragment.querySelector(".sample-table");
      var clearButton = fragment.querySelector(".clear-table");
      var resultY = fragment.querySelector(".table-result-y");
      var resultDetail = fragment.querySelector(".table-result-detail");
      var breakpointBody = fragment.querySelector(".breakpoint-body");

      enabledInput.checked = table.enabled;
      nameInput.value = table.name;
      tableTargetInput.value = table.targetX;
      rowCountInput.value = String(table.rows.length);

      enabledInput.addEventListener("change", function () {
        table.enabled = enabledInput.checked;
        persistAndCalculate();
      });

      nameInput.addEventListener("input", function () {
        table.name = nameInput.value.trim() || "Table " + (tableIndex + 1);
        persistAndCalculate();
      });

      tableTargetInput.addEventListener("input", function () {
        table.targetX = tableTargetInput.value;
        state.targetX = tableTargetInput.value;
        persistAndCalculate();
      });

      rowCountInput.addEventListener("change", function () {
        setRowCount(table, rowCountInput.value, tableIndex);
        rowCountInput.value = String(table.rows.length);
        renderBreakpointRows(breakpointBody, table, tableIndex, persistAndCalculate);
        persistAndCalculate();
      });

      sampleButton.addEventListener("click", function () {
        table.rows = makeRows(table.rows.length, tableIndex, true);
        renderBreakpointRows(breakpointBody, table, tableIndex, persistAndCalculate);
        persistAndCalculate();
      });

      clearButton.addEventListener("click", function () {
        table.rows = makeRows(table.rows.length, tableIndex, false);
        renderBreakpointRows(breakpointBody, table, tableIndex, persistAndCalculate);
        persistAndCalculate();
      });

      renderBreakpointRows(breakpointBody, table, tableIndex, persistAndCalculate);
      tableGrid.appendChild(fragment);

      tableViews[tableIndex] = {
        card: card,
        targetXInput: tableTargetInput,
        resultY: resultY,
        resultDetail: resultDetail,
      };
    }

    allTargetInput.value = state.targetX;
    allRowCountInput.value = String(DEFAULT_ROW_COUNT);
    state.tables.forEach(renderTable);

    allTargetInput.addEventListener("input", function () {
      state.targetX = allTargetInput.value;
      saveState(state, saveStateNode);
    });

    applyTargetButton.addEventListener("click", function () {
      state.targetX = allTargetInput.value;
      state.tables.forEach(function (table, tableIndex) {
        table.targetX = allTargetInput.value;
        if (tableViews[tableIndex]) {
          tableViews[tableIndex].targetXInput.value = allTargetInput.value;
        }
      });
      persistAndCalculate();
    });

    applyRowCountButton.addEventListener("click", function () {
      var nextCount = clampInteger(
        allRowCountInput.value,
        1,
        MAX_ROW_COUNT,
        DEFAULT_ROW_COUNT,
      );

      state.tables.forEach(function (table, tableIndex) {
        setRowCount(table, nextCount, tableIndex);
      });

      tableGrid.replaceChildren();
      tableViews = [];
      state.tables.forEach(renderTable);
      persistAndCalculate();
    });

    resetSampleButton.addEventListener("click", function () {
      state = makeDefaultState();
      allTargetInput.value = state.targetX;
      tableGrid.replaceChildren();
      tableViews = [];
      state.tables.forEach(renderTable);
      persistAndCalculate();
    });

    clearAllButton.addEventListener("click", function () {
      state.tables.forEach(function (table, tableIndex) {
        table.rows = makeRows(table.rows.length, tableIndex, false);
      });
      tableGrid.replaceChildren();
      tableViews = [];
      state.tables.forEach(renderTable);
      persistAndCalculate();
    });

    calculateAll();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      startApp(document);
    });
  }

  return {
    TABLE_COUNT: TABLE_COUNT,
    DEFAULT_ROW_COUNT: DEFAULT_ROW_COUNT,
    MAX_ROW_COUNT: MAX_ROW_COUNT,
    calculateLinearInterpolation: calculateLinearInterpolation,
    formatNumber: formatNumber,
    makeDefaultState: makeDefaultState,
    normalizeState: normalizeState,
  };
});
