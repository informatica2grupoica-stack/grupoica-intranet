// lib/sanitize.ts
// Sanitiza términos de búsqueda que se interpolan en filtros PostgREST (.or/.ilike).
// Sin esto, caracteres como , ( ) * permiten inyectar condiciones arbitrarias
// en la cadena de filtro y saltarse el filtrado previsto.
export function sanitizarBusqueda(term: string | null | undefined, maxLen = 80): string {
  if (!term) return '';
  return term.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
