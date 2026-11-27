import assert from "node:assert/strict";
import { test } from "node:test";

import { csvEscape, toCsv } from "../lib/csv.ts";

test("plain values pass through", () => {
  assert.equal(csvEscape("Alice"), "Alice");
  assert.equal(csvEscape(42), "42");
  assert.equal(csvEscape(undefined), "");
});

test("quotes, commas and newlines are quoted", () => {
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape("a,b"), '"a,b"');
  assert.equal(csvEscape("a\nb"), '"a\nb"');
});

test("formula-like strings are neutralized", () => {
  for (const value of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx"]) {
    assert.equal(csvEscape(value), `'${value}`);
  }
  assert.equal(csvEscape('=HYPERLINK("x","y")'), `"'=HYPERLINK(""x"",""y"")"`);
});

test("negative numbers are left alone", () => {
  assert.equal(csvEscape(-5), "-5");
});

test("toCsv joins headers and rows", () => {
  assert.equal(toCsv(["a", "b"], [[1, "=x"]]), "a,b\n1,'=x");
});
