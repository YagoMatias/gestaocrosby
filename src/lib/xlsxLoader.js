// Lazy loader para xlsx (~430KB). Não carrega até a função de export ser
// chamada. Use assim:
//
//   import { getXLSX } from '@/lib/xlsxLoader';
//   async function handleExport() {
//     const XLSX = await getXLSX();
//     const ws = XLSX.utils.json_to_sheet(rows);
//     // ...
//   }
//
// O módulo é cacheado após o primeiro carregamento.

let _xlsxPromise = null;

export function getXLSX() {
  if (!_xlsxPromise) {
    _xlsxPromise = import('xlsx');
  }
  return _xlsxPromise;
}
