# Offset Calculator

Project how much interest an offset account saves on a mortgage, month by month.
Built as a single React + Vite app that runs in the browser and packages to iOS
and Android through Capacitor.

The original single-file prototype is kept at `offset-calculator.html` for
reference; nothing in the app depends on it.

## Running it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run build:static` | Build one self-contained HTML file to `dist-static/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm run sync` | Build, then copy the web build into the native projects |
| `npm run ios` | Sync and open the iOS project in Xcode |
| `npm run android` | Sync and open the Android project in Android Studio |

## Opening it without a server

```bash
npm run build:static
```

That writes a single **`dist-static/offset-calculator.html`** (~240 KB) that you
can double-click, email, or drop on a USB stick. No server, no sibling files,
no network requests at all — the JS, the CSS and the favicon are all inlined.

The ordinary `npm run build` output cannot be opened this way. A `file://` page
has an opaque origin, so the browser refuses to fetch its own sibling files, and
the `<script type="module">` a normal Vite build emits is blocked outright. The
static build therefore differs in three ways, all in `vite.config.ts`:

- everything is inlined, so there is nothing to fetch;
- the bundle is emitted as a classic `iife` script rather than an ES module;
- that script is injected at the end of `<body>`, not in `<head>` — a module
  script is deferred until the document is parsed, but a classic one is not, so
  in `<head>` it would run before `#root` exists and React would fail to mount.

The build asserts all three before writing the file, so a regression fails the
build rather than producing an HTML file that silently breaks on disk.

One caveat: some browsers restrict `localStorage` for pages loaded from disk. If
yours does, the calculator still works normally but will not remember your
inputs between sessions — export a profile to keep it.

## Packaging as a native app

The Capacitor config is already in place (`capacitor.config.ts`, app id
`com.offsetcalc.app`). Add whichever platforms you want — this only needs doing
once, and requires Xcode / Android Studio locally:

```bash
npx cap add ios
npx cap add android
```

Then, after any code change:

```bash
npm run ios
```

The `ios/` and `android/` directories are gitignored, so they are generated on
each machine rather than committed.

What is already wired up for native:

- `base: './'` in the Vite config, so the bundle loads from the WebView's
  `file://` origin.
- Safe-area insets (`env(safe-area-inset-*)`) on the app bar and page padding,
  for notches and home indicators.
- 16px input font size, which stops iOS zooming the viewport on focus.
- Persistence goes through `@capacitor/preferences` on native (UserDefaults /
  SharedPreferences) and `localStorage` on the web — see `src/lib/storage.ts`.
  The Capacitor module is imported lazily, so the web bundle never loads it.
- CSV export uses the Web Share sheet when available, since an `<a download>`
  is inert inside an iOS WebView.

## Saving, exporting and importing

Everything you type is **autosaved** as you type it — there is no save button.
The current profile is written to `localStorage` on the web and to
`@capacitor/preferences` on native, and restored on next launch. It holds one
profile at a time.

To keep more than one, export them. The **Profile** card at the top of the
inputs column exports the current profile as a CSV and imports one back:

```csv
Section,Field,Value,Date
Profile,Name,Main home loan,
Loan,Loan balance,650000,
Loan,Monthly repayment,4300,
Loan,Annual interest rate,6.1,
Loan,Term (years),25,
Offset,Starting balance,25000,
Contribution,,1200,2026-09-01
Contribution,,2000,2029-01-01
Lump sum,,40000,2027-06-01
Expense,,15000,2030-03-01
```

The file is one uniform four-column table so it opens cleanly in a spreadsheet,
with the `Section` column separating the scalar settings from the three lists of
dated amounts. The filename comes from the profile name
(`main-home-loan.csv`), which is also what makes several exported profiles
tellable apart.

Importing is forgiving in the ways that matter and strict where guessing would
be dangerous:

- Amounts may carry `$` and thousands separators — `"$650,000"` reads as
  `650000`.
- Rows with an unrecognised `Section` are ignored, so you can add your own notes
  columns or rows.
- Quoted fields, CRLF line endings and a leading BOM are all handled, so a file
  that has been through Excel still imports.
- **Dates must be `YYYY-MM-DD`.** Spreadsheet apps like to rewrite dates, and
  `03/04/2027` is genuinely ambiguous, so rows with an unreadable date are
  skipped and reported rather than guessed at.
- A file that is not a profile CSV — the schedule export, say — is rejected
  without touching your current inputs.

An import replaces what is on screen, so the confirmation that appears after one
carries an **Undo** that puts the previous profile back.

Note that the schedule export in the **Loan status** card is a different file:
it is the computed month-by-month table, for spreadsheets and record-keeping,
and is not importable.

## How the model works

Month 1 is always the **current calendar month**, and each subsequent row is the
next real calendar month. Within a month:

1. Interest accrues daily on `max(loan − offset, 0)`, using the opening
   balances and the actual number of days in that calendar month.
2. Lump sums land, expenses are drawn down, then the monthly contribution is
   added to the offset account.
3. The repayment is applied — interest first, the remainder reduces principal.

"Monthly contributions" are a **step function**: each entry sets the recurring
monthly amount from its start date onward, replacing the previous entry rather
than adding to it.

Interest saved and time saved are measured against a **parallel baseline** — the
same loan, rate and repayment with no offset account at all — run to its own
payoff date. Because the offset loan clears earlier, the two scenarios cover
different spans of time; the headline names both end dates.

### Differences from the original prototype

Three things changed deliberately while porting the logic:

- **Real calendar days.** The prototype charged interest for a flat 30 days a
  month (360 days a year) against a daily rate of `annual / 365`, which
  under-counted interest by roughly 1.4%. Each month now uses its true length,
  including leap years.
- **Dates map by calendar month, not elapsed days.** The prototype placed a
  dated item with `ceil(daysUntil / 30.4)`, which drifted against the calendar
  over long terms. Items now land in the calendar month they actually fall in.
- **A real no-offset baseline.** The prototype compared against interest
  computed on the *offset-accelerated* balance, which understated the saving.
  The comparison now runs a genuinely separate no-offset amortisation.

Expect the numbers to differ from the prototype's for these reasons.

## Layout

```
src/
  lib/
    calc.ts      the simulation — pure functions, no DOM
    csv.ts       RFC 4180 CSV reader / writer
    download.ts  hand a generated file to the user (share sheet or download)
    format.ts    currency and duration formatting
    profile.ts   profile <-> CSV, and import validation
    state.ts     defaults, sample data, migration of saved state
    storage.ts   web / native persistence
    theme.ts     light / dark / system theme
  components/
    BalanceChart.tsx   responsive SVG chart with crosshair + tooltip
    ProfileCard.tsx    profile name, CSV export / import, undo
    ScheduleTable.tsx  monthly / yearly schedule, CSV export
    Summary.tsx        headline figure and stat tiles
    Card.tsx  ItemList.tsx  NumberField.tsx  icons.tsx
  App.tsx        state wiring and page layout
  styles.css     design tokens and all styling
```

`src/lib/calc.ts`, `csv.ts` and `profile.ts` have no React or DOM dependency, so
they can be unit-tested or reused directly.
