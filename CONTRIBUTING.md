# Contributing to Flow2Repo

Thanks for helping. The most valuable contribution is a **real design that converts badly**: every fixture added so far uncovered bugs no synthetic test would have.

## Report a design that breaks

Open a [conversion bug](https://github.com/laithalallaf2000-ux/flow2repo/issues/new?template=conversion-bug.yml) and attach the HTML (or a ZIP with its assets). Say what you expected and what you got. Remove anything private from the design first.

## Set up

Requires Node 20+.

```bash
npm install
npm run dev        # web app at http://localhost:5173
npm test           # converter unit tests
npm run test:e2e   # converts every fixture, then installs and builds each generated project
npm run typecheck
```

## Where things live

```
packages/converter/src   the conversion engine (plain TypeScript, no AI, runs in the browser and Node)
packages/converter/test  unit tests, plus build.e2e.test.ts which builds every fixture
fixtures/                real designs used as test cases
apps/web                 the website (React + Vite)
docs/prompts             the dashboard and website prompts
```

## Making a change to the converter

1. Add the failing case first: a design in `fixtures/<name>/index.html`, or a focused test in `packages/converter/test`.
2. Fix it in `packages/converter/src`.
3. Make sure nothing else moved. Convert every fixture before and after your change and compare the generated files: only the outputs you meant to change should differ.
4. Run `npm test`, `npm run test:e2e` and `npm run typecheck`.

Keep the converter deterministic: the same design must always produce the same project. When something cannot be converted, report it as a warning instead of guessing silently.

## Style

Match the surrounding code: small functions, names that say what things are, comments that explain *why*. The generated code should read like code a person wrote.

## Pull requests

Keep them focused on one thing, describe the design or case they fix, and include the test that proves it.
