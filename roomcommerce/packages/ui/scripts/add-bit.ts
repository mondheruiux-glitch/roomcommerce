import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../../..');
const VENDOR_BITS_DIR = path.resolve(REPO_ROOT, 'vendor/react-bits/src/ts-tailwind');
const TARGET_BITS_DIR = path.resolve(__dirname, '../src/react-bits');
const BARREL_FILE = path.resolve(TARGET_BITS_DIR, 'index.ts');

interface ComponentInfo {
  name: string;
  category: string;
  dirPath: string;
  filePath: string;
}

function discoverAllBits(): ComponentInfo[] {
  if (!fs.existsSync(VENDOR_BITS_DIR)) {
    console.error(`❌ React Bits upstream not found at: ${VENDOR_BITS_DIR}`);
    process.exit(1);
  }

  const components: ComponentInfo[] = [];
  const categories = fs.readdirSync(VENDOR_BITS_DIR);

  for (const cat of categories) {
    const catPath = path.join(VENDOR_BITS_DIR, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;

    const compDirs = fs.readdirSync(catPath);
    for (const compDir of compDirs) {
      const compDirPath = path.join(catPath, compDir);
      if (!fs.statSync(compDirPath).isDirectory()) continue;

      const mainFile = path.join(compDirPath, `${compDir}.tsx`);
      if (fs.existsSync(mainFile)) {
        components.push({
          name: compDir,
          category: cat,
          dirPath: compDirPath,
          filePath: mainFile,
        });
      }
    }
  }

  return components;
}

function listComponents() {
  const all = discoverAllBits();
  console.log(`\n📦 Available React Bits (${all.length} total across 4 categories):\n`);
  const byCategory: Record<string, string[]> = {};
  for (const item of all) {
    byCategory[item.category] = byCategory[item.category] || [];
    byCategory[item.category].push(item.name);
  }

  for (const [cat, names] of Object.entries(byCategory)) {
    console.log(`\x1b[36m📁 ${cat} (${names.length})\x1b[0m:`);
    console.log(`  ${names.join(', ')}\n`);
  }
}

function addComponent(targetName: string) {
  const all = discoverAllBits();
  const found = all.find(
    (c) => c.name.toLowerCase() === targetName.toLowerCase()
  );

  if (!found) {
    console.error(`❌ Component "${targetName}" not found in React Bits.`);
    console.log('Run `pnpm bits:list` to see all available components.');
    process.exit(1);
  }

  if (!fs.existsSync(TARGET_BITS_DIR)) {
    fs.mkdirSync(TARGET_BITS_DIR, { recursive: true });
  }

  // Copy component tsx file
  const destTsx = path.join(TARGET_BITS_DIR, `${found.name}.tsx`);
  const content = fs.readFileSync(found.filePath, 'utf-8');
  fs.writeFileSync(destTsx, content, 'utf-8');
  console.log(`✅ Copied ${found.category}/${found.name} -> packages/ui/src/react-bits/${found.name}.tsx`);

  // Check for accompanying CSS
  const possibleCss = path.join(found.dirPath, `${found.name}.css`);
  if (fs.existsSync(possibleCss)) {
    const destCss = path.join(TARGET_BITS_DIR, `${found.name}.css`);
    fs.copyFileSync(possibleCss, destCss);
    console.log(`✅ Copied CSS asset: ${found.name}.css`);
  }

  // Check external dependencies
  const externalDeps = new Set<string>();
  const importLines = content.match(/from\s+['"][^'"]+['"]/g) || [];
  for (const imp of importLines) {
    const mod = imp.replace(/from\s+['"]/, '').replace(/['"]$/, '');
    if (!mod.startsWith('.') && !mod.startsWith('react') && !mod.startsWith('motion') && !mod.startsWith('gsap') && !mod.startsWith('lenis')) {
      externalDeps.add(mod.split('/')[0]);
    }
  }

  if (externalDeps.size > 0) {
    console.log(`\n⚠️  Component "${found.name}" imports external package(s): ${Array.from(externalDeps).join(', ')}`);
    console.log(`   If not yet installed, install with:`);
    console.log(`   pnpm --filter @roomcommerce/ui add ${Array.from(externalDeps).join(' ')}\n`);
  }

  // Update barrel file index.ts
  let barrelContent = '';
  if (fs.existsSync(BARREL_FILE)) {
    barrelContent = fs.readFileSync(BARREL_FILE, 'utf-8');
  }

  const exportStatementDefault = `export { default as ${found.name} } from './${found.name}';`;
  const exportStatementAll = `export * from './${found.name}';`;

  if (!barrelContent.includes(`./${found.name}`)) {
    const newExport = `${exportStatementDefault}\n${exportStatementAll}\n`;
    barrelContent = barrelContent ? `${barrelContent.trim()}\n${newExport}` : newExport;
    fs.writeFileSync(BARREL_FILE, barrelContent, 'utf-8');
    console.log(`✅ Added export to packages/ui/src/react-bits/index.ts`);
  } else {
    console.log(`ℹ️  Export already exists in packages/ui/src/react-bits/index.ts`);
  }
}

// CLI handler
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log(`
React Bits CLI Importer for RoomCommerce
Usage:
  tsx scripts/add-bit.ts <ComponentName>   Import a component from vendor/react-bits
  tsx scripts/add-bit.ts --list            List all available components
`);
  process.exit(0);
}

if (args.includes('--list') || args.includes('-l')) {
  listComponents();
} else {
  for (const compName of args) {
    addComponent(compName);
  }
}
