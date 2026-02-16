import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.join(__dirname, '../../test-combine/evaluation-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Read recipes.ts to identify batch membership
const recipesPath = path.join(__dirname, '../../test-combine/src/data/recipes.ts');
const recipesContent = fs.readFileSync(recipesPath, 'utf8');
const recipeRegex = /\{\s*\n\s*id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",/g;
const allRecipes = [];
let m;
while ((m = recipeRegex.exec(recipesContent)) !== null) {
  allRecipes.push({ id: m[1], name: m[2] });
}

// Batch boundaries
const batch1Names = new Set(allRecipes.slice(0, 20).map(r => r.name));
const batch2Names = new Set(allRecipes.slice(20, 40).map(r => r.name));
const batch3Names = new Set(allRecipes.slice(40, 60).map(r => r.name));

// Classify issues
const batch1Issues = [];
const batch2Issues = [];
const batch3Issues = [];
const otherIssues = [];

report.issues.forEach(issue => {
  if (batch1Names.has(issue.recipeName)) batch1Issues.push(issue);
  else if (batch2Names.has(issue.recipeName)) batch2Issues.push(issue);
  else if (batch3Names.has(issue.recipeName)) batch3Issues.push(issue);
  else otherIssues.push(issue);
});

console.log('=== ISSUE COUNTS BY BATCH ===');
console.log(`Batch 1 (recipes 1-20): ${batch1Issues.length} issues`);
console.log(`Batch 2 (recipes 21-40): ${batch2Issues.length} issues`);
console.log(`Batch 3 (recipes 41-60): ${batch3Issues.length} issues`);
console.log(`Other/pre-existing: ${otherIssues.length} issues`);

// Batch 3 detail
console.log('\n=== BATCH 3 ISSUES (recipes 41-60) ===');
const b3ByType = {};
batch3Issues.forEach(i => {
  if (!b3ByType[i.issueType]) b3ByType[i.issueType] = [];
  b3ByType[i.issueType].push(i);
});

Object.entries(b3ByType).forEach(([type, issues]) => {
  console.log(`\n${type}: ${issues.length}`);
  issues.forEach(i => {
    console.log(`  [${i.recipeName}] ${i.ingredientName}: ${i.description}`);
    console.log(`    Fix: ${i.suggestedFix}`);
  });
});

// Batch 2 detail for comparison
console.log('\n=== BATCH 2 ISSUES (recipes 21-40) ===');
const b2ByType = {};
batch2Issues.forEach(i => {
  if (!b2ByType[i.issueType]) b2ByType[i.issueType] = [];
  b2ByType[i.issueType].push(i);
});

Object.entries(b2ByType).forEach(([type, issues]) => {
  console.log(`\n${type}: ${issues.length}`);
  issues.forEach(i => {
    console.log(`  [${i.recipeName}] ${i.ingredientName}: ${i.description}`);
    console.log(`    Fix: ${i.suggestedFix}`);
  });
});

// Summary comparison
console.log('\n=== BATCH COMPARISON SUMMARY ===');
const allTypes = new Set([...Object.keys(b3ByType), ...Object.keys(b2ByType)]);
console.log('Type'.padEnd(25) + 'Batch 2'.padEnd(10) + 'Batch 3'.padEnd(10));
allTypes.forEach(type => {
  const b2 = (b2ByType[type] || []).length;
  const b3 = (b3ByType[type] || []).length;
  console.log(type.padEnd(25) + String(b2).padEnd(10) + String(b3).padEnd(10));
});
