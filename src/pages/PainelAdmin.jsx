import React, { useEffect, useState } from 'react';
import { Gear, UserGear } from '@phosphor-icons/react';
import { useAuth } from '../components/AuthContext';

const perfis = [
  { value: 'ADM', label: 'Administrador' },
  { value: 'DIRETOR', label: 'Diretor' },
  { value: 'FINANCEIRO', label: 'Financeiro' },
  { value: 'FRANQUIA', label: 'Franquia' },
];

export default function PainelAdmin() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ id: null, name: '', email: '', password: '', role: 'DIRETOR', active: true });
  const [editando, setEditando] = useState(false);

  // Só ADM pode acessar
  if (!user || user.role !== 'ADM') {
    return <div className="p-8 text-red-600 font-bold">Acesso restrito ao Administrador.</div>;
  }

  // Buscar usuários
  const fetchUsuarios = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await fetch('/users?role=ADM');
      if (!res.ok) throw new Error('Erro ao buscar usuários');
      const data = await res.json();
      setUsuarios(data);
    } catch (e) {
      setErro(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  // Handlers
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setErro('');
    try {
      const method = editando ? 'PUT' : 'POST';
      const url = editando ? `/users/${form.id}` : '/users';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, requesterRole: 'ADM' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erro ao salvar usuário');
      }
      setForm({ id: null, name: '', email: '', password: '', role: 'DIRETOR', active: true });
      setEditando(false);
      fetchUsuarios();
    } catch (e) {
      setErro(e.message);
    }
  };

  const handleEdit = usuario => {
    setForm({ ...usuario, password: '' });
    setEditando(true);
  };

  const handleDelete = async id => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;
    setErro('');
    try {
      const res = await fetch(`/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterRole: 'ADM' }),
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data.message || 'Erro ao excluir usuário');
      }
      fetchUsuarios();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center mb-6 gap-2">
        <UserGear size={32} className="text-blue-700" />
        <h1 className="text-2xl font-bold">Painel Admin</h1>
      </div>
      {erro && <div className="mb-4 text-red-600">{erro}</div>}
      <form onSubmit={handleSubmit} className="mb-8 bg-gray-50 p-4 rounded-lg shadow">
        <div className="flex gap-4 mb-2">
          <input name="name" value={form.name} onChange={handleChange} placeholder="Nome" className="border p-2 rounded w-full" required />
          <input name="email" value={form.email} onChange={handleChange} placeholder="E-mail" className="border p-2 rounded w-full" required type="email" />
        </div>
        <div className="flex gap-4 mb-2">
          <input name="password" value={form.password} onChange={handleChange} placeholder={editando ? 'Nova senha (opcional)' : 'Senha'} className="border p-2 rounded w-full" type="password" minLength={4} />
          <select name="role" value={form.role} onChange={handleChange} className="border p-2 rounded">
            {perfis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} /> Ativo
          </label>
        </div>
        <button className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800" type="submit">{editando ? 'Salvar' : 'Criar Usuário'}</button>
        {editando && <button type="button" className="ml-4 text-gray-600 underline" onClick={() => { setEditando(false); setForm({ id: null, name: '', email: '', password: '', role: 'DIRETOR', active: true }); }}>Cancelar</button>}
      </form>
      <h2 className="text-lg font-bold mb-2">Usuários cadastrados</h2>
      {loading ? <div>Carregando...</div> : (
        <table className="w-full border bg-white rounded shadow text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2">Nome</th>
              <th className="p-2">E-mail</th>
              <th className="p-2">Perfil</th>
              <th className="p-2">Ativo</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">{u.active ? 'Sim' : 'Não'}</td>
                <td className="p-2 flex gap-2">
                  <button className="text-blue-700 underline" onClick={() => handleEdit(u)}>Editar</button>
                  <button className="text-red-600 underline" onClick={() => handleDelete(u.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}