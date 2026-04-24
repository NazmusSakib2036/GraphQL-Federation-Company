#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
// Parse flags and positional args
const positional = [];
let wgDir = process.env.WG_DIR_ABS || '';
let i = 0;
while (i < args.length) {
  if (args[i] === '--wundergraph-dir' && i + 1 < args.length) {
    wgDir = args[i + 1];
    i += 2;
  } else if (args[i].startsWith('--')) {
    // skip other flags
    i += 1;
  } else {
    positional.push(args[i]);
    i++;
  }
}

const cmd = positional[0];

function normalizeOperationName(s) {
  // Replicate Go's cases.Title: capitalize first letter of each path segment
  return s.split('/').map(part => {
    if (!part) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join('');
}

if (cmd === 'loadoperations') {
  const operationsPath = positional[1];
  const fragmentsPath = positional[2];
  const schemaFilePath = positional[3];

  const output = {
    graphql_operation_files: [],
    typescript_operation_files: [],
    invalid: [],
    errors: [],
    info: []
  };

  function walkDir(dir, base) {
    if (!fs.existsSync(dir)) return;
    let files;
    try { files = fs.readdirSync(dir); } catch(e) { return; }
    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat;
      try { stat = fs.statSync(fullPath); } catch(e) { continue; }
      if (stat.isDirectory()) {
        walkDir(fullPath, base);
      } else {
        const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
        if (file.endsWith('.graphql')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const relNoExt = relPath.replace(/\.graphql$/, '');
          const operationName = normalizeOperationName(relNoExt);
          output.graphql_operation_files.push({
            operation_name: operationName,
            api_mount_path: relNoExt,
            file_path: relPath,
            content: content.trim()
          });
        } else if (file.endsWith('.ts')) {
          const relNoExt = relPath.replace(/\.ts$/, '');
          const operationName = normalizeOperationName(relNoExt);
          output.typescript_operation_files.push({
            operation_name: operationName,
            api_mount_path: relNoExt,
            file_path: relPath,
            module_path: 'generated/bundle/operations/' + relNoExt
          });
        }
      }
    }
  }

  walkDir(operationsPath, operationsPath);

  const jsonOutput = JSON.stringify(output, null, '  ');
  // Write to the expected output file (wunderctl writes to file, not stdout)
  const outFilePath = path.join(wgDir, 'generated', 'wundergraph.operations.json');
  fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
  fs.writeFileSync(outFilePath, jsonOutput, 'utf8');
  process.exit(0);
}

// For other commands, just exit cleanly (we only need loadoperations for code gen)
process.exit(0);
