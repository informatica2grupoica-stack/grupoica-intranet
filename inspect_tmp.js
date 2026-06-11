const XLSX = require('xlsx');
const path = "C:/Users/droku/Downloads/1COSTEO 1110404-77-LP26.xlsx";
const wb = XLSX.readFile(path);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
  for (let i=0;i<Math.min(10,json.length);i++) {
    const row = json[i];
    if (row && row.some(c => String(c||'').toUpperCase().includes('ITEM'))) {
      console.log(name, 'header row', i, JSON.stringify(row));
      console.log(name, 'data row', i+1, JSON.stringify(json[i+1]));
      break;
    }
  }
}
