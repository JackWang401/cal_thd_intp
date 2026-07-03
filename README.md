# Table Linear Interpolation Tool

Static browser tool for checking linear interpolation across eight x/y tables at the same time.

## Features

- Eight compact editable tables are available on one screen.
- Each table displays breakpoints horizontally, with one `X` row and one `Y` row.
- Each table has its own `Input X` field and `Output Y` result field.
- Each table includes a compact line plot with straight segments linking X/Y points.
- The `All X` control can apply one input value to every table.
- Out-of-range `x` values clamp to the nearest endpoint `y`.
- Each table can use a different number of breakpoints, from 1 to 64 points.
- Breakpoints may be entered in any order; calculation sorts by `x`.
- Duplicate `x` values are rejected because interpolation would be ambiguous.
- Previous table data is restored automatically from browser local storage.
- Every edit is autosaved locally in the browser.

## Use

Open `index.html` in a browser.

1. Enter the target value in a table's `Input X` field.
2. Edit that table's horizontal `X` and `Y` breakpoint rows.
3. Adjust each table's `Points` value, or use the global `Points` field with `Apply Points`.
4. Read the interpolated or clamped value in that table's `Output Y` field.
5. Use `All X` and `Apply X` when every table should use the same input value.
6. Use the plot below each table to inspect the straight-line interpolation shape.

The tool remembers table names, enabled states, point counts, X/Y breakpoints, and input X values in the same browser.

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
