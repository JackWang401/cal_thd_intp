# Table Linear Interpolation Tool

Static browser tool for checking linear interpolation and comparing four pairs of x/y table versions.

## Features

- Eight editable tables are grouped into four comparison rows.
- Each comparison row has two vertically stacked table versions on the left and one shared plot on the right.
- Each comparison row has one shared table name for both stacked versions.
- Each table displays breakpoints horizontally, with one `X` row and one `Y` row.
- Excel-copied X/Y data can be pasted into a breakpoint cell, including percentage-formatted values, and the table point count adjusts to the pasted data.
- One global `All X` field is used for interpolation across every table and version.
- Each table displays its own `Output Y` result field.
- Each version has a version-info field used as the plot legend.
- The shared plot draws both version curves with different colors, numeric X/Y ticks, editable axis labels, and the shared table name as its title.
- Each comparison row has its own `Split %` control and draggable divider for adjusting the border position between the table pane and plot pane.
- Each plot has its own `Plot W`, `Plot H`, axis label, and X/Y range controls.
- The `All X` control applies one input value to every table and version as it is edited.
- Out-of-range `x` values clamp to the nearest endpoint `y`.
- Each table can use a different number of breakpoints, from 1 to 64 points.
- Breakpoints may be entered in any order; calculation sorts by `x`.
- Duplicate `x` values are rejected because interpolation would be ambiguous.
- Previous table data is restored automatically from browser local storage.
- Every edit is autosaved locally in the browser.

## Use

Open `index.html` in a browser.

1. Enter the shared interpolation value in the `All X` field.
2. Edit that table's horizontal `X` and `Y` breakpoint rows, or paste copied Excel X/Y data into any breakpoint cell. Percent-formatted values such as `10%` are pasted as displayed numeric values such as `10`.
3. Adjust each table's `Points` value manually only when needed; pasted tables resize automatically.
4. Read the interpolated or clamped value in that table's `Output Y` field.
5. Edit `All X` to update the interpolation input for all tables and versions.
6. Use each row's right-side plot to compare the two version curves.
7. Adjust a row's `Split %` or drag its divider to resize that row's table/plot border.
8. Adjust a row's `Plot W`, `Plot H`, axis labels, or X/Y ranges to customize that plot.

The tool remembers shared table names, version info, enabled states, point counts, X/Y breakpoints, the global input X value, row split positions, and per-plot size, axis label, and range settings in the same browser.

## Version Control

This project is managed with git. Useful commands:

```bash
git status
git log --oneline --decorate
git tag
```

## Test

```bash
npm test
```
