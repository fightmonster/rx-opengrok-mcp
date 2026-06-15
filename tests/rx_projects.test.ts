import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  parseProjectsFromHomepageHTML,
  parseSubReposFromXrefHTML,
  formatProjectsWithRepos,
  type ProjectWithRepos,
} from "../src/index.js";

// ─── parseProjectsFromHomepageHTML ─────────────────────────────────────────

test("parseProjectsFromHomepageHTML: extracts options from the project <select>", () => {
  const html = `
    <select tabindex="8" class="q" id="project" name="project" multiple="multiple" size="5">
      <option value="alpha">alpha</option>
      <option value="beta">beta</option>
      <option value="gamma">gamma</option>
    </select>`;
  assert.deepEqual(parseProjectsFromHomepageHTML(html), ["alpha", "beta", "gamma"]);
});

test("parseProjectsFromHomepageHTML: ignores <option> from other <select> elements", () => {
  const html = `
    <select id="sort" name="sort">
      <option value="relevance">relevance</option>
      <option value="path">path</option>
    </select>
    <select id="project" name="project">
      <option value="real-project">real-project</option>
    </select>
    <select id="type" name="type">
      <option value="java">java</option>
    </select>`;
  assert.deepEqual(parseProjectsFromHomepageHTML(html), ["real-project"]);
});

test("parseProjectsFromHomepageHTML: empty result when project select is missing", () => {
  assert.deepEqual(parseProjectsFromHomepageHTML("<html></html>"), []);
});

test("parseProjectsFromHomepageHTML: dedupes repeated option values", () => {
  const html = `
    <select id="project">
      <option value="dup">dup</option>
      <option value="dup">dup</option>
      <option value="unique">unique</option>
    </select>`;
  assert.deepEqual(parseProjectsFromHomepageHTML(html), ["dup", "unique"]);
});

test("parseProjectsFromHomepageHTML: tolerates extra attributes on <option>", () => {
  const html = `
    <select id="project">
      <option selected value="first" data-x="1">first</option>
      <option disabled value="second">second</option>
    </select>`;
  assert.deepEqual(parseProjectsFromHomepageHTML(html), ["first", "second"]);
});

// ─── parseSubReposFromXrefHTML ─────────────────────────────────────────────

test("parseSubReposFromXrefHTML: extracts directory anchors with trailing slash", () => {
  const html = `
    <a href="..">..</a>
    <a href="sys/">sys</a>
    <a href="vnd/">vnd</a>
    <a href="README.md">README.md</a>`;
  assert.deepEqual(parseSubReposFromXrefHTML(html), ["sys", "vnd"]);
});

test("parseSubReposFromXrefHTML: excludes absolute breadcrumb links", () => {
  const html = `
    <a href="/source/xref/2504_A16_DEV_Code/">2504_A16_DEV_Code</a>
    <a href="sys/">sys</a>`;
  assert.deepEqual(parseSubReposFromXrefHTML(html), ["sys"]);
});

test("parseSubReposFromXrefHTML: empty when no directory anchors present", () => {
  assert.deepEqual(parseSubReposFromXrefHTML("<html><a href=\"..\">..</a></html>"), []);
});

test("parseSubReposFromXrefHTML: dedupes repeated directory entries", () => {
  const html = `
    <a href="sys/">sys</a>
    <a href="sys/" title="link">sys</a>
    <a href="vnd/">vnd</a>`;
  assert.deepEqual(parseSubReposFromXrefHTML(html), ["sys", "vnd"]);
});

test("parseSubReposFromXrefHTML: tolerates extra anchor attributes", () => {
  const html = `<a class="x" href="alpha/" title="hi">alpha</a>`;
  assert.deepEqual(parseSubReposFromXrefHTML(html), ["alpha"]);
});

// ─── formatProjectsWithRepos ───────────────────────────────────────────────

test("formatProjectsWithRepos: empty-state message", () => {
  assert.equal(formatProjectsWithRepos([]), "No projects found.");
});

test("formatProjectsWithRepos: header reports project + total sub-repo count", () => {
  const out = formatProjectsWithRepos([
    { project: "alpha", repos: ["one", "two"] },
    { project: "beta", repos: ["x"] },
  ]);
  assert.match(out, /Found 2 project\(s\) with 3 sub-repo\(s\) total:/);
});

test("formatProjectsWithRepos: alphabetises projects and their repos", () => {
  const entries: ProjectWithRepos[] = [
    { project: "zeta", repos: ["beta", "alpha"] },
    { project: "alpha", repos: ["zzz", "aaa"] },
  ];
  const out = formatProjectsWithRepos(entries);
  const alphaIdx = out.indexOf("## alpha");
  const zetaIdx = out.indexOf("## zeta");
  assert.ok(alphaIdx >= 0 && zetaIdx > alphaIdx, "alpha must come before zeta");
  // Repo lines within alpha must be sorted
  const aaaIdx = out.indexOf("- aaa");
  const zzzIdx = out.indexOf("- zzz");
  assert.ok(aaaIdx >= 0 && zzzIdx > aaaIdx, "aaa must come before zzz");
});

test("formatProjectsWithRepos: project with no sub-repos gets a placeholder", () => {
  const out = formatProjectsWithRepos([{ project: "solo", repos: [] }]);
  assert.match(out, /## solo\n  \(no sub-repos\)/);
});

test("formatProjectsWithRepos: errored project surfaces the error inline", () => {
  const out = formatProjectsWithRepos([
    { project: "broken", repos: [], error: "HTTP 500 boom" },
  ]);
  assert.match(out, /## broken\n  \(failed to fetch sub-repos: HTTP 500 boom\)/);
});

test("formatProjectsWithRepos: errored project doesn't inflate sub-repo total", () => {
  const out = formatProjectsWithRepos([
    { project: "ok", repos: ["sys"] },
    { project: "broken", repos: [], error: "nope" },
  ]);
  assert.match(out, /Found 2 project\(s\) with 1 sub-repo\(s\) total:/);
});
