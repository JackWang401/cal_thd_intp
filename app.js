(function (root, factory) {
  var app = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = app;
  }

  root.InterpolationApp = app;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TABLE_COUNT = 8;
  var PAIR_COUNT = TABLE_COUNT / 2;
  var DEFAULT_ROW_COUNT = 5;
  var MAX_ROW_COUNT = 64;
  var DEFAULT_PLOT_WIDTH = 720;
  var DEFAULT_PLOT_HEIGHT = 220;
  var DEFAULT_SPLIT_PERCENT = 54;
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
      var yValue = (Math.floor(tableIndex / 2) + 1) * 12 + rowIndex * 5;
      var versionOffset = tableIndex % 2 === 0 ? 0 : 8 + rowIndex * 2;
      rows.push({
        x: withSample ? String(xValue) : "",
        y: withSample ? String(yValue + versionOffset) : "",
      });
    }

    return rows;
  }

  function defaultVersionInfo(tableIndex) {
    return tableIndex % 2 === 0 ? "Version A" : "Version B";
  }

  function makeDefaultState() {
    return {
      targetX: "40",
      plotWidth: DEFAULT_PLOT_WIDTH,
      plotHeight: DEFAULT_PLOT_HEIGHT,
      splitPercent: DEFAULT_SPLIT_PERCENT,
      tables: Array.from({ length: TABLE_COUNT }, function (_, tableIndex) {
        return {
          name: "Parameter " + (Math.floor(tableIndex / 2) + 1),
          versionInfo: defaultVersionInfo(tableIndex),
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
        versionInfo:
          table && typeof table.versionInfo === "string" && table.versionInfo.trim() !== ""
            ? table.versionInfo.slice(0, 40)
            : table && typeof table.name === "string" && table.name.trim() !== ""
              ? table.name.slice(0, 40)
              : fallbackTable.versionInfo,
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
      plotWidth: clampInteger(candidate.plotWidth, 300, 1800, fallback.plotWidth),
      plotHeight: clampInteger(candidate.plotHeight, 120, 520, fallback.plotHeight),
      splitPercent: clampInteger(
        candidate.splitPercent,
        35,
        75,
        fallback.splitPercent,
      ),
      tables: tables,
      updatedAt:
        candidate.updatedAt !== undefined && candidate.updatedAt !== null
          ? String(candidate.updatedAt)
          : null,
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

  function getCompleteSortedPoints(rows) {
    var points = [];

    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      var x = parseFiniteNumber(row && row.x);
      var y = parseFiniteNumber(row && row.y);
      if (x !== null && y !== null) {
        points.push({
          x: x,
          y: y,
        });
      }
    });

    points.sort(function (left, right) {
      return left.x - right.x;
    });

    return points;
  }

  function makeScale(min, max, start, end) {
    if (min === max) {
      return function () {
        return (start + end) / 2;
      };
    }

    return function (value) {
      return start + ((value - min) / (max - min)) * (end - start);
    };
  }

  function setSaveStatus(statusNode, text, level) {
    if (!statusNode) {
      return;
    }

    statusNode.textContent = text;
    statusNode.className = "save-state";
    if (level) {
      statusNode.classList.add("status-" + level);
    }
  }

  function formatSavedAt(isoValue) {
    if (!isoValue) {
      return "";
    }

    var date = new Date(isoValue);
    if (!Number.isFinite(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function readSavedState() {
    if (typeof window === "undefined" || !window.localStorage) {
      return {
        state: makeDefaultState(),
        restored: false,
        error: false,
      };
    }

    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          state: makeDefaultState(),
          restored: false,
          error: false,
        };
      }

      return {
        state: normalizeState(JSON.parse(raw)),
        restored: true,
        error: false,
      };
    } catch (error) {
      return {
        state: makeDefaultState(),
        restored: false,
        error: true,
      };
    }
  }

  function loadState() {
    return readSavedState().state;
  }

  function saveState(state, statusNode) {
    try {
      state.updatedAt = new Date().toISOString();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveStatus(statusNode, "Autosaved " + formatSavedAt(state.updatedAt), "ok");
    } catch (error) {
      setSaveStatus(statusNode, "Not saved locally", "error");
    }
  }

  function applyLayoutSettings(documentRef, state, pairViews) {
    documentRef.documentElement.style.setProperty(
      "--plot-width",
      state.plotWidth + "px",
    );
    documentRef.documentElement.style.setProperty(
      "--plot-height",
      state.plotHeight + "px",
    );
    documentRef.documentElement.style.setProperty(
      "--split-percent",
      state.splitPercent + "%",
    );

    pairViews.forEach(function (view) {
      if (view && view.plotSvg) {
        view.plotSvg.setAttribute("data-plot-width", String(state.plotWidth));
        view.plotSvg.setAttribute("data-plot-height", String(state.plotHeight));
      }
    });
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
      xInput.setAttribute(
        "aria-label",
        "Table " + (tableIndex + 1) + " row " + (rowIndex + 1) + " X",
      );
      xInput.addEventListener("input", function () {
        row.x = xInput.value;
        onChange();
      });

      yInput.type = "number";
      yInput.step = "any";
      yInput.inputMode = "decimal";
      yInput.value = row.y;
      yInput.setAttribute(
        "aria-label",
        "Table " + (tableIndex + 1) + " row " + (rowIndex + 1) + " Y",
      );
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

  function linePoints(points, scaleX, scaleY) {
    return points
      .map(function (point) {
        return formatNumber(scaleX(point.x)) + "," + formatNumber(scaleY(point.y));
      })
      .join(" ");
  }

  function drawDots(layer, points, scaleX, scaleY, className) {
    var svgDocument = layer.ownerDocument;
    layer.replaceChildren();
    points.forEach(function (point) {
      var dot = svgDocument.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("class", "plot-dot " + className);
      dot.setAttribute("cx", formatNumber(scaleX(point.x)));
      dot.setAttribute("cy", formatNumber(scaleY(point.y)));
      dot.setAttribute("r", "2.6");
      layer.appendChild(dot);
    });
  }

  function updateInputMarker(line, point, table, result, minX, maxX, scaleX, scaleY, top, bottom) {
    if (result.ok && Number.isFinite(result.y)) {
      var target = parseFiniteNumber(table.targetX);
      var clampedTarget = Math.min(maxX, Math.max(minX, target));
      var inputX = scaleX(clampedTarget);
      var inputY = scaleY(result.y);

      line.setAttribute("x1", formatNumber(inputX));
      line.setAttribute("y1", String(top));
      line.setAttribute("x2", formatNumber(inputX));
      line.setAttribute("y2", String(bottom));
      line.style.display = "block";
      point.setAttribute("cx", formatNumber(inputX));
      point.setAttribute("cy", formatNumber(inputY));
      point.style.display = "block";
    } else {
      line.style.display = "none";
      point.style.display = "none";
    }
  }

  function updateComparisonPlot(view, tableA, resultA, tableB, resultB) {
    var pointsA = tableA.enabled ? getCompleteSortedPoints(tableA.rows) : [];
    var pointsB = tableB.enabled ? getCompleteSortedPoints(tableB.rows) : [];
    var combined = pointsA.concat(pointsB);
    var plotWidth = Number(view.plotSvg.getAttribute("data-plot-width")) || DEFAULT_PLOT_WIDTH;
    var plotHeight = Number(view.plotSvg.getAttribute("data-plot-height")) || DEFAULT_PLOT_HEIGHT;
    var left = 34;
    var right = Math.max(left + 20, plotWidth - 30);
    var top = 14;
    var bottom = Math.max(top + 20, plotHeight - 30);
    var middleX = (left + right) / 2;
    var middleY = (top + bottom) / 2;

    view.plotSvg.setAttribute("viewBox", "0 0 " + plotWidth + " " + plotHeight);
    view.axisX.setAttribute("x1", String(left));
    view.axisX.setAttribute("y1", String(bottom));
    view.axisX.setAttribute("x2", String(right));
    view.axisX.setAttribute("y2", String(bottom));
    view.axisY.setAttribute("x1", String(left));
    view.axisY.setAttribute("y1", String(top));
    view.axisY.setAttribute("x2", String(left));
    view.axisY.setAttribute("y2", String(bottom));
    view.emptyText.setAttribute("x", String(middleX));
    view.emptyText.setAttribute("y", String(middleY));
    view.legendA.textContent = tableA.versionInfo || defaultVersionInfo(0);
    view.legendB.textContent = tableB.versionInfo || defaultVersionInfo(1);

    if (combined.length < 2 || (pointsA.length < 2 && pointsB.length < 2)) {
      view.lineA.setAttribute("points", "");
      view.lineB.setAttribute("points", "");
      view.emptyText.style.display = "block";
      view.layerA.replaceChildren();
      view.layerB.replaceChildren();
      view.inputLineA.style.display = "none";
      view.inputLineB.style.display = "none";
      view.inputPointA.style.display = "none";
      view.inputPointB.style.display = "none";
      view.xMin.textContent = "--";
      view.xMax.textContent = "--";
      return;
    }

    var xValues = combined.map(function (point) {
      return point.x;
    });
    var yValues = combined.map(function (point) {
      return point.y;
    });
    var minX = Math.min.apply(null, xValues);
    var maxX = Math.max.apply(null, xValues);
    var minY = Math.min.apply(null, yValues);
    var maxY = Math.max.apply(null, yValues);
    var scaleX = makeScale(minX, maxX, left, right);
    var scaleY = makeScale(minY, maxY, bottom, top);

    view.emptyText.style.display = "none";
    view.lineA.setAttribute("points", pointsA.length >= 2 ? linePoints(pointsA, scaleX, scaleY) : "");
    view.lineB.setAttribute("points", pointsB.length >= 2 ? linePoints(pointsB, scaleX, scaleY) : "");
    drawDots(view.layerA, pointsA, scaleX, scaleY, "plot-dot-a");
    drawDots(view.layerB, pointsB, scaleX, scaleY, "plot-dot-b");
    view.xMin.textContent = "x " + formatNumber(minX);
    view.xMax.textContent = "x " + formatNumber(maxX);
    updateInputMarker(
      view.inputLineA,
      view.inputPointA,
      tableA,
      resultA,
      minX,
      maxX,
      scaleX,
      scaleY,
      top,
      bottom,
    );
    updateInputMarker(
      view.inputLineB,
      view.inputPointB,
      tableB,
      resultB,
      minX,
      maxX,
      scaleX,
      scaleY,
      top,
      bottom,
    );
  }

  function startApp(doc) {
    var documentRef = doc || document;
    var savedState = readSavedState();
    var state = savedState.state;
    var allTargetInput = documentRef.getElementById("all-target-x");
    var applyTargetButton = documentRef.getElementById("apply-target-x");
    var allRowCountInput = documentRef.getElementById("all-row-count");
    var applyRowCountButton = documentRef.getElementById("apply-row-count");
    var splitPercentInput = documentRef.getElementById("split-percent");
    var plotWidthInput = documentRef.getElementById("plot-width");
    var plotHeightInput = documentRef.getElementById("plot-height");
    var resetSampleButton = documentRef.getElementById("reset-sample");
    var clearAllButton = documentRef.getElementById("clear-all");
    var saveStateNode = documentRef.getElementById("save-state");
    var tableGrid = documentRef.getElementById("table-grid");
    var comparisonTemplate = documentRef.getElementById("comparison-card-template");
    var versionTemplate = documentRef.getElementById("version-table-template");
    var tableViews = [];
    var pairViews = [];

    function updateTableView(table, tableIndex, result) {
      var view = tableViews[tableIndex];
      var resultText = result.ok ? formatNumber(result.y) : "--";
      var statusClass =
        result.level === "ok"
          ? "status-ok"
          : result.level === "warn"
            ? "status-warn"
            : "status-error";

      view.panel.classList.toggle("disabled", !table.enabled);
      view.resultY.textContent = resultText;
      view.resultDetail.textContent = result.message + " | " + result.range;
      view.resultDetail.className = "table-result-detail " + statusClass;
    }

    function calculateAll() {
      var results = state.tables.map(function (table) {
        return table.enabled
          ? calculateLinearInterpolation(table.rows, table.targetX)
          : {
              ok: false,
              level: "warn",
              y: null,
              message: "Disabled",
              range: "--",
            };
      });

      state.tables.forEach(function (table, tableIndex) {
        updateTableView(table, tableIndex, results[tableIndex]);
      });

      pairViews.forEach(function (view, pairIndex) {
        var tableIndex = pairIndex * 2;
        updateComparisonPlot(
          view,
          state.tables[tableIndex],
          results[tableIndex],
          state.tables[tableIndex + 1],
          results[tableIndex + 1],
        );
      });
    }

    function persistAndCalculate() {
      saveState(state, saveStateNode);
      calculateAll();
    }

    function renderVersionTable(table, tableIndex, pairView) {
      var fragment = versionTemplate.content.cloneNode(true);
      var panel = fragment.querySelector(".version-table");
      var enabledInput = fragment.querySelector(".table-enabled");
      var versionInput = fragment.querySelector(".table-version");
      var tableTargetInput = fragment.querySelector(".table-target-x");
      var rowCountInput = fragment.querySelector(".row-count");
      var sampleButton = fragment.querySelector(".sample-table");
      var clearButton = fragment.querySelector(".clear-table");
      var resultY = fragment.querySelector(".table-result-y");
      var resultDetail = fragment.querySelector(".table-result-detail");
      var breakpointBody = fragment.querySelector(".breakpoint-body");

      enabledInput.checked = table.enabled;
      versionInput.value = table.versionInfo;
      tableTargetInput.value = table.targetX;
      rowCountInput.value = String(table.rows.length);

      enabledInput.addEventListener("change", function () {
        table.enabled = enabledInput.checked;
        persistAndCalculate();
      });

      versionInput.addEventListener("input", function () {
        table.versionInfo = versionInput.value.trim() || defaultVersionInfo(tableIndex);
        pairView.legendA.textContent = state.tables[Math.floor(tableIndex / 2) * 2].versionInfo;
        pairView.legendB.textContent = state.tables[Math.floor(tableIndex / 2) * 2 + 1].versionInfo;
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

      tableViews[tableIndex] = {
        panel: panel,
        targetXInput: tableTargetInput,
        resultY: resultY,
        resultDetail: resultDetail,
      };

      return fragment;
    }

    function renderPair(pairIndex) {
      var fragment = comparisonTemplate.content.cloneNode(true);
      var card = fragment.querySelector(".comparison-card");
      var stack = fragment.querySelector(".version-stack");
      var pairView = {
        card: card,
        plotSvg: fragment.querySelector(".comparison-plot"),
        axisX: fragment.querySelector(".plot-axis-x"),
        axisY: fragment.querySelector(".plot-axis-y"),
        lineA: fragment.querySelector(".plot-line-a"),
        lineB: fragment.querySelector(".plot-line-b"),
        inputLineA: fragment.querySelector(".plot-input-line-a"),
        inputLineB: fragment.querySelector(".plot-input-line-b"),
        inputPointA: fragment.querySelector(".plot-input-point-a"),
        inputPointB: fragment.querySelector(".plot-input-point-b"),
        layerA: fragment.querySelector(".plot-point-layer-a"),
        layerB: fragment.querySelector(".plot-point-layer-b"),
        emptyText: fragment.querySelector(".plot-empty"),
        xMin: fragment.querySelector(".plot-x-min"),
        xMax: fragment.querySelector(".plot-x-max"),
        legendA: fragment.querySelector(".legend-a-text"),
        legendB: fragment.querySelector(".legend-b-text"),
      };
      var tableIndex = pairIndex * 2;

      pairViews[pairIndex] = pairView;
      stack.appendChild(renderVersionTable(state.tables[tableIndex], tableIndex, pairView));
      stack.appendChild(renderVersionTable(state.tables[tableIndex + 1], tableIndex + 1, pairView));
      tableGrid.appendChild(fragment);
    }

    function renderAllPairs() {
      tableGrid.replaceChildren();
      tableViews = [];
      pairViews = [];
      for (var pairIndex = 0; pairIndex < PAIR_COUNT; pairIndex += 1) {
        renderPair(pairIndex);
      }
      applyLayoutSettings(documentRef, state, pairViews);
    }

    allTargetInput.value = state.targetX;
    allRowCountInput.value = String(DEFAULT_ROW_COUNT);
    splitPercentInput.value = String(state.splitPercent);
    plotWidthInput.value = String(state.plotWidth);
    plotHeightInput.value = String(state.plotHeight);
    renderAllPairs();

    if (savedState.error) {
      setSaveStatus(saveStateNode, "Using defaults; local save unavailable", "error");
    } else if (savedState.restored) {
      var restoredAt = formatSavedAt(state.updatedAt);
      setSaveStatus(
        saveStateNode,
        restoredAt ? "Restored saved data " + restoredAt : "Restored saved data",
        "ok",
      );
    } else {
      setSaveStatus(saveStateNode, "Using sample data", "warn");
      saveState(state, saveStateNode);
    }

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

      renderAllPairs();
      persistAndCalculate();
    });

    function updateNumberControl(input, currentValue, min, max, fallback, commit) {
      var nextValue = Number.parseInt(input.value, 10);
      if (!Number.isFinite(nextValue)) {
        if (commit) {
          input.value = String(currentValue);
        }
        return currentValue;
      }

      if (nextValue < min || nextValue > max) {
        if (!commit) {
          return currentValue;
        }
        nextValue = clampInteger(nextValue, min, max, fallback);
        input.value = String(nextValue);
      }

      return nextValue;
    }

    function updateSplit(commit) {
      state.splitPercent = updateNumberControl(
        splitPercentInput,
        state.splitPercent,
        35,
        75,
        DEFAULT_SPLIT_PERCENT,
        commit,
      );
      applyLayoutSettings(documentRef, state, pairViews);
      persistAndCalculate();
    }

    function updatePlotWidth(commit) {
      state.plotWidth = updateNumberControl(
        plotWidthInput,
        state.plotWidth,
        300,
        1800,
        DEFAULT_PLOT_WIDTH,
        commit,
      );
      applyLayoutSettings(documentRef, state, pairViews);
      persistAndCalculate();
    }

    function updatePlotHeight(commit) {
      state.plotHeight = updateNumberControl(
        plotHeightInput,
        state.plotHeight,
        120,
        520,
        DEFAULT_PLOT_HEIGHT,
        commit,
      );
      applyLayoutSettings(documentRef, state, pairViews);
      persistAndCalculate();
    }

    splitPercentInput.addEventListener("input", function () {
      updateSplit(false);
    });
    splitPercentInput.addEventListener("change", function () {
      updateSplit(true);
    });
    plotWidthInput.addEventListener("input", function () {
      updatePlotWidth(false);
    });
    plotWidthInput.addEventListener("change", function () {
      updatePlotWidth(true);
    });
    plotHeightInput.addEventListener("input", function () {
      updatePlotHeight(false);
    });
    plotHeightInput.addEventListener("change", function () {
      updatePlotHeight(true);
    });

    resetSampleButton.addEventListener("click", function () {
      state = makeDefaultState();
      allTargetInput.value = state.targetX;
      splitPercentInput.value = String(state.splitPercent);
      plotWidthInput.value = String(state.plotWidth);
      plotHeightInput.value = String(state.plotHeight);
      renderAllPairs();
      persistAndCalculate();
    });

    clearAllButton.addEventListener("click", function () {
      state.tables.forEach(function (table, tableIndex) {
        table.rows = makeRows(table.rows.length, tableIndex, false);
      });
      renderAllPairs();
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
    PAIR_COUNT: PAIR_COUNT,
    DEFAULT_ROW_COUNT: DEFAULT_ROW_COUNT,
    MAX_ROW_COUNT: MAX_ROW_COUNT,
    DEFAULT_PLOT_WIDTH: DEFAULT_PLOT_WIDTH,
    DEFAULT_PLOT_HEIGHT: DEFAULT_PLOT_HEIGHT,
    DEFAULT_SPLIT_PERCENT: DEFAULT_SPLIT_PERCENT,
    calculateLinearInterpolation: calculateLinearInterpolation,
    formatNumber: formatNumber,
    getCompleteSortedPoints: getCompleteSortedPoints,
    makeDefaultState: makeDefaultState,
    normalizeState: normalizeState,
    loadState: loadState,
  };
});
