const fs = require('fs');
const path = require('path');

const changelogPath = path.join(__dirname, '../../public/changelog.json');
const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));

const missingSummaries = changelog.items.filter(item => !item.summary || item.summary.trim() === '');

if (missingSummaries.length > 0) {
  console.error(`❌ Erro: ${missingSummaries.length} item(s) sem summary preenchido:`);
  missingSummaries.forEach(item => {
    console.error(`- PR #${item.pr}: ${item.title}`);
  });
  process.exit(1);
}

console.log("✅ Todos summaries preenchidos");
process.exit(0);