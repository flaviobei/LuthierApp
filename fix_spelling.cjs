const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  content = content.replace(/registado/g, 'registrado');
  content = content.replace(/Registado/g, 'Registrado');
  content = content.replace(/registada/g, 'registrada');
  content = content.replace(/Registada/g, 'Registrada');
  content = content.replace(/registo/g, 'registro');
  content = content.replace(/Registo/g, 'Registro');
  content = content.replace(/aceder/g, 'acessar');
  content = content.replace(/Aceder/g, 'Acessar');
  content = content.replace(/permite-lhe/g, 'permite a você');
  content = content.replace(/Potenciómetro/g, 'Potenciômetro');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.vue') || fullPath.endsWith('.js')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('e:/Luthier-App/LuthierApp/src');
