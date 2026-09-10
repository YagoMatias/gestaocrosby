// RH / Admissão — Solicitação de documentos (pós-entrevista)
//
//  Pública (LP /admissao/documentos, sem auth):
//    POST /api/admissao/documentos            — recebe dados + documentos (multipart)
//
//  Admin (painel; protegidas pelo x-api-key global + PrivateRoute):
//    GET   /api/admissao/documentos           — lista os envios
//    GET   /api/admissao/documentos/:id        — um envio (com mapa de documentos)
//    GET   /api/admissao/documentos/:id/arquivo/:chave — signed URL de 1 documento
//    PATCH /api/admissao/documentos/:id        — atualiza status/observação
import express from 'express';
import multer from 'multer';
import path from 'path';
import supabase from '../config/supabase.js';
import {
  asyncHandler,
  successResponse,
  errorResponse,
} from '../utils/errorHandler.js';

const router = express.Router();

const BUCKET = 'documentos-admissao';

// Documentos aceitos (chave técnica + rótulo + obrigatório). Mesma lista usada
// no front. A ordem segue o formulário original do ClickUp.
export const DOCS = [
  { key: 'rg_frente', label: 'RG (Frente)', req: true },
  { key: 'rg_verso', label: 'RG (Verso)', req: true },
  { key: 'cpf', label: 'CPF', req: true },
  { key: 'titulo_eleitor', label: 'Título de Eleitor', req: true },
  { key: 'reservista', label: 'Reservista', req: false },
  { key: 'comprovante_residencia', label: 'Comprovante de Residência', req: true },
  { key: 'carteira_trabalho', label: 'Carteira de Trabalho', req: true },
  { key: 'certidao_nasc_casamento', label: 'Certidão de Nascimento ou Casamento', req: true },
  { key: 'certidao_nasc_dependentes', label: 'Certidão de Nascimento (Dependentes)', req: false },
  { key: 'cartao_vacina_dependentes', label: 'Cartão de Vacina (Dependentes)', req: false },
  { key: 'comprovante_escolaridade', label: 'Comprovante de Escolaridade', req: true },
];
const DOC_KEYS = new Set(DOCS.map((d) => d.key));

// Upload em memória; persiste no Supabase Storage. Imagens (fotos dos docs) e PDF.
const TIPOS_OK = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB por arquivo
  fileFilter: (req, file, cb) => {
    if (TIPOS_OK.has(file.mimetype)) return cb(null, true);
    cb(new Error('Formato inválido. Envie imagem (JPG/PNG) ou PDF.'));
  },
});
// Aceita 1 arquivo por documento
const uploadFields = upload.fields(DOCS.map((d) => ({ name: d.key, maxCount: 1 })));

// ─── Helpers ──────────────────────────────────────────────────────────
function clean(s, max = 255) {
  if (s == null) return null;
  return String(s).trim().slice(0, max) || null;
}
function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function slugify(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'candidato'
  );
}

