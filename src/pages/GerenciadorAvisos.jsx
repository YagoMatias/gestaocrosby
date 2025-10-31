import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { Card, CardContent } from '../components/ui/cards';
import PageTitle from '../components/ui/PageTitle';
import { Megaphone, PencilSimple, ListBullets } from '@phosphor-icons/react';
import NoticeEditor from '../components/NoticeEditor';
import NoticesList from '../components/NoticesList';

/**
 * Página de gerenciamento de avisos
 * Permite criar, editar, listar e visualizar estatísticas de avisos
 * Qualquer usuário com permissão pode acessar
 */
const GerenciadorAvisos = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('criar');
  const [noticeToEdit, setNoticeToEdit] = useState(null);

  // Verificar se o usuário está autenticado
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Megaphone size={32} className="text-red-600" weight="bold" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Acesso Negado
            </h2>
            <p className="text-gray-600">
              Você precisa estar autenticado para acessar o gerenciador de
              avisos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEditNotice = (notice) => {
    setNoticeToEdit(notice);
    setActiveTab('criar');
  };

  const handleSuccessCreate = () => {
    setNoticeToEdit(null);
    setActiveTab('listar');
  };

  const handleCancelEdit = () => {
    setNoticeToEdit(null);
    setActiveTab('listar');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 pb-6">
      <div className="max-w-6xl mx-auto">
        {/* Header da página */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={24} weight="bold" className="text-[#000638]" />
            <h1 className="text-xl font-bold text-gray-900">
              Gerenciador de Avisos
            </h1>
          </div>
          <p className="text-xs text-gray-600 ml-8">
            Crie e gerencie avisos para os usuários do sistema
          </p>
        </div>

        {/* Tabs de navegação */}
        <Card className="mb-4 bg-white shadow-sm flex justify-center">
          <CardContent className="p-3">
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setActiveTab('criar');
                  if (!noticeToEdit) setNoticeToEdit(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                  activeTab === 'criar'
                    ? 'bg-[#000638] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <PencilSimple size={16} weight="bold" />
                <span>{noticeToEdit ? 'Editar Aviso' : 'Criar Aviso'}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('listar');
                  setNoticeToEdit(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                  activeTab === 'listar'
                    ? 'bg-[#000638] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ListBullets size={16} weight="bold" />
                <span>Avisos Enviados</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Conteúdo das tabs */}
        <div className="animate-fade-in bg-white p-4 rounded-lg shadow-sm">
          {activeTab === 'criar' ? (
            <NoticeEditor
              noticeToEdit={noticeToEdit}
              onSuccess={handleSuccessCreate}
              onCancel={noticeToEdit ? handleCancelEdit : null}
            />
          ) : (
            <NoticesList onEdit={handleEditNotice} />
          )}
        </div>
      </div>
    </div>
  );
};

export default GerenciadorAvisos;
