import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { contentSecurityPolicy } from "../src/lib/security/csp.ts";

function pages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? pages(join(directory, entry.name)) : entry.name === "page.tsx" ? [join(directory, entry.name)] : []);
}
test("every admin page authorizes before preparing data or starting side effects", () => {
  const files = pages("src/app/admin");
  assert.ok(files.length >= 12);
  for (const file of files) {
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const component = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword));
    assert.ok(component && ts.isFunctionDeclaration(component) && component.body, file);
    const first = component.body.statements[0];
    assert.ok(ts.isExpressionStatement(first) && ts.isAwaitExpression(first.expression)
      && ts.isCallExpression(first.expression.expression) && first.expression.expression.expression.getText(ast) === "requireAdmin", file);
  }
});
test("production CSP authorizes per-request scripts and blocks executable attributes", () => {
  const policy = contentSecurityPolicy("b25lLXVuaXF1ZS1ub25jZQ==");
  const script = policy.split(";").find(directive => directive.trim().startsWith("script-src "))!;
  assert.match(script, /'nonce-b25lLXVuaXF1ZS1ub25jZQ=='/);
  assert.match(script, /'strict-dynamic'/);
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/);
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.throws(() => contentSecurityPolicy("bad'; script-src *"));
  assert.notEqual(policy, contentSecurityPolicy("YW5vdGhlci1ub25jZQ=="));
});
