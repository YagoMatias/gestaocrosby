import React, { useState, useRef, useEffect } from 'react';

// Card no padrão visual do Headcoach
export function CardBox({ title, subtitle, actions, children, className = '' }) {
  return (
    <div
      className={`bg-white border border-[#000638]/10 rounded-xl shadow-sm ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
          <div>
            {title && (
              <h3 className="text-sm font-bold text-[#000638]">{title}</h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// Badge de status do lançamento
export function StatusBadge({ estag }) {
  const cfg =
    estag === 'Liquidado'
      ? 'bg-green-100 text-green-700'
      : estag === 'Liberado para pagamento'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-yellow-100 text-yellow-700';
  const label =
    estag === 'Liberado para pagamento'
      ? 'Liberado'
      : estag === 'Título não conferido'
        ? 'Pendente'
        : estag || '—';
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${cfg}`}
    >
      {label}
    </span>
  );
}

// Badge de status do marcador (Pendente / Em andamento / Concluído)
export const flagStatusClasses = (s) =>
  s === 'Concluído'
    ? 'bg-green-100 text-green-700 border-green-200'
    : s === 'Em andamento'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-yellow-100 text-yellow-700 border-yellow-200';

// Texto editável inline: clique → input; Enter/blur confirma, Esc cancela
export function EditableText({
  value,
  onCommit,
  className = '',
  inputClassName = '',
  textarea = false,
  placeholder = 'clique para editar…',
  title,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select && ref.current.select();
    }
  }, [editing]);

  const start = (e) => {
    e.stopPropagation();
    setDraft(value === undefined || value === null ? '' : String(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== String(value ?? '')) onCommit(draft);
  };

  if (editing) {
    const common = {
      ref,
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onBlur: commit,
      onClick: (e) => e.stopPropagation(),
      onKeyDown: (e) => {
        if (e.key === 'Enter' && !(textarea && e.shiftKey)) {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') setEditing(false);
      },
      className: `w-full border border-[#000638]/30 rounded px-1.5 py-0.5 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-1 focus:ring-[#000638] ${inputClassName}`,
    };
    return textarea ? (
      <textarea rows={2} {...common} />
    ) : (
      <input type="text" {...common} />
    );
  }

  const isEmpty = value === undefined || value === null || value === '';
  return (
    <span
      onClick={start}
      title={title || 'clique para editar'}
      className={`cursor-pointer hover:bg-blue-50 rounded px-0.5 transition ${className}`}
    >
      {isEmpty ? (
        <span className="text-gray-300 italic">{placeholder}</span>
      ) : (
        value
      )}
    </span>
  );
}

// Botãozinho padrão da barra de ações
export function ActionBtn({ onClick, children, title, variant = 'ghost' }) {
  const styles =
    variant === 'primary'
      ? 'bg-[#000638] text-white hover:bg-[#000638]/90'
      : variant === 'danger'
        ? 'text-red-600 border border-red-200 hover:bg-red-50'
        : 'text-[#000638] border border-[#000638]/20 hover:bg-gray-50';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${styles}`}
    >
      {children}
    </button>
  );
}
