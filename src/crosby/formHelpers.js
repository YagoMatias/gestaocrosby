// Helpers de máscara e ViaCEP compartilhados pelas LPs do BlueCard
// (CrosbyForm e CrosbyFormIndicacao). Garantem que os dados capturados
// saiam padronizados (data DD/MM/AAAA, CEP 00000-000, endereço via ViaCEP).

export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

// Máscara de data de nascimento: sempre DD/MM/AAAA a partir dos dígitos.
export function maskDate(raw) {
  const d = onlyDigits(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Máscara de CEP: 00000-000.
export function maskCep(raw) {
  const d = onlyDigits(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// Valida DD/MM/AAAA de forma simples (dia/mês/ano plausíveis).
export function dataNascValida(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
  if (!m) return false;
  const dd = +m[1];
  const mm = +m[2];
  const yyyy = +m[3];
  return (
    dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1900 && yyyy <= 2026
  );
}

// Busca endereço no ViaCEP. Retorna { logradouro, bairro, localidade, uf }
// ou null (CEP incompleto, inexistente ou serviço offline).
export async function buscarCep(cep) {
  const d = onlyDigits(cep);
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j && !j.erro) return j;
  } catch {
    /* ViaCEP offline/inválido — segue sem autofill */
  }
  return null;
}