// ══════════════════════════════════════════════════════════════════════
// PÚBLICO — envio dos documentos
// ══════════════════════════════════════════════════════════════════════
router.post(
  '/documentos',
  uploadFields,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const nome = clean(b.nome);
    if (!nome) return errorResponse(res, 'Informe o seu nome', 400);
    const email = clean(b.email_pessoal, 255)?.toLowerCase();
    if (email && !isEmail(email)) return errorResponse(res, 'E-mail inválido', 400);

    // Valida obrigatórios
    const files = req.files || {};
    const faltando = DOCS.filter((d) => d.req && !files[d.key]?.[0]).map((d) => d.label);
    if (faltando.length) {
      return errorResponse(
        res,
        `Documentos obrigatórios faltando: ${faltando.join(', ')}`,
        400,
        'DOCS_FALTANDO',
      );
    }

    // Sobe cada arquivo pro storage e monta o mapa jsonb
    const pasta = `${slugify(nome)}-${Date.now()}`;
    const documentos = {};
    const subidos = []; // pra rollback se o insert falhar
    for (const d of DOCS) {
      const f = files[d.key]?.[0];
      if (!f) continue;
      const ext = (path.extname(f.originalname) || '').toLowerCase();
      const storagePath = `${pasta}/${d.key}${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, f.buffer, { contentType: f.mimetype, upsert: false });
      if (upErr) {
        // rollback dos que já subiram
        if (subidos.length) await supabase.storage.from(BUCKET).remove(subidos).catch(() => {});
        console.error('[admissao/documentos] upload:', upErr.message);
        return errorResponse(res, 'Falha ao enviar um dos documentos', 500, 'UPLOAD_ERROR');
      }
      subidos.push(storagePath);
      documentos[d.key] = { path: storagePath, nome: clean(f.originalname, 255) };
    }

    const row = {
      nome,
      email_pessoal: email,
      contato_pessoal: clean(b.contato_pessoal, 30),
      contato_emergencia: clean(b.contato_emergencia, 255),
      pis: clean(b.pis, 30),
      documentos,
      origem: clean(b.origem) || 'lp_admissao',
      ip:
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        null,
      user_agent: clean(req.headers['user-agent'], 500),
      status: 'novo',
    };

    const { data, error } = await supabase
      .from('rh_documentos_admissao')
      .insert(row)
      .select('id')
      .single();
    if (error) {
      if (subidos.length) await supabase.storage.from(BUCKET).remove(subidos).catch(() => {});
      console.error('[admissao/documentos POST]', error.message);
      return errorResponse(res, 'Falha ao registrar os documentos', 500, 'DB_ERROR');
    }
    successResponse(res, { id: data.id }, 'Documentos enviados com sucesso', 201);
  }),
);

// ══════════════════════════════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════════════════════════════

// GET /api/admissao/documentos — lista (com contagem de docs anexados)
router.get(
  '/documentos',
  asyncHandler(async (req, res) => {
    const status = clean(req.query.status, 40);
    let q = supabase
      .from('rh_documentos_admissao')
      .select('*')
      .order('criado_em', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return errorResponse(res, error.message, 500, 'DB_ERROR');
    const out = (data || []).map((r) => ({
      ...r,
      total_documentos: r.documentos ? Object.keys(r.documentos).length : 0,
    }));
    successResponse(res, out, `${out.length} envios`);
  }),
);

// GET /api/admissao/documentos/:id — um envio
router.get(
  '/documentos/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return errorResponse(res, 'id inválido', 400);
    const { data, error } = await supabase
      .from('rh_documentos_admissao')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return errorResponse(res, error.message, 500, 'DB_ERROR');
    if (!data) return errorResponse(res, 'Envio não encontrado', 404);
    successResponse(res, data);
  }),
);

// GET /api/admissao/documentos/:id/arquivo/:chave — signed URL de 1 documento
router.get(
  '/documentos/:id/arquivo/:chave',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const chave = req.params.chave;
    if (!id) return errorResponse(res, 'id inválido', 400);
    if (!DOC_KEYS.has(chave)) return errorResponse(res, 'documento inválido', 400);
    const { data: row, error } = await supabase
      .from('rh_documentos_admissao')
      .select('documentos')
      .eq('id', id)
      .maybeSingle();
    if (error) return errorResponse(res, error.message, 500, 'DB_ERROR');
    const doc = row?.documentos?.[chave];
    if (!doc?.path) return errorResponse(res, 'Documento não anexado', 404);
    const { data: signed, error: e2 } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.path, 60 * 5);
    if (e2) return errorResponse(res, e2.message, 500);
    successResponse(res, { url: signed.signedUrl, nome: doc.nome });
  }),
);

// PATCH /api/admissao/documentos/:id — status/observação
router.patch(
  '/documentos/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return errorResponse(res, 'id inválido', 400);
    const patch = {};
    if ('status' in req.body) patch.status = clean(req.body.status, 40) || 'novo';
    if ('observacao' in req.body) patch.observacao = clean(req.body.observacao, 2000);
    if (Object.keys(patch).length === 0) return errorResponse(res, 'Nenhum campo válido', 400);
    const { data, error } = await supabase
      .from('rh_documentos_admissao')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) return errorResponse(res, error.message, 500, 'DB_ERROR');
    successResponse(res, data, 'Atualizado');
  }),
);

export default router;
