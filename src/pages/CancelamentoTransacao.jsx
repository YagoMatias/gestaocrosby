// ============================================================================
// FINANCEIRO › CANCELAMENTO DE TRANSAÇÃO (Yago, 17/11/2026)
// Página para cancelar uma transação do PDV Crosby de uma vez: a nota fiscal na
// SEFAZ, a transação e os títulos do contas a receber.
// Regra: VENDA atendida (com nota autorizada) acima de R$ 1.000 só cancela com
// o e-mail e a senha de alguém do financeiro (o servidor confere).
// Transação EM ANDAMENTO (sem nota autorizada) o caixa cancela direto no PDV.
// Tela e regras: components/pdv/CancelarTransacao.jsx · API /api/pdv-crosby.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Prohibit, CheckCircle, Warning } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { API_BASE_URL } from '../config/constants';
import { getUserCompanies } from '../services/userCompaniesService';
import CancelarTransacao from '../components/pdv/CancelarTransacao';

export default function CancelamentoTransacao() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  // null = sem restrição (admin/owner ou usuário sem empresa vinculada)
  const [empresasUsuario, setEmpresasUsuario] = useState(null);
  const [empresa, setEmpresa] = useState(() => localStorage.getItem('cancelamento_empresa') || '');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/totvs/branches`)
      .then((r) => r.json())
      .then((b) => setBranches(b?.data?.data || []))
      .catch(() => showToast('erro', 'Falha ao carregar as empresas'));
  }, [showToast]);

  useEffect(() => {
    if (!user?.id || ['admin', 'owner'].includes(user.role)) return;
    getUserCompanies(user.id).then(({ data }) => {
      if (data && data.length > 0) setEmpresasUsuario(data.map(String));
      // vendedor sem loja vinculada não vê nenhuma empresa
      else if (['guest', 'vendedor'].includes(user.role)) setEmpresasUsuario([]);
    });
  }, [user?.id, user?.role]);

  const visiveis = useMemo(
    () => (empresasUsuario ? branches.filter((b) => empresasUsuario.includes(String(b.cd_empresa))) : branches),
    [branches, empresasUsuario],
  );
  // empresa fora das liberadas (ou só uma liberada): corrige a seleção
  useEffect(() => {
    if (visiveis.length === 0) return;
    if (!visiveis.some((b) => String(b.cd_empresa) === String(empresa))) setEmpresa(visiveis.length === 1 || empresasUsuario ? String(visiveis[0].cd_empresa) : '');
  }, [visiveis, empresa, empresasUsuario]);
  useEffect(() => {
    if (empresa) localStorage.setItem('cancelamento_empresa', empresa);
  }, [empresa]);

  const sel = visiveis.find((b) => String(b.cd_empresa) === String(empresa));

  return (
    <div className="mx-auto w-full max-w-7xl p-3 lg:p-4">
      <PageTitle
        title="Cancelamento de Transação"
        subtitle="Cancela a nota fiscal, a transação e o contas a receber de uma vez. Venda atendida acima de R$ 1.000,00 precisa da autorização do financeiro."
        icon={Prohibit}
        iconColor="text-rose-600"
      />
      <CancelarTransacao
        variante="pagina"
        empresa={sel ? parseInt(empresa, 10) : null}
        empresaNome={sel?.nm_grupoempresa}
        empresas={visiveis}
        onEmpresa={setEmpresa}
        por={user?.email || user?.name || null}
        showToast={showToast}
      />
      {toast && (
        <div className={`fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${toast.type === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.type === 'ok' ? <CheckCircle size={17} weight="bold" /> : <Warning size={17} weight="bold" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
