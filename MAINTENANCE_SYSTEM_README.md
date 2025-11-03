# Sistema de Manutenção - Documentação

Este sistema permite bloquear páginas durante manutenção, permitindo acesso apenas para administradores e owners.

## 📁 Arquivos Criados

### 1. **Hook**: `src/hooks/useMaintenanceMode.js`

Hook personalizado que gerencia a lógica de manutenção.

### 2. **Componente Modal**: `src/components/MaintenanceModal.jsx`

Modal visual que bloqueia usuários comuns.

### 3. **Componente Banner**: `src/components/MaintenanceBanner.jsx`

Banner informativo para administradores.

---

## 🚀 Como Usar

### Exemplo Básico (CrosbyBot)

```jsx
import React from 'react';
import useMaintenanceMode from '../hooks/useMaintenanceMode';
import MaintenanceModal from '../components/MaintenanceModal';
import MaintenanceBanner from '../components/MaintenanceBanner';

const MinhaPage = () => {
  // ⚠️ Ativar/desativar manutenção
  const SISTEMA_EM_MANUTENCAO = true;

  // Usar o hook
  const { showBanner, showModal, userRole } = useMaintenanceMode(
    SISTEMA_EM_MANUTENCAO,
  );

  return (
    <div>
      {/* Banner para Admin/Owner */}
      {showBanner && <MaintenanceBanner userRole={userRole} />}

      {/* Modal de Bloqueio */}
      {showModal && (
        <MaintenanceModal systemName="Nome do Sistema" homeRoute="/home" />
      )}

      {/* Seu conteúdo normal aqui */}
      <h1>Minha Página</h1>
    </div>
  );
};

export default MinhaPage;
```

---

## 📋 API do Hook `useMaintenanceMode`

### Parâmetros

- `isMaintenanceActive` (boolean): Define se o sistema está em manutenção

### Retorno

```javascript
{
  sistemaAcessivel: boolean,      // true se usuário pode acessar
  isAdminOrOwner: boolean,        // true se é admin ou owner
  userRole: string,               // 'user', 'admin' ou 'owner'
  showBanner: boolean,            // true para mostrar banner de admin
  showModal: boolean,             // true para mostrar modal de bloqueio
  isMaintenanceActive: boolean    // estado atual da manutenção
}
```

---

## 🎨 API do Componente `MaintenanceModal`

### Props

| Prop             | Tipo    | Padrão    | Descrição                          |
| ---------------- | ------- | --------- | ---------------------------------- |
| `systemName`     | string  | "Sistema" | Nome do sistema em manutenção      |
| `homeRoute`      | string  | "/home"   | Rota para o botão "Voltar ao Home" |
| `showBackButton` | boolean | true      | Mostrar/ocultar botão de voltar    |

### Exemplo Customizado

```jsx
<MaintenanceModal
  systemName="Dashboard Analytics"
  homeRoute="/dashboard"
  showBackButton={true}
/>
```

---

## 🎨 API do Componente `MaintenanceBanner`

### Props

| Prop       | Tipo   | Descrição                            |
| ---------- | ------ | ------------------------------------ |
| `userRole` | string | Role do usuário ('admin' ou 'owner') |

### Exemplo

```jsx
<MaintenanceBanner userRole={userRole} />
```

---

## 🔐 Configuração de Roles

O sistema verifica o role do usuário em:

1. `user?.user_metadata?.role` (Supabase padrão)
2. `user?.role` (fallback)

Roles aceitos:

- `'admin'` - Administrador
- `'owner'` - Proprietário
- `'user'` - Usuário comum (bloqueado)

---

## 💡 Exemplos de Uso

### 1. Ativar Manutenção

```javascript
const SISTEMA_EM_MANUTENCAO = true;
```

### 2. Desativar Manutenção

```javascript
const SISTEMA_EM_MANUTENCAO = false;
```

### 3. Usar em Múltiplas Páginas

**Página 1: Dashboard**

```jsx
const Dashboard = () => {
  const { showBanner, showModal, userRole } = useMaintenanceMode(true);

  return (
    <div>
      {showBanner && <MaintenanceBanner userRole={userRole} />}
      {showModal && <MaintenanceModal systemName="Dashboard" />}
      {/* conteúdo */}
    </div>
  );
};
```

**Página 2: Relatórios**

```jsx
const Relatorios = () => {
  const { showBanner, showModal, userRole } = useMaintenanceMode(true);

  return (
    <div>
      {showBanner && <MaintenanceBanner userRole={userRole} />}
      {showModal && <MaintenanceModal systemName="Relatórios" homeRoute="/" />}
      {/* conteúdo */}
    </div>
  );
};
```

### 4. Sem Botão de Voltar

```jsx
<MaintenanceModal systemName="Área Restrita" showBackButton={false} />
```

---

## ✨ Vantagens

1. ✅ **Reutilizável**: Use em qualquer página
2. ✅ **Flexível**: Customize nome, rota e botões
3. ✅ **Centralizado**: Uma única fonte de verdade
4. ✅ **Performático**: Usa useMemo para otimização
5. ✅ **Profissional**: Design moderno e animado
6. ✅ **Acessível**: Banner para admins, bloqueio para usuários

---

## 🎯 Quando Usar

- Durante atualizações do sistema
- Manutenção de banco de dados
- Implementação de novas features
- Correção de bugs críticos
- Qualquer situação que exija bloqueio temporário

---

## 📝 Notas Importantes

1. O hook usa `useMemo` para otimização de performance
2. As animações são adicionadas apenas uma vez no DOM
3. O modal bloqueia completamente a interação com a página
4. Administradores sempre têm acesso total
5. O sistema é 100% responsivo e mobile-friendly

---

## 🐛 Troubleshooting

### Usuário admin ainda está bloqueado

- Verifique se o role está sendo salvo corretamente no Supabase
- Confirme que é `'admin'` ou `'owner'` (case-sensitive)

### Banner não aparece

- Verifique se `showBanner` está true
- Confirme que o usuário é admin/owner

### Modal não bloqueia

- Verifique se `showModal` está true
- Confirme que o componente está renderizado fora de containers com overflow

---

## 📞 Suporte

Criado por: Crosby Tech  
Data: Novembro 2025  
Versão: 1.0.0
