-- RH / Admissão — Solicitação de documentos (pós-entrevista)
-- Link público único onde o candidato aprovado anexa os documentos.
-- Os arquivos ficam no bucket privado 'documentos-admissao' do Supabase
-- Storage; aqui guardamos o mapa em JSONB { chave: { path, nome } }.
create table if not exists rh_documentos_admissao (
  id                   bigserial primary key,
  nome                 text not null,
  email_pessoal        text,
  contato_pessoal      text,
  contato_emergencia   text,          -- contato + grau de parentesco
  pis                  text,          -- número do PIS
  -- Mapa dos documentos anexados: { rg_frente: {path, nome}, ... }
  documentos           jsonb not null default '{}'::jsonb,
  -- Metadata
  origem               text default 'lp_admissao',
  ip                   text,
  user_agent           text,
  -- Funil do RH
  status               text not null default 'novo',
  observacao           text,
  -- Audit
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create index if not exists idx_rh_doc_adm_criado on rh_documentos_admissao (criado_em desc);
create index if not exists idx_rh_doc_adm_status on rh_documentos_admissao (status);
create index if not exists idx_rh_doc_adm_nome   on rh_documentos_admissao (nome);

-- Trigger pra atualizar atualizado_em
create or replace function trg_rh_doc_adm_touch() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_rh_doc_adm_touch on rh_documentos_admissao;
create trigger trg_rh_doc_adm_touch
before update on rh_documentos_admissao
for each row execute function trg_rh_doc_adm_touch();
