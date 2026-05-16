const fs = require('fs');
const locales = ['pt-BR', 'en', 'es', 'fr', 'it', 'ja'];
let problems = [];

for (const l of locales) {
  const raw = fs.readFileSync('src/locales/' + l + '.json', 'utf8');
  const data = JSON.parse(raw);
  
  function check(obj, path) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        check(v, path + '.' + k);
      } else if (typeof v === 'string') {
        // Check for bare @ not wrapped in {'@'}
        const bareAt = v.match(/@(?!\s*})/g);
        if (bareAt && !v.includes("{'@'}")) {
          problems.push('BARE @: ' + l + ':' + path + '.' + k + ' = ' + v.substring(0, 100));
        }
        // Check for linked messages syntax @: or @.
        if (v.includes('@:') || v.match(/@\./)) {
          problems.push('LINKED: ' + l + ':' + path + '.' + k + ' = ' + v.substring(0, 100));
        }
      }
    }
  }
  check(data, l);
  console.log(l + ': checked');
}

if (problems.length === 0) {
  console.log('Nenhum problema encontrado!');
} else {
  problems.forEach(p => console.log(p));
}
