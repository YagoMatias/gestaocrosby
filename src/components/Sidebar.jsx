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
    name: 'Extrato Financeiro',
    href: '/extrato-financeiro',
    icon: CreditCard,
    color: 'text-blue-600',
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
];

const multimarcas = [
  {
    name: 'CREDEV MULTIMARCAS',
    href: '/credev-multimarcas',
    icon: Buildings,
    color: 'text-purple-600',
  },
];

const revenda = [
  {
    name: 'CREDEV REVENDA',
    href: '/credev-revenda',
    icon: Buildings,
    color: 'text-blue-600',
  },
];

const franquias = [
  {
    name: 'Compras Franquias',
    href: '/compras-franquias',
    icon: ShoppingCart,
    color: 'text-emerald-600',
  },
  { name: 'CREDEV', href: '/credev', icon: Buildings, color: 'text-blue-600' },
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
  const [adminOpen, setAdminOpen] = useState(false);
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

  // Componente para renderizar itens de menu
  const MenuItem = ({ item, isActive, level = 0 }) => {
    const IconComponent = item.icon;
    const paddingLeft = level === 0 ? 'pl-3' : 'pl-6';
    const canSee = !item.roles || item.roles.includes(user?.role);

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
  }) => (
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

  const SidebarContent = () => {
    if (!user) return null;

    // Função para obter o label do role
    const getRoleLabel = (role) => {
      const roleConfig = {
        admin: 'Administrador',
        manager: 'Gerente',
        user: 'Financeiro',
        guest: 'Padrão', // Alterado visualmente
        owner: 'Proprietário',
      };
      return roleConfig[role] || role;
    };

    // Owner: acesso total
    if (user.role === 'owner') {
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
            {/* Dashboard/Home */}
            <MenuItem
              item={{
                name: 'Home',
                href: '/home',
                icon: House,
                color: 'text-blue-600',
              }}
              isActive={location.pathname === '/home'}
            />

            {/* BI EXTERNO */}
            <MenuItem
              item={{
                name: 'BI Externo',
                href: '/dashboard',
                icon: ChartLineUp,
                color: 'text-indigo-600',
              }}
              isActive={location.pathname === '/dashboard'}
            />

            {/* Dashboard Faturamento - NOVO */}
            <MenuItem
              item={{
                name: 'Dashboard Faturamento',
                href: '/dashboard-faturamento',
                icon: ChartLineUp,
                color: 'text-indigo-600',
              }}
              isActive={location.pathname === '/dashboard-faturamento'}
            />

            {/* Seções principais */}
            <MenuSection
              title="Financeiro"
              items={financeiro}
              isOpen={financeiroOpen}
              onToggle={() => handleSectionToggle('financeiro')}
              icon={Money}
              color="text-emerald-600"
            />
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

            <MenuSection
              title="CMV"
              items={faturamento}
              isOpen={faturamentoOpen}
              onToggle={() => handleSectionToggle('faturamento')}
              icon={ChartLineUp}
              color="text-blue-600"
            />

            <MenuSection
              title="Varejo"
              items={varejo}
              isOpen={varejoOpen}
              onToggle={() => handleSectionToggle('varejo')}
              icon={Storefront}
              color="text-green-600"
            />

            <MenuSection
              title="Multimarcas"
              items={multimarcas}
              isOpen={multimarcasOpen}
              onToggle={() => handleSectionToggle('multimarcas')}
              icon={Buildings}
              color="text-purple-600"
            />

            <MenuSection
              title="Revenda"
              items={revenda}
              isOpen={revendaOpen}
              onToggle={() => handleSectionToggle('revenda')}
              icon={TrendUp}
              color="text-blue-600"
            />

            <MenuSection
              title="Franquias"
              items={franquias}
              isOpen={franquiasOpen}
              onToggle={() => handleSectionToggle('franquias')}
              icon={Users}
              color="text-amber-600"
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

            {/* Clientes - item independente */}
            <MenuItem
              item={{
                name: 'Clientes',
                href: '/clientes',
                icon: IdentificationCard,
                color: 'text-blue-600',
              }}
              isActive={location.pathname === '/clientes'}
            />

            {/* Auditoria de Transações - item independente */}
            <MenuItem
              item={{
                name: 'Auditoria de Transações',
                href: '/auditoria-transacoes',
                icon: Shield,
                color: 'text-purple-600',
              }}
              isActive={location.pathname === '/auditoria-transacoes'}
            />

            {/* Ranking Faturamento - fora de seção */}
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

            {/* Seção Administrativa - apenas para owner */}
            {user.role === 'owner' && (
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
                  ]}
                  isOpen={adminOpen}
                  onToggle={() => handleSectionToggle('admin')}
                  icon={Shield}
                  color="text-red-600"
                />
              </div>
            )}
          </nav>

          {/* Footer com info do usuário - Owner */}
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
    }

    // Admin: acesso total (igual ao owner)
    if (user.role === 'admin') {
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
            {/* Dashboard/Home */}
            <MenuItem
              item={{
                name: 'Home',
                href: '/home',
                icon: House,
                color: 'text-blue-600',
              }}
              isActive={location.pathname === '/home'}
            />

            {/* Dashboard */}
            <MenuItem
              item={{
                name: 'BI Externo',
                href: '/dashboard',
                icon: ChartLineUp,
                color: 'text-indigo-600',
              }}
              isActive={location.pathname === '/dashboard'}
            />

            {/* Dashboard Faturamento - disponível para todos os roles */}
            <MenuItem
              item={{
                name: 'Dashboard Faturamento',
                href: '/dashboard-faturamento',
                icon: ChartLineUp,
                color: 'text-indigo-600',
              }}
              isActive={location.pathname === '/dashboard-faturamento'}
            />

            {/* Seções principais */}
            <MenuSection
              title="Financeiro"
              items={financeiro}
              isOpen={financeiroOpen}
              onToggle={() => setFinanceiroOpen(!financeiroOpen)}
              icon={Money}
              color="text-emerald-600"
            />
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

            <MenuSection
              title="CMV"
              items={faturamento}
              isOpen={faturamentoOpen}
              onToggle={() => setFaturamentoOpen(!faturamentoOpen)}
              icon={ChartLineUp}
              color="text-blue-600"
            />

            <MenuSection
              title="Varejo"
              items={varejo}
              isOpen={varejoOpen}
              onToggle={() => handleSectionToggle('varejo')}
              icon={Storefront}
              color="text-green-600"
            />

            <MenuSection
              title="Multimarcas"
              items={multimarcas}
              isOpen={multimarcasOpen}
              onToggle={() => handleSectionToggle('multimarcas')}
              icon={Buildings}
              color="text-purple-600"
            />

            <MenuSection
              title="Revenda"
              items={revenda}
              isOpen={revendaOpen}
              onToggle={() => handleSectionToggle('revenda')}
              icon={TrendUp}
              color="text-blue-600"
            />

            <MenuSection
              title="Franquias"
              items={franquias}
              isOpen={franquiasOpen}
              onToggle={() => handleSectionToggle('franquias')}
              icon={Users}
              color="text-amber-600"
            />

            {/* VIGIA - item independente */}
            <MenuItem
              item={{
                name: 'VIGIA',
                href: 'https://vigia.crosbytech.com.br/',
                icon: Eye,
                color: 'text-blue-600',
                external: true,
              }}
              isActive={false}
            />

            {/* Clientes - item independente */}
            <MenuItem
              item={{
                name: 'Clientes',
                href: '/clientes',
                icon: IdentificationCard,
                color: 'text-blue-600',
              }}
              isActive={location.pathname === '/clientes'}
            />

            {/* Ranking Faturamento - fora de seção */}
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

            {/* Seção Administrativa - apenas para owner e admin */}
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
                ]}
                isOpen={adminOpen}
                onToggle={() => setAdminOpen(!adminOpen)}
                icon={Shield}
                color="text-red-600"
              />
            </div>
          </nav>

          {/* Footer com info do usuário - Admin */}
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
    }

    // Manager: acesso total exceto administração
    if (user.role === 'manager') {
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
            {/* Dashboard/Home */}
            <MenuItem
              item={{
                name: 'Home',
                href: '/home',
                icon: House,
                color: 'text-blue-600',
              }}
              isActive={location.pathname === '/home'}
            />

            {/* Seção Financeiro */}
            <MenuSection
              title="Financeiro"
              items={financeiro}
              isOpen={financeiroOpen}
              onToggle={() => setFinanceiroOpen(!financeiroOpen)}
              icon={Money}
              color="text-emerald-600"
            />
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

            <MenuSection
              title="CMV"
              items={faturamento}
              isOpen={faturamentoOpen}
              onToggle={() => setFaturamentoOpen(!faturamentoOpen)}
              icon={ChartLineUp}
              color="text-blue-600"
            />

            <MenuSection
              title="Varejo"
              items={varejo}
              isOpen={varejoOpen}
              onToggle={() => handleSectionToggle('varejo')}
              icon={Storefront}
              color="text-green-600"
            />

            <MenuSection
              title="Multimarcas"
              items={multimarcas}
              isOpen={multimarcasOpen}
              onToggle={() => handleSectionToggle('multimarcas')}
              icon={Buildings}
              color="text-purple-600"
            />

            <MenuSection
              title="Revenda"
              items={revenda}
              isOpen={revendaOpen}
              onToggle={() => handleSectionToggle('revenda')}
              icon={TrendUp}
              color="text-blue-600"
            />

            <MenuSection
              title="Franquias"
              items={franquias}
              isOpen={franquiasOpen}
              onToggle={() => handleSectionToggle('franquias')}
              icon={Users}
              color="text-amber-600"
            />

            {/* VIGIA - item independente */}
            <MenuItem
              item={{
                name: 'VIGIA',
                href: 'https://vigia.crosbytech.com.br/',
                icon: Eye,
                color: 'text-blue-600',
                external: true,
              }}
              isActive={false}
            />

            {/* Clientes - item independente */}
            <MenuItem
              item={{
                name: 'Clientes',
                href: '/clientes',
                icon: IdentificationCard,
                color: 'text-blue-600',
              }}
              isActive={location.pathname === '/clientes'}
            />

            {/* Ranking Faturamento - fora de seção */}
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
          </nav>

          {/* Footer com info do usuário - Manager */}
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
    }

    // User: acesso ao financeiro e franquias
    if (user.role === 'user') {
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
            {/* Dashboard/Home */}
            <MenuItem
              item={{
                name: 'Home',
                href: '/home',
                icon: House,
                color: 'text-blue-600',
              }}
              isActive={location.pathname === '/home'}
            />

            {/* Dashboard Faturamento - disponível para todos os roles */}
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
              onToggle={() => setFinanceiroOpen(!financeiroOpen)}
              icon={Money}
              color="text-emerald-600"
            />
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
              onToggle={() => setFaturamentoOpen(!faturamentoOpen)}
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
          </nav>

          {/* Footer com info do usuário - User */}
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
    }

    // Guest (Varejo): acesso a franquias e ranking faturamento
    if (user.role === 'guest') {
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
            {/* Dashboard/Home */}
            <MenuItem
              item={{
                name: 'Home',
                href: '/home',
                icon: House,
                color: 'text-blue-600',
              }}
              isActive={location.pathname === '/home'}
            />

            {/* Dashboard Faturament */}
            <MenuItem
              item={{
                name: 'Dashboard Faturamento',
                href: '/dashboard-faturamento',
                icon: ChartLineUp,
                color: 'text-indigo-600',
              }}
              isActive={location.pathname === '/dashboard-faturamento'}
            />

            {/* Seção Financeiro - visível para PADRÃO apenas com filtros por role */}
            <MenuSection
              title="Financeiro"
              items={financeiro}
              isOpen={financeiroOpen}
              onToggle={() => setFinanceiroOpen(!financeiroOpen)}
              icon={Money}
              color="text-emerald-600"
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

            <MenuSection
              title="Multimarcas"
              items={multimarcas}
              isOpen={multimarcasOpen}
              onToggle={() => handleSectionToggle('multimarcas')}
              icon={Buildings}
              color="text-purple-600"
            />

            <MenuSection
              title="Revenda"
              items={revenda}
              isOpen={revendaOpen}
              onToggle={() => handleSectionToggle('revenda')}
              icon={TrendUp}
              color="text-blue-600"
            />

            <MenuSection
              title="Franquias"
              items={franquias}
              isOpen={franquiasOpen}
              onToggle={() => handleSectionToggle('franquias')}
              icon={Users}
              color="text-amber-600"
            />

            {/* VIGIA - item independente */}
            <MenuItem
              item={{
                name: 'VIGIA',
                href: 'https://vigia.crosbytech.com.br/',
                icon: Eye,
                color: 'text-blue-600',
                external: true,
              }}
              isActive={false}
            />

            {/* Ranking Faturamento */}
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
          </nav>

          {/* Footer com info do usuário - Guest */}
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
    }

    // Caso não reconhecido
    return null;
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
