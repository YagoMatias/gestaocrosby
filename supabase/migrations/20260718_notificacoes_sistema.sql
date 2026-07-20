-- Notificações de sistema (jobs automáticos e eventos como análise de crédito).
-- Segmentadas por PAPEL (destinatario_roles) e/ou por USUÁRIO (destinatario_id),
-- com leitura por usuário (lida_por).
--
-- Rodar no SQL Editor do Supabase.

create table if not exists notificacoes_sistema (
  id                 uuid primary key default gen_random_uuid(),
  tipo               text not null default 'SISTEMA',      -- ex: 'PROVISAO_LIBERACAO', 'ANALISE_CREDITO_NOVA'
  nivel              text not null default 'info',         -- 'success' | 'error' | 'warning' | 'info'
  titulo             text not null,
  mensagem           text,
  dados              jsonb not null default '{}'::jsonb,   -- payload (ex: duplicatas, ids)
  destinatario_roles text[] not null default '{}'::text[], -- ex: '{owner,admin}'
  destinatario_id    uuid,                                 -- usuário específico (ex: solicitante)
  lida_por           uuid[]  not null default '{}'::uuid[], -- ids de usuários que já leram
  dt_criacao         timestamptz not null default now()
);

create index if not exists idx_notif_sistema_dt
  on notificacoes_sistema (dt_criacao desc);
create index if not exists idx_notif_sistema_roles
  on notificacoes_sistema using gin (destinatario_roles);
create index if not exists idx_notif_sistema_dest_id
  on notificacoes_sistema (destinatario_id) where destinatario_id is not null;

alter table notificacoes_sistema enable row level security;

-- Leitura: qualquer usuário autenticado (a segmentação por papel/usuário é
-- aplicada na query do app via `.or(destinatario_id.eq..., destinatario_roles.cs...)`).
drop policy if exists notif_sistema_select on notificacoes_sistema;
create policy notif_sistema_select on notificacoes_sistema
  for select to authenticated using (true);

-- Inserção: service_role (jobs no backend). Os triggers abaixo usam SECURITY
-- DEFINER, então inserem independentemente de policy.
drop policy if exists notif_sistema_insert on notificacoes_sistema;
create policy notif_sistema_insert on notificacoes_sistema
  for insert to service_role with check (true);

-- Marcar como lida por usuário (append idempotente no array lida_por).
create or replace function marcar_notificacao_sistema_lida(p_id uuid, p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update notificacoes_sistema
     set lida_por = (
       select array(select distinct unnest(coalesce(lida_por, '{}') || array[p_user]))
     )
   where id = p_id;
$$;

grant execute on function marcar_notificacao_sistema_lida(uuid, uuid) to authenticated;

-- Realtime (para o sino atualizar sozinho).
do $$
begin
  begin
    alter publication supabase_realtime add table notificacoes_sistema;
  exception when duplicate_object then null;
  end;
end $$;

-- ============================================================================
-- Notificações de ANÁLISE DE CRÉDITO (tabela solicitacoes_credito)
-- ============================================================================

-- 1) Nova solicitação em ANÁLISE → avisa Financeiro (user) + Owner + Admin.
create or replace function notif_analise_credito_nova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'ANALISE' then
    insert into notificacoes_sistema
      (tipo, nivel, titulo, mensagem, dados, destinatario_roles)
    values (
      'ANALISE_CREDITO_NOVA',
      'info',
      'Nova análise de crédito',
      coalesce(NEW.user_nome, NEW.user_email, 'Um usuário')
        || ' solicitou análise de crédito'
        || coalesce(' — ' || NEW.nm_empresa, ''),
      jsonb_build_object(
        'solicitacao_id', NEW.id,
        'cd_empresa', NEW.cd_empresa,
        'nm_empresa', NEW.nm_empresa,
        'vl_credito', NEW.vl_credito,
        'user_nome', NEW.user_nome
      ),
      array['user', 'owner', 'admin']
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_analise_credito_nova on solicitacoes_credito;
create trigger trg_notif_analise_credito_nova
  after insert on solicitacoes_credito
  for each row execute function notif_analise_credito_nova();

-- 2) Solicitação APROVADA → avisa o usuário solicitante (destinatario_id).
create or replace function notif_analise_credito_aprovada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'APROVADO'
     and coalesce(OLD.status, '') <> 'APROVADO'
     and NEW.user_id is not null then
    insert into notificacoes_sistema
      (tipo, nivel, titulo, mensagem, dados, destinatario_id)
    values (
      'ANALISE_CREDITO_APROVADA',
      'success',
      'Análise de crédito aprovada',
      'Sua solicitação de crédito'
        || coalesce(' — ' || NEW.nm_empresa, '')
        || ' foi APROVADA'
        || coalesce(' por ' || NEW.user_aprovador, '') || '.',
      jsonb_build_object(
        'solicitacao_id', NEW.id,
        'cd_empresa', NEW.cd_empresa,
        'nm_empresa', NEW.nm_empresa,
        'vl_credito', NEW.vl_credito,
        'aprovado_por', NEW.user_aprovador
      ),
      NEW.user_id
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_analise_credito_aprovada on solicitacoes_credito;
create trigger trg_notif_analise_credito_aprovada
  after update on solicitacoes_credito
  for each row execute function notif_analise_credito_aprovada();
