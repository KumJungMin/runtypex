const ts = require("typescript");

function addJsExtTransformer() {
  return (context) => {
    const visit = (node) => {
      // ✅ import ... from "..."
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const importPath = node.moduleSpecifier.text;
        if (importPath.startsWith(".") && !importPath.endsWith(".js")) {
          return ts.factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            ts.factory.createStringLiteral(`${importPath}.js`),
            node.assertClause
          );
        }
      }

      // ✅ export { ... } from "..."
      if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const exportPath = node.moduleSpecifier.text;
        if (exportPath.startsWith(".") && !exportPath.endsWith(".js")) {
          return ts.factory.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            ts.factory.createStringLiteral(`${exportPath}.js`),
            node.assertClause
          );
        }
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (sf) => ts.visitNode(sf, visit);
  };
}

module.exports = addJsExtTransformer;
