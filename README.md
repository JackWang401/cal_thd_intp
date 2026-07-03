# Table Linear Interpolation Tool

Static browser tool for checking linear interpolation across eight x/y tables at the same time.

## Features

- Eight editable tables are available on one screen.
- A shared `Input X` value recalculates every enabled table automatically.
- Out-of-range `x` values clamp to the nearest endpoint `y`.
- Each table can use a different number of breakpoints, from 1 to 64 rows.
- Breakpoints may be entered in any order; calculation sorts by `x`.
- Duplicate `x` values are rejected because interpolation would be ambiguous.
- Table data is saved in browser local storage.

## Use

Open `index.html` in a browser.

1. Enter the target value in `Input X`.
2. Edit each table's `X` and `Y` breakpoint rows.
3. Adjust each table's `Rows` value, or use the global `Rows` field with `Apply Rows`.
4. Read the interpolated or clamped `Y` result in the Results table.

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
