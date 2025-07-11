import express from 'express';
import axios from 'axios';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Mini banco de dados em memória
const users = [
  {
    id: 1,
    name: 'Administrador',
    email: 'admin',
    password: 'admin123', // Em produção, nunca armazene senhas em texto puro!
    role: 'ADM', // O ADM é o colaborador
    active: true,
  },
  {
    id: 2,
    name: 'Usuário Exemplo',
    email: 'user',
    password: 'user123',
    role: 'USER',
    active: true,
  },
];

const pool = new Pool({
  user: process.env.PGUSER || 'crosby_ro',
  host: process.env.PGHOST || 'dbexp.vcenter.com.br',
  database: process.env.PGDATABASE || 'crosby',
  password: process.env.PGPASSWORD || 'wKspo98IU2eswq',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 20187,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export { pool };

// Autenticação simples
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password && u.active);
  if (!user) {
    return res.status(401).json({ message: 'Credenciais inválidas ou usuário inativo.' });
  }
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// Listar todos os usuários (apenas ADM)
app.get('/users', (req, res) => {
  const { role } = req.query;
  if (role !== 'ADM') {
    return res.status(403).json({ message: 'Acesso restrito ao ADM.' });
  }
  res.json(users);
});

// Criar novo usuário (apenas ADM)
app.post('/users', (req, res) => {
  const { name, email, password, role, active, requesterRole } = req.body;
  if (requesterRole !== 'ADM') {
    return res.status(403).json({ message: 'Apenas o ADM pode criar usuários.' });
  }
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'E-mail já cadastrado.' });
  }
  const newUser = {
    id: users.length + 1,
    name,
    email,
    password,
    role: role || 'USER',
    active: active !== undefined ? active : true,
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Exemplo de uso do axios para consumir uma API externa (mock)
app.get('/external', async (req, res) => {
  try {
    const response = await axios.get('https://jsonplaceholder.typicode.com/todos/1');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar dados externos.' });
  }
});

// Extrato financeiro - GET com filtros e paginação
app.get('/extrato', async (req, res) => {
  try {
    const { cd_empresa, nr_ctapes, dt_movim_ini, dt_movim_fim } = req.query;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    let baseQuery = ` from fcc_extratbco fe where 1=1`;
    const params = [];
    let idx = 1;
    if (cd_empresa) {
      baseQuery += ` and fe.cd_empresa = $${idx++}`;
      params.push(cd_empresa);
    }
    if (nr_ctapes) {
      if (Array.isArray(nr_ctapes) && nr_ctapes.length > 0) {
        const nr_ctapes_num = nr_ctapes.map(Number);
        baseQuery += ` and fe.nr_ctapes IN (${nr_ctapes_num.map(() => `$${idx++}`).join(',')})`;
        params.push(...nr_ctapes_num);
      } else {
        baseQuery += ` and fe.nr_ctapes = $${idx++}`;
        params.push(Number(nr_ctapes));
      }
    }
    if (dt_movim_ini && dt_movim_fim) {
      baseQuery += ` and fe.dt_lancto between $${idx++} and $${idx++}`;
      params.push(dt_movim_ini, dt_movim_fim);
    }
    // Query para total
    const totalQuery = `select count(*) as total ${baseQuery}`;
    const totalResult = await pool.query(totalQuery, params);
    const total = parseInt(totalResult.rows[0].total, 10);
    // Query para dados paginados
    const dataQuery = `
      select fe.nr_ctapes, fe.dt_lancto, fe.ds_histbco, fe.tp_operbco, fe.vl_lancto, fe.dt_conciliacao
      ${baseQuery}
      order by fe.dt_lancto desc
      limit $${idx++} offset $${idx++}
    `;
    const dataParams = [...params, limit, offset];
    const { rows } = await pool.query(dataQuery, dataParams);
    res.json({ total, rows });
  } catch (error) {
    console.error('Erro ao buscar extrato:', error);
    res.status(500).json({ message: 'Erro ao buscar extrato financeiro.' });
  }
});

// Rota para buscar dados da view vw_detalhe_pedido_completo para expedição
app.get('/expedicao', async (req, res) => {
  try {
    const query = `SELECT * FROM vw_detalhe_pedido_completo WHERE cd_empresa = 850 and cd_tabpreco IN(21,22)`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de expedição:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de expedição.' });
  }
});

// Rota para buscar dados da view vw_detalhe_pedido_completo para PCP
app.get('/pcp', async (req, res) => {
  try {
    const query = `SELECT * FROM vw_detalhe_pedido_completo WHERE cd_empresa = 111`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de PCP:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de PCP.' });
  }
});

// Rota para buscar empresas
app.get('/empresas', async (req, res) => {
  try {
    const query = `SELECT cd_grupoempresa, nm_grupoempresa FROM vr_ger_empresa where cd_grupoempresa > 5999 AND cd_empresa % 2 = 0 order by cd_grupoempresa asc`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    res.status(500).json({ message: 'Erro ao buscar empresas.' });
  }
});

// Rota para buscar dados da tabela fcc_mov (extratototvs)
app.get('/extratototvs', async (req, res) => {
  try {
    const { cd_empresa, nr_ctapes, dt_movim_ini, dt_movim_fim, ds_doc, dt_liq, limit, offset } = req.query;
    let baseQuery = 'FROM fcc_mov fm WHERE 1=1';
    const params = [];
    let idx = 1;
    if (cd_empresa) {
      baseQuery += ` AND fm.cd_empresa = $${idx++}`;
      params.push(cd_empresa);
    }
    if (nr_ctapes) {
      baseQuery += ` AND fm.nr_ctapes = $${idx++}`;
      params.push(nr_ctapes);
    }
    if (dt_movim_ini && dt_movim_fim) {
      baseQuery += ` AND fm.dt_movim BETWEEN $${idx++} AND $${idx++}`;
      params.push(dt_movim_ini, dt_movim_fim);
    }
    if (ds_doc) {
      baseQuery += ` AND fm.ds_doc ILIKE $${idx++}`;
      params.push(`%${ds_doc}%`);
    }
    if (dt_liq) {
      baseQuery += ` AND fm.dt_liq = $${idx++}`;
      params.push(dt_liq);
    }
    const selectFields = 'fm.cd_empresa, fm.nr_ctapes, fm.dt_movim, fm.ds_doc, fm.dt_liq, fm.in_estorno, fm.tp_operacao, fm.ds_aux, fm.vl_lancto';
    let dataQuery = `SELECT ${selectFields} ${baseQuery} ORDER BY fm.dt_movim DESC`;
    let dataParams = [...params];
    if (limit && offset) {
      dataQuery += ` LIMIT $${idx++} OFFSET $${idx++}`;
      dataParams.push(parseInt(limit, 10), parseInt(offset, 10));
    }
    // Debug: logar query e parâmetros
    console.log('extratototvs SQL:', dataQuery);
    console.log('extratototvs params:', dataParams);
    const { rows } = await pool.query(dataQuery, dataParams);
    if (limit && offset) {
      const totalQuery = `SELECT count(*) as total ${baseQuery}`;
      const totalResult = await pool.query(totalQuery, params);
      const total = parseInt(totalResult.rows[0].total, 10);
      res.json({ total, rows });
    } else {
      res.json(rows);
    }
  } catch (error) {
    console.error('Erro ao buscar dados do extratototvs:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do extratototvs.' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend rodando em ${PORT}`);
}); 