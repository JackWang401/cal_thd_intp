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

  function formatOutputValue(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    if (Object.is(value, -0)) {
      return "0.000";
    }

    return value.toFixed(3);
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

  function defaultTableName(pairIndex) {
    return "Parameter " + (pairIndex + 1);
  }

  function defaultPlotSettings() {
    return {
      width: DEFAULT_PLOT_WIDTH,
      height: DEFAULT_PLOT_HEIGHT,
      xAxisLabel: "X",
      yAxisLabel: "Y",
      xMin: "",
      xMax: "",
      yMin: "",
      yMax: "",
    };
  }

  function normalizePlotSettings(settings, fallback) {
    var fallbackSettings = fallback || defaultPlotSettings();
    return {
      width: clampInteger(settings && settings.width, 300, 1800, fallbackSettings.width),
      height: clampInteger(settings && settings.height, 120, 520, fallbackSettings.height),
      xAxisLabel:
        settings && settings.xAxisLabel !== undefined && settings.xAxisLabel !== null
          ? String(settings.xAxisLabel).slice(0, 18)
          : fallbackSettings.xAxisLabel,
      yAxisLabel:
        settings && settings.yAxisLabel !== undefined && settings.yAxisLabel !== null
          ? String(settings.yAxisLabel).slice(0, 18)
          : fallbackSettings.yAxisLabel,
      xMin:
        settings && settings.xMin !== undefined && settings.xMin !== null
          ? String(settings.xMin).slice(0, 24)
          : fallbackSettings.xMin,
      xMax:
        settings && settings.xMax !== undefined && settings.xMax !== null
          ? String(settings.xMax).slice(0, 24)
          : fallbackSettings.xMax,
      yMin:
        settings && settings.yMin !== undefined && settings.yMin !== null
          ? String(settings.yMin).slice(0, 24)
          : fallbackSettings.yMin,
      yMax:
        settings && settings.yMax !== undefined && settings.yMax !== null
          ? String(settings.yMax).slice(0, 24)
          : fallbackSettings.yMax,
    };
  }

  function makeDefaultState() {
    return {
      targetX: "40",
      plotWidth: DEFAULT_PLOT_WIDTH,
      plotHeight: DEFAULT_PLOT_HEIGHT,
      xAxisLabel: "X",
      yAxisLabel: "Y",
      splitPercent: DEFAULT_SPLIT_PERCENT,
      pairSplits: Array.from({ length: PAIR_COUNT }, function () {
        return DEFAULT_SPLIT_PERCENT;
      }),
      plotSettings: Array.from({ length: PAIR_COUNT }, function () {
        return defaultPlotSettings();
      }),
      tables: Array.from({ length: TABLE_COUNT }, function (_, tableIndex) {
        var pairIndex = Math.floor(tableIndex / 2);
        return {
          name: defaultTableName(pairIndex),
          versionInfo: defaultVersionInfo(tableIndex),
          enabled: true,
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

  function stripExcelLabel(value) {
    var text = value === undefined || value === null ? "" : String(value).trim();
    return /^(x|y|#|point|points)$/i.test(text) ? "" : text;
  }

  function hasClipboardValue(value) {
    return stripExcelLabel(value) !== "";
  }

  function parseClipboardRows(text) {
    if (typeof text !== "string" || text.trim() === "") {
      return [];
    }

    return text
      .replace(/\r/g, "")
      .split("\n")
      .map(function (line) {
        return line.split("\t").map(function (cell) {
          return cell.trim();
        });
      })
      .filter(function (row) {
        return row.some(hasClipboardValue);
      });
  }

  function parsePastedTable(text) {
    var clipboardRows = parseClipboardRows(text);
    var points = [];

    if (clipboardRows.length < 1) {
      return points;
    }

    var looksVertical =
      clipboardRows.length > 2 ||
      (clipboardRows.length === 2 &&
        clipboardRows.every(function (row) {
          return row.filter(hasClipboardValue).length <= 2;
        }) &&
        !/^x$/i.test(String(clipboardRows[0][0] || "").trim()) &&
        !/^y$/i.test(String(clipboardRows[1][0] || "").trim()));

    if (looksVertical) {
      clipboardRows.some(function (row) {
        var values = row.map(stripExcelLabel).filter(function (value) {
          return value !== "";
        });

        if (values.length >= 2) {
          points.push({
            x: values[0],
            y: values[1],
          });
        }

        return points.length >= MAX_ROW_COUNT;
      });

      return points;
    }

    if (clipboardRows.length >= 2) {
      var xValues = clipboardRows[0].map(stripExcelLabel).filter(function (value) {
        return value !== "";
      });
      var yValues = clipboardRows[1].map(stripExcelLabel).filter(function (value) {
        return value !== "";
      });
      var horizontalCount = Math.min(xValues.length, yValues.length, MAX_ROW_COUNT);

      if (horizontalCount > 0) {
        for (var horizontalIndex = 0; horizontalIndex < horizontalCount; horizontalIndex += 1) {
          points.push({
            x: xValues[horizontalIndex],
            y: yValues[horizontalIndex],
          });
        }
        return points;
      }
    }

    return points;
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
            : fallbackTable.versionInfo,
        enabled: table && typeof table.enabled === "boolean" ? table.enabled : true,
        rows: normalizedRows.length > 0 ? normalizedRows : makeRows(1, tableIndex, false),
      };
    });
    var firstTableTarget =
      Array.isArray(candidate.tables) &&
      candidate.tables[0] &&
      candidate.tables[0].targetX !== undefined &&
      candidate.tables[0].targetX !== null
        ? String(candidate.tables[0].targetX)
        : null;

    for (var pairIndex = 0; pairIndex < PAIR_COUNT; pairIndex += 1) {
      var firstIndex = pairIndex * 2;
      var secondIndex = firstIndex + 1;
      var firstCandidate = Array.isArray(candidate.tables)
        ? candidate.tables[firstIndex]
        : null;
      var secondCandidate = Array.isArray(candidate.tables)
        ? candidate.tables[secondIndex]
        : null;
      var sharedName =
        firstCandidate &&
        typeof firstCandidate.name === "string" &&
        firstCandidate.name.trim() !== ""
          ? firstCandidate.name.slice(0, 32)
          : secondCandidate &&
              typeof secondCandidate.name === "string" &&
              secondCandidate.name.trim() !== ""
            ? secondCandidate.name.slice(0, 32)
            : defaultTableName(pairIndex);

      tables[firstIndex].name = sharedName;
      tables[secondIndex].name = sharedName;
    }

    var fallbackPlotSettings = normalizePlotSettings({
      width: candidate.plotWidth,
      height: candidate.plotHeight,
      xAxisLabel: candidate.xAxisLabel,
      yAxisLabel: candidate.yAxisLabel,
    });

    return {
      targetX:
        candidate.targetX !== undefined && candidate.targetX !== null
          ? String(candidate.targetX)
          : firstTableTarget || fallback.targetX,
      plotWidth: clampInteger(candidate.plotWidth, 300, 1800, fallback.plotWidth),
      plotHeight: clampInteger(candidate.plotHeight, 120, 520, fallback.plotHeight),
      xAxisLabel:
        candidate.xAxisLabel !== undefined && candidate.xAxisLabel !== null
          ? String(candidate.xAxisLabel).slice(0, 18)
          : fallback.xAxisLabel,
      yAxisLabel:
        candidate.yAxisLabel !== undefined && candidate.yAxisLabel !== null
          ? String(candidate.yAxisLabel).slice(0, 18)
          : fallback.yAxisLabel,
      splitPercent: clampInteger(
        candidate.splitPercent,
        35,
        75,
        fallback.splitPercent,
      ),
      pairSplits: Array.from({ length: PAIR_COUNT }, function (_, pairIndex) {
        var savedSplit = Array.isArray(candidate.pairSplits)
          ? candidate.pairSplits[pairIndex]
          : null;
        return clampInteger(
          savedSplit,
          35,
          75,
          clampInteger(candidate.splitPercent, 35, 75, fallback.splitPercent),
        );
      }),
      plotSettings: Array.from({ length: PAIR_COUNT }, function (_, pairIndex) {
        var savedSettings = Array.isArray(candidate.plotSettings)
          ? candidate.plotSettings[pairIndex]
          : null;
        return normalizePlotSettings(savedSettings, fallbackPlotSettings);
      }),
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

  function readManualRange(minInput, maxInput) {
    var minValue = parseFiniteNumber(minInput);
    var maxValue = parseFiniteNumber(maxInput);

    if (minValue === null || maxValue === null || minValue >= maxValue) {
      return null;
    }

    return {
      min: minValue,
      max: maxValue,
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
    pairViews.forEach(function (view, pairIndex) {
      var plotSettings = state.plotSettings[pairIndex] || defaultPlotSettings();
      if (view && view.plotSvg) {
        view.plotSvg.setAttribute("data-plot-width", String(plotSettings.width));
        view.plotSvg.setAttribute("data-plot-height", String(plotSettings.height));
        view.plotSvg.style.setProperty("--plot-width", plotSettings.width + "px");
        view.plotSvg.style.setProperty("--plot-height", plotSettings.height + "px");
      }
      if (view && view.card) {
        view.card.style.setProperty(
          "--pair-split-percent",
          (state.pairSplits[pairIndex] || DEFAULT_SPLIT_PERCENT) + "%",
        );
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

  function renderBreakpointRows(body, table, tableIndex, onChange, onPasteRows) {
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
      xInput.addEventListener("paste", onPasteRows);

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
      yInput.addEventListener("paste", onPasteRows);

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

  function clearChildren(node) {
    if (node) {
      node.replaceChildren();
    }
  }

  function tickValues(min, max, count) {
    var ticks = [];
    var tickCount = Math.max(2, count);

    if (min === max) {
      return [min];
    }

    for (var tickIndex = 0; tickIndex < tickCount; tickIndex += 1) {
      ticks.push(min + ((max - min) * tickIndex) / (tickCount - 1));
    }

    return ticks;
  }

  function appendSvgText(group, className, x, y, text, anchor) {
    var textNode = group.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "text");
    textNode.setAttribute("class", className);
    textNode.setAttribute("x", formatNumber(x));
    textNode.setAttribute("y", formatNumber(y));
    if (anchor) {
      textNode.setAttribute("text-anchor", anchor);
    }
    textNode.textContent = text;
    group.appendChild(textNode);
    return textNode;
  }

  function appendSvgLine(group, className, x1, y1, x2, y2) {
    var line = group.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", className);
    line.setAttribute("x1", formatNumber(x1));
    line.setAttribute("y1", formatNumber(y1));
    line.setAttribute("x2", formatNumber(x2));
    line.setAttribute("y2", formatNumber(y2));
    group.appendChild(line);
    return line;
  }

  function drawTicks(view, minX, maxX, minY, maxY, scaleX, scaleY, bounds) {
    clearChildren(view.xTicks);
    clearChildren(view.yTicks);

    tickValues(minX, maxX, 5).forEach(function (value) {
      var x = scaleX(value);
      appendSvgLine(view.xTicks, "plot-tick-line", x, bounds.bottom, x, bounds.bottom + 4);
      appendSvgText(
        view.xTicks,
        "plot-tick-text",
        x,
        bounds.bottom + 14,
        formatNumber(value),
        "middle",
      );
    });

    tickValues(minY, maxY, 5).forEach(function (value) {
      var y = scaleY(value);
      appendSvgLine(view.yTicks, "plot-tick-line", bounds.left - 4, y, bounds.left, y);
      appendSvgText(
        view.yTicks,
        "plot-tick-text",
        bounds.left - 7,
        y + 3,
        formatNumber(value),
        "end",
      );
    });
  }

  function truncateLabel(value, maxLength) {
    var text = value || "";
    if (text.length <= maxLength) {
      return text;
    }

    return text.slice(0, Math.max(1, maxLength - 1)) + "...";
  }

  function updatePlotText(view, tableA, tableB, plotWidth, plotHeight, bounds, xAxisLabel, yAxisLabel) {
    var title = truncateLabel(tableA.name || defaultTableName(0), 30);
    var legendA = truncateLabel(tableA.versionInfo || defaultVersionInfo(0), 18);
    var legendB = truncateLabel(tableB.versionInfo || defaultVersionInfo(1), 18);
    var legendBWidth = legendB.length * 6.2;
    var legendAWidth = legendA.length * 6.2;
    var legendAY = 18;
    var legendBY = 34;
    var legendBTextX = plotWidth - legendBWidth - 12;
    var legendBLineX2 = legendBTextX - 7;
    var legendBLineX1 = legendBLineX2 - 24;
    var legendATextX = plotWidth - legendAWidth - 12;
    var legendALineX2 = legendATextX - 7;
    var legendALineX1 = legendALineX2 - 24;
    var middleX = (bounds.left + bounds.right) / 2;
    var middleY = (bounds.top + bounds.bottom) / 2;

    view.plotTitle.setAttribute("x", formatNumber(middleX));
    view.plotTitle.setAttribute("y", "18");
    view.plotTitle.setAttribute("text-anchor", "middle");
    view.plotTitle.textContent = title;
    view.xLabel.setAttribute("x", formatNumber(middleX));
    view.xLabel.setAttribute("y", String(plotHeight - 6));
    view.xLabel.textContent = xAxisLabel || "X";
    view.yLabel.setAttribute("x", "12");
    view.yLabel.setAttribute("y", formatNumber(middleY));
    view.yLabel.setAttribute("transform", "rotate(-90 12 " + formatNumber(middleY) + ")");
    view.yLabel.textContent = yAxisLabel || "Y";

    view.legendALine.setAttribute("x1", formatNumber(legendALineX1));
    view.legendALine.setAttribute("x2", formatNumber(legendALineX2));
    view.legendALine.setAttribute("y1", String(legendAY));
    view.legendALine.setAttribute("y2", String(legendAY));
    view.legendA.setAttribute("x", formatNumber(legendATextX));
    view.legendA.setAttribute("y", String(legendAY + 4));
    view.legendA.textContent = legendA;

    view.legendBLine.setAttribute("x1", formatNumber(legendBLineX1));
    view.legendBLine.setAttribute("x2", formatNumber(legendBLineX2));
    view.legendBLine.setAttribute("y1", String(legendBY));
    view.legendBLine.setAttribute("y2", String(legendBY));
    view.legendB.setAttribute("x", formatNumber(legendBTextX));
    view.legendB.setAttribute("y", String(legendBY + 4));
    view.legendB.textContent = legendB;
  }

  function updateInputMarker(line, point, targetX, result, minX, maxX, scaleX, scaleY, top, bottom) {
    if (result.ok && Number.isFinite(result.y)) {
      var target = parseFiniteNumber(targetX);
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

  function updateComparisonPlot(view, tableA, resultA, tableB, resultB, targetX, plotSettings) {
    var activePlotSettings = plotSettings || defaultPlotSettings();
    var pointsA = tableA.enabled ? getCompleteSortedPoints(tableA.rows) : [];
    var pointsB = tableB.enabled ? getCompleteSortedPoints(tableB.rows) : [];
    var combined = pointsA.concat(pointsB);
    var plotRect = view.plotSvg.getBoundingClientRect();
    var plotWidth =
      Math.round(plotRect.width) ||
      Number(view.plotSvg.getAttribute("data-plot-width")) ||
      DEFAULT_PLOT_WIDTH;
    var plotHeight =
      Math.round(plotRect.height) ||
      Number(view.plotSvg.getAttribute("data-plot-height")) ||
      DEFAULT_PLOT_HEIGHT;
    var left = 68;
    var right = Math.max(left + 80, plotWidth - 18);
    var top = 42;
    var bottom = Math.max(top + 40, plotHeight - 34);
    var middleX = (left + right) / 2;
    var middleY = (top + bottom) / 2;
    var bounds = {
      left: left,
      right: right,
      top: top,
      bottom: bottom,
    };

    view.plotSvg.setAttribute("viewBox", "0 0 " + plotWidth + " " + plotHeight);
    updatePlotText(
      view,
      tableA,
      tableB,
      plotWidth,
      plotHeight,
      bounds,
      activePlotSettings.xAxisLabel,
      activePlotSettings.yAxisLabel,
    );
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
      clearChildren(view.xTicks);
      clearChildren(view.yTicks);
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
    var manualXRange = readManualRange(activePlotSettings.xMin, activePlotSettings.xMax);
    var manualYRange = readManualRange(activePlotSettings.yMin, activePlotSettings.yMax);

    if (manualXRange) {
      minX = manualXRange.min;
      maxX = manualXRange.max;
    }

    if (manualYRange) {
      minY = manualYRange.min;
      maxY = manualYRange.max;
    }

    var scaleX = makeScale(minX, maxX, left, right);
    var scaleY = makeScale(minY, maxY, bottom, top);

    view.emptyText.style.display = "none";
    view.lineA.setAttribute("points", pointsA.length >= 2 ? linePoints(pointsA, scaleX, scaleY) : "");
    view.lineB.setAttribute("points", pointsB.length >= 2 ? linePoints(pointsB, scaleX, scaleY) : "");
    drawDots(view.layerA, pointsA, scaleX, scaleY, "plot-dot-a");
    drawDots(view.layerB, pointsB, scaleX, scaleY, "plot-dot-b");
    drawTicks(view, minX, maxX, minY, maxY, scaleX, scaleY, bounds);
    updateInputMarker(
      view.inputLineA,
      view.inputPointA,
      targetX,
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
      targetX,
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
    var clearAllButton = documentRef.getElementById("clear-all");
    var saveStateNode = documentRef.getElementById("save-state");
    var tableGrid = documentRef.getElementById("table-grid");
    var comparisonTemplate = documentRef.getElementById("comparison-card-template");
    var versionTemplate = documentRef.getElementById("version-table-template");
    var tableViews = [];
    var pairViews = [];
    var resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(function () {
            calculateAll();
          })
        : null;

    function updateTableView(table, tableIndex, result) {
      var view = tableViews[tableIndex];
      var resultText = result.ok ? formatOutputValue(result.y) : "--";
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
          ? calculateLinearInterpolation(table.rows, state.targetX)
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
        var plotSettings = state.plotSettings[pairIndex] || defaultPlotSettings();
        updateComparisonPlot(
          view,
          state.tables[tableIndex],
          results[tableIndex],
          state.tables[tableIndex + 1],
          results[tableIndex + 1],
          state.targetX,
          plotSettings,
        );
      });
    }

    function persistAndCalculate() {
      saveState(state, saveStateNode);
      calculateAll();
    }

    function syncGlobalControls() {
      allTargetInput.value = state.targetX;
    }

    function setPairSplitPercent(pairIndex, nextPercent) {
      state.pairSplits[pairIndex] = clampInteger(
        Math.round(nextPercent),
        35,
        75,
        DEFAULT_SPLIT_PERCENT,
      );
      applyLayoutSettings(documentRef, state, pairViews);
      persistAndCalculate();
    }

    function attachSplitDrag(card, handle, pairIndex, splitInput) {
      handle.addEventListener("pointerdown", function (event) {
        var rect = card.getBoundingClientRect();

        if (rect.width <= 0 || window.matchMedia("(max-width: 1120px)").matches) {
          return;
        }

        event.preventDefault();
        handle.setPointerCapture(event.pointerId);

        function updateFromPointer(pointerEvent) {
          var currentRect = card.getBoundingClientRect();
          var nextPercent = ((pointerEvent.clientX - currentRect.left) / currentRect.width) * 100;
          setPairSplitPercent(pairIndex, nextPercent);
          splitInput.value = String(state.pairSplits[pairIndex]);
        }

        function stopDrag(pointerEvent) {
          handle.releasePointerCapture(pointerEvent.pointerId);
          handle.removeEventListener("pointermove", updateFromPointer);
          handle.removeEventListener("pointerup", stopDrag);
          handle.removeEventListener("pointercancel", stopDrag);
        }

        handle.addEventListener("pointermove", updateFromPointer);
        handle.addEventListener("pointerup", stopDrag);
        handle.addEventListener("pointercancel", stopDrag);
        updateFromPointer(event);
      });

      handle.addEventListener("keydown", function (event) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setPairSplitPercent(pairIndex, state.pairSplits[pairIndex] - 1);
          splitInput.value = String(state.pairSplits[pairIndex]);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          setPairSplitPercent(pairIndex, state.pairSplits[pairIndex] + 1);
          splitInput.value = String(state.pairSplits[pairIndex]);
        }
      });
    }

    function renderVersionTable(table, tableIndex, pairView) {
      var fragment = versionTemplate.content.cloneNode(true);
      var panel = fragment.querySelector(".version-table");
      var enabledInput = fragment.querySelector(".table-enabled");
      var versionInput = fragment.querySelector(".table-version");
      var rowCountInput = fragment.querySelector(".row-count");
      var clearButton = fragment.querySelector(".clear-table");
      var resultY = fragment.querySelector(".table-result-y");
      var resultDetail = fragment.querySelector(".table-result-detail");
      var breakpointBody = fragment.querySelector(".breakpoint-body");

      enabledInput.checked = table.enabled;
      versionInput.value = table.versionInfo;
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

      rowCountInput.addEventListener("change", function () {
        setRowCount(table, rowCountInput.value, tableIndex);
        rowCountInput.value = String(table.rows.length);
        renderBreakpointRows(breakpointBody, table, tableIndex, persistAndCalculate, handlePasteRows);
        persistAndCalculate();
      });

      clearButton.addEventListener("click", function () {
        table.rows = makeRows(table.rows.length, tableIndex, false);
        renderBreakpointRows(breakpointBody, table, tableIndex, persistAndCalculate, handlePasteRows);
        persistAndCalculate();
      });

      function handlePasteRows(event) {
        var pastedText =
          event.clipboardData && typeof event.clipboardData.getData === "function"
            ? event.clipboardData.getData("text")
            : "";
        var pastedRows = parsePastedTable(pastedText);

        if (pastedRows.length < 1) {
          return;
        }

        event.preventDefault();
        table.rows = pastedRows;
        rowCountInput.value = String(table.rows.length);
        renderBreakpointRows(breakpointBody, table, tableIndex, persistAndCalculate, handlePasteRows);
        persistAndCalculate();
      }

      renderBreakpointRows(breakpointBody, table, tableIndex, persistAndCalculate, handlePasteRows);

      tableViews[tableIndex] = {
        panel: panel,
        resultY: resultY,
        resultDetail: resultDetail,
      };

      return fragment;
    }

    function renderPair(pairIndex) {
      var fragment = comparisonTemplate.content.cloneNode(true);
      var card = fragment.querySelector(".comparison-card");
      var stack = fragment.querySelector(".version-stack");
      var splitHandle = fragment.querySelector(".split-handle");
      var pairNameInput = fragment.querySelector(".pair-table-name");
      var pairSplitInput = fragment.querySelector(".pair-split-percent");
      var plotWidthInput = fragment.querySelector(".pair-plot-width");
      var plotHeightInput = fragment.querySelector(".pair-plot-height");
      var xAxisLabelInput = fragment.querySelector(".pair-x-axis-label");
      var yAxisLabelInput = fragment.querySelector(".pair-y-axis-label");
      var xMinInput = fragment.querySelector(".pair-x-min");
      var xMaxInput = fragment.querySelector(".pair-x-max");
      var yMinInput = fragment.querySelector(".pair-y-min");
      var yMaxInput = fragment.querySelector(".pair-y-max");
      var pairView = {
        card: card,
        plotSvg: fragment.querySelector(".comparison-plot"),
        plotTitle: fragment.querySelector(".plot-title"),
        xTicks: fragment.querySelector(".plot-x-ticks"),
        yTicks: fragment.querySelector(".plot-y-ticks"),
        xLabel: fragment.querySelector(".plot-x-label"),
        yLabel: fragment.querySelector(".plot-y-label"),
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
        legendALine: fragment.querySelector(".legend-a-line"),
        legendBLine: fragment.querySelector(".legend-b-line"),
        legendA: fragment.querySelector(".legend-a-text"),
        legendB: fragment.querySelector(".legend-b-text"),
      };
      var tableIndex = pairIndex * 2;
      var plotSettings = state.plotSettings[pairIndex] || defaultPlotSettings();

      pairViews[pairIndex] = pairView;
      if (resizeObserver) {
        resizeObserver.observe(pairView.plotSvg);
      }
      pairNameInput.value = state.tables[tableIndex].name;
      pairNameInput.addEventListener("input", function () {
        var sharedName = pairNameInput.value.trim() || defaultTableName(pairIndex);
        state.tables[tableIndex].name = sharedName;
        state.tables[tableIndex + 1].name = sharedName;
        persistAndCalculate();
      });
      pairSplitInput.value = String(state.pairSplits[pairIndex] || DEFAULT_SPLIT_PERCENT);
      pairSplitInput.addEventListener("input", function () {
        state.pairSplits[pairIndex] = updateNumberControl(
          pairSplitInput,
          state.pairSplits[pairIndex],
          35,
          75,
          DEFAULT_SPLIT_PERCENT,
          false,
        );
        applyLayoutSettings(documentRef, state, pairViews);
        persistAndCalculate();
      });
      pairSplitInput.addEventListener("change", function () {
        state.pairSplits[pairIndex] = updateNumberControl(
          pairSplitInput,
          state.pairSplits[pairIndex],
          35,
          75,
          DEFAULT_SPLIT_PERCENT,
          true,
        );
        applyLayoutSettings(documentRef, state, pairViews);
        persistAndCalculate();
      });
      plotWidthInput.value = String(plotSettings.width);
      plotWidthInput.addEventListener("input", function () {
        plotSettings.width = updateNumberControl(
          plotWidthInput,
          plotSettings.width,
          300,
          1800,
          DEFAULT_PLOT_WIDTH,
          false,
        );
        state.plotSettings[pairIndex] = plotSettings;
        applyLayoutSettings(documentRef, state, pairViews);
        persistAndCalculate();
      });
      plotWidthInput.addEventListener("change", function () {
        plotSettings.width = updateNumberControl(
          plotWidthInput,
          plotSettings.width,
          300,
          1800,
          DEFAULT_PLOT_WIDTH,
          true,
        );
        state.plotSettings[pairIndex] = plotSettings;
        applyLayoutSettings(documentRef, state, pairViews);
        persistAndCalculate();
      });
      plotHeightInput.value = String(plotSettings.height);
      plotHeightInput.addEventListener("input", function () {
        plotSettings.height = updateNumberControl(
          plotHeightInput,
          plotSettings.height,
          120,
          520,
          DEFAULT_PLOT_HEIGHT,
          false,
        );
        state.plotSettings[pairIndex] = plotSettings;
        applyLayoutSettings(documentRef, state, pairViews);
        persistAndCalculate();
      });
      plotHeightInput.addEventListener("change", function () {
        plotSettings.height = updateNumberControl(
          plotHeightInput,
          plotSettings.height,
          120,
          520,
          DEFAULT_PLOT_HEIGHT,
          true,
        );
        state.plotSettings[pairIndex] = plotSettings;
        applyLayoutSettings(documentRef, state, pairViews);
        persistAndCalculate();
      });
      xAxisLabelInput.value = plotSettings.xAxisLabel;
      xAxisLabelInput.addEventListener("input", function () {
        plotSettings.xAxisLabel = xAxisLabelInput.value.trim() || "X";
        state.plotSettings[pairIndex] = plotSettings;
        persistAndCalculate();
      });
      yAxisLabelInput.value = plotSettings.yAxisLabel;
      yAxisLabelInput.addEventListener("input", function () {
        plotSettings.yAxisLabel = yAxisLabelInput.value.trim() || "Y";
        state.plotSettings[pairIndex] = plotSettings;
        persistAndCalculate();
      });
      function bindRangeInput(input, key) {
        input.value = plotSettings[key] || "";
        input.addEventListener("input", function () {
          plotSettings[key] = input.value.trim();
          state.plotSettings[pairIndex] = plotSettings;
          persistAndCalculate();
        });
      }

      bindRangeInput(xMinInput, "xMin");
      bindRangeInput(xMaxInput, "xMax");
      bindRangeInput(yMinInput, "yMin");
      bindRangeInput(yMaxInput, "yMax");
      attachSplitDrag(card, splitHandle, pairIndex, pairSplitInput);
      stack.appendChild(renderVersionTable(state.tables[tableIndex], tableIndex, pairView));
      stack.appendChild(renderVersionTable(state.tables[tableIndex + 1], tableIndex + 1, pairView));
      tableGrid.appendChild(fragment);
    }

    function renderAllPairs() {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      tableGrid.replaceChildren();
      tableViews = [];
      pairViews = [];
      for (var pairIndex = 0; pairIndex < PAIR_COUNT; pairIndex += 1) {
        renderPair(pairIndex);
      }
      applyLayoutSettings(documentRef, state, pairViews);
    }

    allTargetInput.value = state.targetX;
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
    formatOutputValue: formatOutputValue,
    formatNumber: formatNumber,
    getCompleteSortedPoints: getCompleteSortedPoints,
    makeDefaultState: makeDefaultState,
    normalizeState: normalizeState,
    parsePastedTable: parsePastedTable,
    loadState: loadState,
  };
});
