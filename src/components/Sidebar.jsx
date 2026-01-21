import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  UserGear,
  X,
  Money,
  Receipt,
  CreditCard,
  FileText,
  Calendar,
  ChartLineUp,
  CheckCircle,
  Megaphone,
  Storefront,
  Buildings,
  TrendUp,
  Trophy,
  Users,
  ShoppingCart,
  CaretDown,
  CaretRight,
  ChartPieSlice,
  Folder,
  Shield,
  House,
  Bank,
  Eye,
  ChartBar,
  Target,
  IdentificationCard,
  CurrencyCircleDollar,
  CurrencyDollar,
  SquaresFour,
  SpotifyLogo,
  Article,
  TShirt,
  CalendarDots,
  ClipboardText,
  Handshake,
  MagnifyingGlass,
  Wallet,
} from '@phosphor-icons/react';

// Componentes de ícones modernos
const ChevronIcon = ({ open }) =>
  open ? (
    <CaretDown
      size={16}
      className="ml-auto transition-transform duration-200"
    />
  ) : (
    <CaretRight
      size={16}
      className="ml-auto transition-transform duration-200"
    />
  );

const financeiro = [
  {
    name: 'Contas a Pagar',
    href: '#',
    icon: Money,
    color: 'text-red-600',
    roles: ['owner', 'admin', 'manager', 'user'],
    children: [
      {
        name: 'Vencimento',
        href: '/contas-a-pagar',
        icon: Calendar,
        color: 'text-red-600',
        roles: ['owner', 'admin', 'manager', 'user'],
      },
      {
        name: 'Emissão',
        href: '/contas-a-pagar-emissao',
        icon: Calendar,
        color: 'text-red-600',
        roles: ['owner', 'admin', 'manager', 'user'],
      },
    ],
  },
  {
    name: 'Contas a Receber',
    href: '#',
    icon: Receipt,
    color: 'text-green-600',
    roles: ['owner', 'admin', 'manager', 'user'],
    children: [
      {
        name: 'Vencimento',
        href: '/contas-a-receber',
        icon: Calendar,
        color: 'text-green-600',
        roles: ['owner', 'admin', 'manager', 'user'],
      },
      {
        name: 'Emissão',
        href: '/contas-a-receber-emissao',
        icon: Calendar,
        color: 'text-green-600',
        roles: ['owner', 'admin', 'manager', 'user'],
      },
    ],
  },
  {
    name: 'Batida de Carteira',
    href: '/batida-carteira',
    icon: Wallet,
    color: 'text-emerald-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Análise de Crédito',
    href: '/analise-credito',
    icon: ClipboardText,
    color: 'text-purple-600',
    roles: ['owner', 'admin', 'manager'],
  },
  {
    name: 'Análise de Renegociações',
    href: '/analise-renegociacao',
    icon: Handshake,
    color: 'text-orange-600',
    roles: ['owner', 'admin', 'manager'],
  },
  {
    name: 'Fluxo de Caixa',
    href: '/fluxo-caixa',
    icon: TrendUp,
    color: 'text-indigo-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Despesas por Setor',
    href: '/despesas-por-setor',
    icon: FileText,
    color: 'text-red-600',
    roles: ['owner', 'admin', 'manager', 'user', 'guest'],
  },
  {
    name: 'Saldo Bancário',
    href: '/saldo-bancario',
    icon: Bank,
    color: 'text-cyan-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Importação .RET',
    href: '/importacao-ret',
    icon: FileText,
    color: 'text-teal-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Ajuste de .RET',
    href: '/ajuste-retorno',
    icon: Article,
    color: 'text-purple-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Extrato Financeiro',
    href: '/extrato-financeiro',
    icon: CreditCard,
    color: 'text-blue-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Extrato TOTVS',
    href: '/extrato-totvs',
    icon: Receipt,
    color: 'text-indigo-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Auditoria',
    href: '#',
    icon: MagnifyingGlass,
    color: 'text-amber-600',
    roles: ['owner', 'admin', 'manager', 'user'],
    children: [
      {
        name: 'Antecipações',
        href: '/auditoria-antecipacoes',
        icon: MagnifyingGlass,
        color: 'text-red-600',
        roles: ['owner', 'admin', 'manager', 'user'],
      },
      {
        name: 'Conciliação',
        href: '/auditoria-conciliacao',
        icon: MagnifyingGlass,
        color: 'text-purple-600',
        roles: ['owner', 'admin', 'manager', 'user'],
      },
      {
        name: 'Faturamento',
        href: '/auditoria-faturamento',
        icon: MagnifyingGlass,
        color: 'text-blue-600',
        roles: ['owner', 'admin', 'manager', 'user'],
      },
    ],
  },
  {
    name: 'Extrato Cliente',
    href: '/extrato-cliente',
    icon: IdentificationCard,
    color: 'text-cyan-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Conciliação',
    href: '/conciliacao',
    icon: CheckCircle,
    color: 'text-green-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Saldo Bancário TOTVS',
    href: '/saldo-bancario-totvs',
    icon: Bank,
    color: 'text-blue-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'DRE',
    href: '/dre',
    icon: ChartBar,
    color: 'text-purple-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Manifestação de NF',
    href: '/manifestacao-nf',
    icon: FileText,
    color: 'text-indigo-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Receita Líquida',
    href: '/receita-liquida',
    icon: ChartBar,
    color: 'text-purple-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
  {
    name: 'Títulos Clientes',
    href: '/titulos-clientes',
    icon: Receipt,
    color: 'text-blue-600',
    roles: ['owner', 'admin', 'manager', 'user'],
  },
];

const faturamento = [
  {
    name: 'Auditoria CMV',
    href: '/auditoria-cmv',
    icon: FileText,
    color: 'text-indigo-600',
  },
  {
    name: 'CMV Consolidado',
    href: '/cmv-consolidado',
    icon: FileText,
    color: 'text-indigo-600',
  },
  {
    name: 'CMV Multimarcas',
    href: '/cmv-multimarcas',
    icon: FileText,
    color: 'text-indigo-600',
  },
  {
    name: 'CMV Revenda',
    href: '/cmv-revenda',
    icon: FileText,
    color: 'text-indigo-600',
  },
  {
    name: 'CMV Franquia',
    href: '/cmv-franquia',
    icon: FileText,
    color: 'text-indigo-600',
  },
  {
    name: 'CMV Varejo',
    href: '/cmv-varejo',
    icon: FileText,
    color: 'text-indigo-600',
  },
];

const varejo = [
  {
    name: 'Dashboard Varejo',
    href: '/dashboard-varejo',
    icon: ChartLineUp,
    color: 'text-indigo-600',
  },
  {
    name: 'Metas Varejo',
    href: '/metas-varejo',
    icon: Target,
    color: 'text-orange-600',
  },
  {
    name: 'CREDEV VAREJO',
    href: '/credev-varejo',
    icon: Buildings,
    color: 'text-green-600',
  },
  {
    name: 'Análise Reativação CB',
    href: '/analise-cashback',
    icon: CurrencyCircleDollar,
    color: 'text-green-600',
  },
  {
    name: 'Ação Cartões',
    href: '/check-in-card',
    icon: CreditCard,
    color: 'text-green-600',
  },
  {
    name: 'Análise de Transação',
    href: '/analise-transacao',
    icon: Receipt,
    color: 'text-blue-600',
  },
  {
    name: 'Cohort',
    href: '/cohort-analysis',
    icon: Users,
    color: 'text-purple-600',
  },
];

const multimarcas = [
  {
    name: 'Dashboard Multimarcas',
    href: '/dashboard-multimarcas',
    icon: ChartLineUp,
    color: 'text-indigo-600',
  },
  {
    name: 'CREDEV MULTIMARCAS',
    href: '/credev-multimarcas',
    icon: Buildings,
    color: 'text-purple-600',
  },
  {
    name: 'Inadimplentes Multimarcas',
    href: '/inadimplentes-multimarcas',
    icon: ChartBar,
    color: 'text-purple-600',
  },
];

const revenda = [
  {
    name: 'Dashboard Revenda',
    href: '/dashboard-revenda',
    icon: ChartLineUp,
    color: 'text-indigo-600',
  },
  {
    name: 'CREDEV REVENDA',
    href: '/credev-revenda',
    icon: Buildings,
    color: 'text-blue-600',
  },
  {
    name: 'Inadimplentes Revenda',
    href: '/inadimplentes-revenda',
    icon: ChartBar,
    color: 'text-purple-600',
  },
];

const franquias = [
  {
    name: 'Dashboard Franquias',
    href: '/dashboard-franquias',
    icon: ChartLineUp,
    color: 'text-indigo-600',
  },
  {
    name: 'Compras Franquias',
    href: '/compras-franquias',
    icon: ShoppingCart,
    color: 'text-emerald-600',
  },
  { name: 'CREDEV', href: '/credev', icon: Buildings, color: 'text-blue-600' },
  {
    name: 'Inadimplentes Franquias',
    href: '/inadimplentes-franquias',
    icon: ChartBar,
    color: 'text-purple-600',
  },
];

const acaoCartoes = [
  {
    name: 'Check-in Card',
    href: '/check-in-card',
    icon: CreditCard,
    color: 'text-blue-600',
  },
  {
    name: 'Meus Cartões',
    href: '/meus-cartoes',
    icon: CreditCard,
    color: 'text-green-600',
  },
];

// Sub-seção: Dashboard Financeiro (itens internos)
const dashboardFinanceiro = [
  {
    name: 'Financeiro por Canal',
    href: '/financeiro-por-canal',
    icon: ChartBar,
    color: 'text-purple-600',
  },
  {
    name: 'Endividamento',
    href: '/endividamento',
    icon: ChartBar,
    color: 'text-purple-600',
  },
  {
    name: 'PMR',
    href: '/dash-contas-a-receber',
    icon: ChartBar,
    color: 'text-purple-600',
  },
];
const DashboardFaturamento = [
  {
    name: 'Dashboard Faturamento',
    href: '/dashboard-faturamento',
    icon: ChartLineUp,
    color: 'text-indigo-600',
  },
];

const Sidebar = ({ isOpen, onClose, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [financeiroOpen, setFinanceiroOpen] = useState(false);
  const [dashboardFinanceiroOpen, setDashboardFinanceiroOpen] = useState(false);
  const [faturamentoOpen, setFaturamentoOpen] = useState(false);
  const [varejoOpen, setVarejoOpen] = useState(false);
  const [multimarcasOpen, setMultimarcasOpen] = useState(false);
  const [revendaOpen, setRevendaOpen] = useState(false);
  const [franquiasOpen, setFranquiasOpen] = useState(false);
  const [acaoCartoesOpen, setAcaoCartoesOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [producaoOpen, setProducaoOpen] = useState(false);
  const { user } = useAuth();

  // Garante que ao abrir uma seção, as demais sejam fechadas
  const handleSectionToggle = (section) => {
    if (section === 'financeiro') {
      const next = !financeiroOpen;
      setFinanceiroOpen(next);
      setFaturamentoOpen(false);
      setVarejoOpen(false);
      setMultimarcasOpen(false);
      setRevendaOpen(false);
      setFranquiasOpen(false);
      setAcaoCartoesOpen(false);
      setAdminOpen(false);
      if (!next) setDashboardFinanceiroOpen(false);
      return;
    }
    if (section === 'faturamento') {
      const next = !faturamentoOpen;
      setFaturamentoOpen(next);
      setFinanceiroOpen(false);
      setDashboardFinanceiroOpen(false);
      setVarejoOpen(false);
      setMultimarcasOpen(false);
      setRevendaOpen(false);
      setFranquiasOpen(false);
      setAcaoCartoesOpen(false);
      setAdminOpen(false);
      return;
    }
    if (section === 'varejo') {
      const next = !varejoOpen;
      setVarejoOpen(next);
      setFinanceiroOpen(false);
      setDashboardFinanceiroOpen(false);
      setFaturamentoOpen(false);
      setMultimarcasOpen(false);
      setRevendaOpen(false);
      setFranquiasOpen(false);
      setAcaoCartoesOpen(false);
      setAdminOpen(false);
      return;
    }
    if (section === 'multimarcas') {
      const next = !multimarcasOpen;
      setMultimarcasOpen(next);
      setFinanceiroOpen(false);
      setDashboardFinanceiroOpen(false);
      setFaturamentoOpen(false);
      setVarejoOpen(false);
      setRevendaOpen(false);
      setFranquiasOpen(false);
      setAcaoCartoesOpen(false);
      setAdminOpen(false);
      return;
    }
    if (section === 'revenda') {
      const next = !revendaOpen;
      setRevendaOpen(next);
      setFinanceiroOpen(false);
      setDashboardFinanceiroOpen(false);
      setFaturamentoOpen(false);
      setVarejoOpen(false);
      setMultimarcasOpen(false);
      setFranquiasOpen(false);
      setAcaoCartoesOpen(false);
      setAdminOpen(false);
      return;
    }
    if (section === 'franquias') {
      const next = !franquiasOpen;
      setFranquiasOpen(next);
      setFinanceiroOpen(false);
      setDashboardFinanceiroOpen(false);
      setFaturamentoOpen(false);
      setVarejoOpen(false);
      setMultimarcasOpen(false);
      setRevendaOpen(false);
      setAcaoCartoesOpen(false);
      setAdminOpen(false);
      return;
    }
    if (section === 'acaoCartoes') {
      const next = !acaoCartoesOpen;
      setAcaoCartoesOpen(next);
      setFinanceiroOpen(false);
      setDashboardFinanceiroOpen(false);
      setFaturamentoOpen(false);
      setVarejoOpen(false);
      setMultimarcasOpen(false);
      setRevendaOpen(false);
      setFranquiasOpen(false);
      setAdminOpen(false);
      return;
    }
    if (section === 'admin') {
      const next = !adminOpen;
      setAdminOpen(next);
      setFinanceiroOpen(false);
      setDashboardFinanceiroOpen(false);
      setFaturamentoOpen(false);
      setVarejoOpen(false);
      setMultimarcasOpen(false);
      setRevendaOpen(false);
      setFranquiasOpen(false);
      setAcaoCartoesOpen(false);
      return;
    }
    if (section === 'producao') {
      const next = !producaoOpen;
      setProducaoOpen(next);
      setFinanceiroOpen(false);
      setDashboardFinanceiroOpen(false);
      setFaturamentoOpen(false);
      setVarejoOpen(false);
      setMultimarcasOpen(false);
      setRevendaOpen(false);
      setFranquiasOpen(false);
      setAcaoCartoesOpen(false);
      setAdminOpen(false);
      return;
    }
  };

  const handleNavigation = (href, external = false) => {
    onClose();
    if (external) {
      window.open(href, '_blank');
    } else {
      navigate(href);
    }
  };

  // Função helper para verificar se o usuário tem acesso a uma página
  const hasAccessToPage = (href) => {
    if (!user) return false;

    // Owner tem acesso total
    if (user.allowedPages === '*') {
      return true;
    }

    // Verificar se a página está nas permissões do usuário
    if (user.allowedPages && Array.isArray(user.allowedPages)) {
      return user.allowedPages.includes(href);
    }

    return false;
  };

  // Componente para renderizar itens de menu
  const MenuItem = ({ item, isActive, level = 0 }) => {
    const IconComponent = item.icon;
    const paddingLeft = level === 0 ? 'pl-3' : 'pl-6';

    // Verificar permissão baseada em allowedPages
    const canSee = item.href === '#' || hasAccessToPage(item.href);

    if (!canSee) return null;

    // Item com filhos (subpasta)
    if (item.children && Array.isArray(item.children)) {
      const [open, setOpen] = React.useState(false);
      return (
        <div className={`${paddingLeft}`}>
          <button
            onClick={() => setOpen(!open)}
            className={`
              w-full flex items-center gap-2 pr-3 py-2 
              text-xs font-semibold rounded-lg transition-all duration-200 font-barlow
              ${
                open
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
              }
            `}
          >
            <IconComponent size={14} className="text-gray-500" />
            <span>{item.name}</span>
            <ChevronIcon open={open} />
          </button>
          {open && (
            <div className="mt-1 space-y-1">
              {item.children.map((child) => (
                <MenuItem
                  key={`${item.name}-${child.name}`}
                  item={child}
                  isActive={location.pathname === child.href}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Item simples
    return (
      <button
        onClick={() => handleNavigation(item.href, item.external)}
        className={`
          w-full flex items-center gap-2 ${paddingLeft} pr-3 py-2 
          text-xs font-medium rounded-lg transition-all duration-200 font-barlow
          ${
            isActive
              ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-r-2 border-blue-600'
              : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
          }
        `}
      >
        {IconComponent && (
          <IconComponent
            size={14}
            weight={isActive ? 'fill' : 'regular'}
            className="text-gray-500"
          />
        )}
        <span className={`${isActive ? 'font-semibold' : ''}`}>
          {item.name}
        </span>
        {item.external && (
          <svg
            className="ml-auto w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        )}
      </button>
    );
  };

  // Componente para seções colapsáveis
  const MenuSection = ({
    title,
    items,
    isOpen,
    onToggle,
    icon: SectionIcon,
    color = 'text-gray-600',
  }) => {
    // Verificar se há pelo menos um item visível nesta seção
    const hasVisibleItems = items.some((item) => {
      // Se o item tem children, verificar se algum child é visível
      if (item.children && Array.isArray(item.children)) {
        return item.children.some((child) => hasAccessToPage(child.href));
      }
      // Se é item simples, verificar se tem acesso
      return item.href === '#' || hasAccessToPage(item.href);
    });

    // Se não há itens visíveis, não renderizar a seção
    if (!hasVisibleItems) return null;

    return (
      <div className="mb-2">
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 hover:bg-gray-200 group font-barlow"
        >
          <SectionIcon size={14} className="text-gray-500" />
          <span className="flex-1 text-left text-gray-800">{title}</span>
          <ChevronIcon open={isOpen} />
        </button>

        {isOpen && (
          <div className="mt-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {items.map((item) => (
              <MenuItem
                key={item.name}
                item={item}
                isActive={location.pathname === item.href}
                level={1}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const SidebarContent = () => {
    if (!user) return null;

    // Função para obter o label do role
    const getRoleLabel = (role) => {
      const roleConfig = {
        admin: 'Administrador',
        manager: 'Gerente',
        user: 'Financeiro',
        guest: 'Padrão',
        owner: 'Proprietário',
        vendedor: 'Vendedor',
      };
      return roleConfig[role] || role;
    };

    // Sidebar dinâmica única para todos os usuários
    // Os itens são filtrados automaticamente pelo MenuItem baseado em allowedPages
    return (
      <div className="w-60 h-full bg-white shadow-xl border-r border-gray-200 flex flex-col">
        {/* Header com logo e close button */}
        <div className="h-16 px-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <img
              src="/crosbyazul.png"
              alt="Logo Crosby"
              className="h-8 w-auto"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-3 overflow-y-auto overflow-x-hidden">
          {/* Home */}
          <MenuItem
            item={{
              name: 'Home',
              href: '/home',
              icon: House,
              color: 'text-blue-600',
            }}
            isActive={location.pathname === '/home'}
          />

          {/* Crosby Bot */}
          <MenuItem
            item={{
              name: 'Crosby Bot',
              href: '/crosby-bot',
              icon: Megaphone,
              color: 'text-indigo-600',
            }}
            isActive={location.pathname === '/crosby-bot'}
          />

          {/* BI EXTERNO */}
          <MenuItem
            item={{
              name: 'Estoque e Showroom',
              href: '/bi-externo',
              icon: ChartLineUp,
              color: 'text-indigo-600',
            }}
            isActive={location.pathname === '/bi-externo'}
          />

          {/* BI EXTERNO */}
          <MenuItem
            item={{
              name: 'BIs Externo',
              href: '/dashboard',
              icon: ChartLineUp,
              color: 'text-indigo-600',
            }}
            isActive={location.pathname === '/bi-externo'}
          />

          {/* Dashboard Faturamento */}
          <MenuItem
            item={{
              name: 'Dashboard Faturamento',
              href: '/dashboard-faturamento',
              icon: ChartLineUp,
              color: 'text-indigo-600',
            }}
            isActive={location.pathname === '/dashboard-faturamento'}
          />

          {/* Seção Financeiro */}
          <MenuSection
            title="Financeiro"
            items={financeiro}
            isOpen={financeiroOpen}
            onToggle={() => handleSectionToggle('financeiro')}
            icon={Money}
            color="text-emerald-600"
          />

          {/* Dashboard Financeiro (submenu do Financeiro) */}
          {financeiroOpen && (
            <div className="ml-4">
              <MenuSection
                title="Dashboard Financeiro"
                items={dashboardFinanceiro}
                isOpen={dashboardFinanceiroOpen}
                onToggle={() =>
                  setDashboardFinanceiroOpen(!dashboardFinanceiroOpen)
                }
                icon={ChartBar}
                color="text-purple-600"
              />
            </div>
          )}

          {/* Seção CMV */}
          <MenuSection
            title="CMV"
            items={faturamento}
            isOpen={faturamentoOpen}
            onToggle={() => handleSectionToggle('faturamento')}
            icon={ChartLineUp}
            color="text-blue-600"
          />

          {/* Seção Varejo */}
          <MenuSection
            title="Varejo"
            items={varejo}
            isOpen={varejoOpen}
            onToggle={() => handleSectionToggle('varejo')}
            icon={Storefront}
            color="text-green-600"
          />

          {/* Seção Multimarcas */}
          <MenuSection
            title="Multimarcas"
            items={multimarcas}
            isOpen={multimarcasOpen}
            onToggle={() => handleSectionToggle('multimarcas')}
            icon={Buildings}
            color="text-purple-600"
          />

          {/* Seção Revenda */}
          <MenuSection
            title="Revenda"
            items={revenda}
            isOpen={revendaOpen}
            onToggle={() => handleSectionToggle('revenda')}
            icon={TrendUp}
            color="text-blue-600"
          />

          {/* Seção Franquias */}
          <MenuSection
            title="Franquias"
            items={franquias}
            isOpen={franquiasOpen}
            onToggle={() => handleSectionToggle('franquias')}
            icon={Users}
            color="text-amber-600"
          />

          {/* Seção Produção */}
          <MenuSection
            title="Produção"
            items={[
              {
                name: 'Contas a Pagar',
                href: '/producao',
                icon: ChartLineUp,
                color: 'text-indigo-600',
              },
            ]}
            isOpen={producaoOpen}
            onToggle={() => handleSectionToggle('producao')}
            icon={ChartLineUp}
            color="text-indigo-600"
          />

          {/* Seção Ação Cartões */}
          <MenuSection
            title="Ação Cartões"
            items={acaoCartoes}
            isOpen={acaoCartoesOpen}
            onToggle={() => handleSectionToggle('acaoCartoes')}
            icon={CreditCard}
            color="text-blue-600"
          />

          {/* Minha Franquia (pasta) */}
          <MenuItem
            item={{
              name: 'Minha Franquia',
              href: '#',
              icon: Folder,
              color: 'text-amber-600',
              children: [
                {
                  name: 'Portal de Títulos',
                  href: '/contas-pagar-franquias',
                  icon: Receipt,
                  color: 'text-red-600',
                },
                {
                  name: 'Extrato de Crédito',
                  href: '/extrato-credito',
                  icon: CurrencyDollar,
                  color: 'text-green-600',
                },
                {
                  name: 'Solicitação de Crédito',
                  href: '/solicitacao-credito',
                  icon: CurrencyDollar,
                  color: 'text-green-600',
                },
                {
                  name: 'Renegociação de Dívidas',
                  href: '/renegociacao-dividas',
                  icon: Handshake,
                  color: 'text-orange-600',
                },
                {
                  name: 'Notas Fiscais',
                  href: '/notas-fiscais',
                  icon: Article,
                  color: 'text-blue-600',
                },
              ],
            }}
            isActive={false}
          />

          {/* VIGIA - item independente */}
          <MenuItem
            item={{
              name: 'Vigia',
              href: 'https://vigia.crosbytech.com.br/',
              icon: Eye,
              color: 'text-blue-600',
              external: true,
            }}
            isActive={false}
          />

          <MenuItem
            item={{
              name: 'Playlist Loja',
              href: 'https://open.spotify.com/playlist/0luIH9EeXQsM1EVLEe10Co?si=PVAUen1xTNq_65EcEFuHSw&pi=rle4YjINSti0l&nd=1&dlsi=514142e8d84b44b8',
              icon: SpotifyLogo,
              color: 'text-blue-600',
              external: true,
            }}
            isActive={false}
          />

          {/* Clientes */}
          <MenuItem
            item={{
              name: 'Clientes',
              href: '/clientes',
              icon: IdentificationCard,
              color: 'text-blue-600',
            }}
            isActive={location.pathname === '/clientes'}
          />

          {/* Auditoria de Transações */}
          <MenuItem
            item={{
              name: 'Auditoria de Transações',
              href: '/auditoria-transacoes',
              icon: Shield,
              color: 'text-purple-600',
            }}
            isActive={location.pathname === '/auditoria-transacoes'}
          />

          {/* Widgets */}
          <MenuItem
            item={{
              name: 'Meus Widgets',
              href: '/widgets',
              icon: SquaresFour,
              color: 'text-indigo-600',
            }}
            isActive={location.pathname === '/widgets'}
          />

          {/* Ranking Faturamento */}
          {hasAccessToPage('/ranking-faturamento') && (
            <div className="pt-4 border-t border-gray-100">
              <MenuItem
                item={{
                  name: 'Ranking Faturamento',
                  href: '/ranking-faturamento',
                  icon: Trophy,
                  color: 'text-yellow-600',
                }}
                isActive={location.pathname === '/ranking-faturamento'}
              />
            </div>
          )}

          {/* Seção Administrativa */}
          <div className="pt-6 border-t border-gray-200">
            <MenuSection
              title="Administração"
              items={[
                {
                  name: 'Painel Admin',
                  href: '/painel-admin',
                  icon: UserGear,
                  color: 'text-red-600',
                },
                {
                  name: 'Gerenciador de Dashboards',
                  href: '/gerenciador-dashboards',
                  icon: SquaresFour,
                  color: 'text-blue-600',
                },
                {
                  name: 'Gerenciador de Acessos',
                  href: '/gerenciador-acessos',
                  icon: Shield,
                  color: 'text-purple-600',
                },
                {
                  name: 'Gerenciador de Avisos',
                  href: '/gerenciador-avisos',
                  icon: Megaphone,
                  color: 'text-orange-600',
                },
              ]}
              isOpen={adminOpen}
              onToggle={() => handleSectionToggle('admin')}
              icon={Shield}
              color="text-red-600"
            />
          </div>
        </nav>

        {/* Footer com info do usuário */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <UserGear size={16} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate font-barlow">
                {user.email}
              </p>
              <p className="text-xs text-gray-500 font-barlow">
                {getRoleLabel(user.role)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden animate-in fade-in duration-500">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-500 ease-in-out"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 transform transition-all duration-500 ease-in-out animate-in slide-in-from-left">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar - sempre visível em lg+ */}
      <div
        className={`hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 transform transition-all duration-500 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </div>
    </>
  );
};

export default Sidebar;
