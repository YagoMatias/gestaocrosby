import express from 'express';
import axios from 'axios';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors({ origin: '*' }));
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
    name: 'Diretor Exemplo',
    email: 'diretor',
    password: 'diretor123',
    role: 'DIRETOR',
    active: true,
  },
  {
    id: 3,
    name: 'Financeiro Exemplo',
    email: 'financeiro',
    password: 'fin123',
    role: 'FINANCEIRO',
    active: true,
  },
  {
    id: 4,
    name: 'Franquia Exemplo',
    email: 'franquia',
    password: 'fran123',
    role: 'FRANQUIA',
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
  const validRoles = ['ADM', 'DIRETOR', 'FINANCEIRO', 'FRANQUIA'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Perfil de usuário inválido. Perfis permitidos: ADM, DIRETOR, FINANCEIRO, FRANQUIA.' });
  }
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'E-mail já cadastrado.' });
  }
  const newUser = {
    id: users.length + 1,
    name,
    email,
    password,
    role,
    active: active !== undefined ? active : true,
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Editar usuário (apenas ADM)
app.put('/users/:id', (req, res) => {
  const { requesterRole } = req.body;
  if (requesterRole !== 'ADM') {
    return res.status(403).json({ message: 'Apenas o ADM pode editar usuários.' });
  }
  const id = parseInt(req.params.id, 10);
  const user = users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }
  // Não permitir que o ADM edite a si mesmo para não se auto-excluir
  if (user.role === 'ADM' && user.email === 'admin') {
    return res.status(403).json({ message: 'Não é permitido editar o usuário ADM principal.' });
  }
  const { name, email, password, role, active } = req.body;
  const validRoles = ['ADM', 'DIRETOR', 'FINANCEIRO', 'FRANQUIA'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ message: 'Perfil de usuário inválido. Perfis permitidos: ADM, DIRETOR, FINANCEIRO, FRANQUIA.' });
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (password !== undefined) user.password = password;
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = active;
  res.json(user);
});

// Excluir usuário (apenas ADM)
app.delete('/users/:id', (req, res) => {
  const { requesterRole } = req.body;
  if (requesterRole !== 'ADM') {
    return res.status(403).json({ message: 'Apenas o ADM pode excluir usuários.' });
  }
  const id = parseInt(req.params.id, 10);
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }
  // Não permitir que o ADM exclua a si mesmo
  if (users[userIndex].role === 'ADM' && users[userIndex].email === 'admin') {
    return res.status(403).json({ message: 'Não é permitido excluir o usuário ADM principal.' });
  }
  users.splice(userIndex, 1);
  res.status(204).send();
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
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const query = `SELECT * FROM vw_detalhe_pedido_completo WHERE cd_empresa = 111 LIMIT $1 OFFSET $2`;
    const { rows } = await pool.query(query, [limit, offset]);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de PCP:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de PCP.' });
  }
});

// Rota para buscar empresas
app.get('/empresas', async (req, res) => {
  try {
    const query = `SELECT cd_empresa, nm_grupoempresa FROM vr_ger_empresa where cd_grupoempresa < 5999 order by cd_grupoempresa asc`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    res.status(500).json({ message: 'Erro ao buscar empresas.' });
  }
});

// Rota para buscar empresas
app.get('/grupoempresas', async (req, res) => {
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
    const { nr_ctapes, dt_movim_ini, dt_movim_fim } = req.query;
    const limit = parseInt(req.query.limit, 10) || 5000;
    const offset = parseInt(req.query.offset, 10) || 0;
    let baseQuery = ' from fcc_mov fm where 1=1';
    const params = [];
    let idx = 1;
    if (nr_ctapes) {
      let contas = nr_ctapes;
      if (!Array.isArray(contas)) {
        // Se vier como string separada por vírgula
        contas = typeof contas === 'string' && contas.includes(',') ? contas.split(',') : [contas];
      }
      if (contas.length > 1) {
        baseQuery += ` and fm.nr_ctapes IN (${contas.map(() => `$${idx++}`).join(',')})`;
        params.push(...contas);
      } else {
        baseQuery += ` and fm.nr_ctapes = $${idx++}`;
        params.push(contas[0]);
      }
    }
    if (dt_movim_ini && dt_movim_fim) {
      baseQuery += ` and fm.dt_movim between $${idx++} and $${idx++}`;
      params.push(dt_movim_ini, dt_movim_fim);
    }
    // Adiciona filtro para in_estorno = 'T'
    baseQuery += ` and fm.in_estorno = 'F'`;
    const dataQuery = `
      select fm.cd_empresa, fm.nr_ctapes, fm.dt_movim, fm.ds_doc, fm.dt_liq, fm.in_estorno, fm.tp_operacao, fm.ds_aux, fm.vl_lancto
      ${baseQuery}
      order by fm.dt_movim desc
      limit $${idx++} offset $${idx++}
    `;
    const dataParams = [...params, limit, offset];
    const { rows } = await pool.query(dataQuery, dataParams);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados do extratototvs:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do extratototvs.' });
  }
});

// Rota para buscar dados de faturamento
app.get('/faturamento', async (req, res) => {
  try {
    const { dt_inicio, dt_fim, cd_empresa } = req.query;
    const dataInicio = dt_inicio || '2025-07-01';
    const dataFim = dt_fim || '2025-07-15';
    let grupos = cd_empresa;
    if (!grupos) {
      return res.json([]);
    }
    if (!Array.isArray(grupos)) grupos = [grupos];
    let params = [dataInicio, dataFim];
    let grupoPlaceholders = grupos.map((_, idx) => `$${params.length + idx + 1}`).join(',');
    params = [...params, ...grupos];
    const query = `
      select
        vfn.cd_empresa,
        vfn.nm_grupoempresa,
        vfn.cd_operacao,
        vfn.cd_nivel,
        vfn.ds_nivel,
        vfn.dt_transacao,
        vfn.tp_situacao,
        vfn.vl_unitliquido,
        vfn.vl_unitbruto,
        vfn.tp_operacao,
        vfn.nr_transacao,
        vfn.qt_faturado
      from
        vr_fis_nfitemprod vfn
      where
        vfn.dt_transacao between $1 and $2
        and vfn.cd_empresa IN (${grupoPlaceholders})
                and vfn.cd_operacao not in (5914,1407,5102,590,5153,660,520,300,200,1152, 9200, 2008, 536, 1153, 599, 5920, 5930, 1711, 7111, 2009, 5152, 6029, 530, 5152, 5930, 650, 
        5010, 600, 620, 40, 1557, 8600, 5910, 3336, 9003, 9052, 662, 5909,5153,5910,3336,9003,530,36,536,1552,51,1556,200,300,512,1402,1405,1409,5102,5110,200,300,
        512,5102,5110,5113,17,21,401,1201,1202,1204,1206,1950,1999,2203,17,21,1201,1202,1204,1950,1999,2203,
        2500,1126,1127,8160,1122,1102,9986,1128,1553,1556,9200,8002,2551,1557,8160,2004,
        5912,1410
)
        and vfn.tp_situacao not in ('C', 'X')
    `;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de faturamento:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de faturamento.' });
  }
});

// Rota para buscar dados de faturamento franquia (com SQL customizado)
app.get('/faturamentofranquia', async (req, res) => {
  try {
    const { dt_inicio, dt_fim, cd_empresa, nm_fantasia } = req.query;
    const dataInicio = dt_inicio || '2025-07-01';
    const dataFim = dt_fim || '2025-07-15';
    let empresas = cd_empresa;
    if (!empresas) {
      return res.json([]);
    }
    if (!Array.isArray(empresas)) empresas = [empresas];
    let params = [dataInicio, dataFim];
    let empresaPlaceholders = empresas.map((_, idx) => `$${params.length + idx + 1}`).join(',');
    params = [...params, ...empresas];
    let fantasiaWhere = '';
    if (nm_fantasia) {
      fantasiaWhere = 'and p.nm_fantasia = $' + (params.length + 1);
      params.push(nm_fantasia);
    } else {
      fantasiaWhere = `and p.nm_fantasia like 'F%CROSBY%'`;
    }
    const query = `
      select
        vfn.cd_empresa,
        vfn.nm_grupoempresa,
        p.nm_fantasia,
        vfn.cd_operacao,
        vfn.cd_nivel,
        vfn.ds_nivel,
        vfn.dt_transacao,
        vfn.tp_situacao,
        vfn.vl_unitliquido,
        vfn.vl_unitbruto,
        vfn.tp_operacao,
        vfn.nr_transacao,
        vfn.qt_faturado
      from
        vr_fis_nfitemprod vfn
      left join pes_pesjuridica p on p.cd_pessoa = vfn.cd_pessoa   
      where
        vfn.dt_transacao between $1 and $2
        and vfn.cd_empresa IN (${empresaPlaceholders})
                and vfn.cd_operacao not in (1152,590,5153,660, 9200, 2008, 536, 1153, 599, 5920, 5930, 1711, 7111, 2009, 5152, 6029, 530, 5152, 5930, 650, 
        5010, 600, 620, 40, 1557, 8600, 5910, 3336, 9003, 9052, 662, 5909,5153,5910,3336,9003,530,36,536,1552,51,1556,
        2500,1126,1127,8160,1122,1102,9986,1128,1553,1556,9200,8002,2551,1557,8160,2004,
        5912,1410)
        and vfn.tp_situacao not in ('C', 'X')
        ${fantasiaWhere}
    `;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de faturamento franquia:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de faturamento franquia.' });
  }
});

// Rota para buscar dados do fundo de propaganda
app.get('/consultafatura', async (req, res) => {
  try {
    let { cd_empresa, cd_cliente, dt_inicio, dt_fim, nm_fantasia } = req.query;
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    // Filtro múltiplo para nome fantasia
    if (nm_fantasia) {
      let nomes = nm_fantasia;
      if (!Array.isArray(nomes)) nomes = [nomes];
      whereConditions.push(`pp.nm_fantasia IN (${nomes.map(() => `$${paramIndex++}`).join(',')})`);
      params.push(...nomes);
    } else {
      whereConditions.push("pp.nm_fantasia like 'F%CROSBY%'");
    }
    
    // Filtro por empresa
    if (cd_empresa) {
      whereConditions.push(`vff.cd_empresa = $${paramIndex++}`);
      params.push(cd_empresa);
    }
    
    // Filtro por cliente
    if (cd_cliente) {
      whereConditions.push(`vff.cd_cliente = $${paramIndex++}`);
      params.push(cd_cliente);
    }
    
    // Filtro por data
    if (dt_inicio && dt_fim) {
      whereConditions.push(`vff.dt_emissao between $${paramIndex++} and $${paramIndex++}`);
      params.push(dt_inicio, dt_fim);
    } else {
      // Data padrão se não fornecida
      whereConditions.push(`vff.dt_emissao between $${paramIndex++} and $${paramIndex++}`);
      params.push('2025-05-01', '2025-05-12');
    }
    
    const whereClause = whereConditions.join(' and ');
    
    const query = `
      select
        vff.cd_empresa,
        vff.cd_cliente,
        vff.nm_cliente,
        pp.nm_fantasia,
        vff.nr_fat,
        vff.dt_emissao,
        vff.tp_documento,
        vff.tp_faturamento,
        vff.tp_situacao,
        vff.vl_fatura,
        vff.vl_pago
      from
        vr_fcr_faturai vff
      left join pes_pesjuridica pp on
        pp.cd_pessoa = vff.cd_cliente
      where
        ${whereClause}
      group by
        vff.cd_empresa,
        vff.cd_cliente,
        vff.nm_cliente,
        pp.nm_fantasia,
        vff.nr_fat,
        vff.nr_parcela,
        vff.nr_documento,
        vff.dt_emissao,
        vff.tp_documento,
        vff.tp_faturamento,
        vff.tp_situacao,
        vff.vl_fatura,
        vff.vl_pago
    `;
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados do fundo de propaganda:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do fundo de propaganda.' });
  }
});

// Autocomplete para nome fantasia
app.get('/autocomplete/nm_fantasia', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json([]);
    }
    const query = `
      select distinct nm_fantasia
      from pes_pesjuridica
      where nm_fantasia ILIKE 'F%CROSBY%' and nm_fantasia ILIKE $1
      order by nm_fantasia asc
      limit 100
    `;
    const { rows } = await pool.query(query, ['%'+q+'%']);
    res.json(rows.map(r => r.nm_fantasia));
  } catch (error) {
    console.error('Erro no autocomplete de nm_fantasia:', error);
    res.status(500).json({ message: 'Erro ao buscar nomes fantasia.' });
  }
});

// Autocomplete para grupo empresa
app.get('/autocomplete/nm_grupoempresa', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json([]);
    }
    const query = `
      select distinct cd_empresa, nm_grupoempresa
      from vr_ger_empresa
      where nm_grupoempresa ILIKE $1 and cd_grupoempresa < 5999
      order by nm_grupoempresa asc
      limit 100
    `;
    const { rows } = await pool.query(query, ['%'+q+'%']);
    res.json(rows);
  } catch (error) {
    console.error('Erro no autocomplete de nm_grupoempresa:', error);
    res.status(500).json({ message: 'Erro ao buscar nomes de grupo empresa.' });
  }
});

// Rota para faturamento franquia
app.get('/fundopropaganda', async (req, res) => {
  try {
    let { cd_empresa, dt_inicio, dt_fim, nm_fantasia } = req.query;
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Filtro múltiplo para nome fantasia
    if (nm_fantasia) {
      let nomes = nm_fantasia;
      if (!Array.isArray(nomes)) nomes = [nomes];
      whereConditions.push(`p.nm_fantasia IN (${nomes.map(() => `$${paramIndex++}`).join(',')})`);
      params.push(...nomes);
    } else {
      whereConditions.push("p.nm_fantasia like 'F%CROSBY%'");
    }

    // Filtro por empresa
    if (cd_empresa) {
      whereConditions.push(`vfn.cd_empresa = $${paramIndex++}`);
      params.push(cd_empresa);
    }

    // Filtro por data
    if (dt_inicio && dt_fim) {
      whereConditions.push(`vfn.dt_transacao between $${paramIndex++} and $${paramIndex++}`);
      params.push(dt_inicio, dt_fim);
    } else {
      whereConditions.push(`vfn.dt_transacao between '2025-07-01' and '2025-07-15'`);
    }

    // Filtros fixos
        whereConditions.push(`vfn.cd_operacao not in (1152,590,5153,660, 9200, 2008, 536, 1153, 599, 5920, 5930, 1711, 7111, 2009, 5152, 6029, 530, 5152, 5930, 650, 
        5010, 600, 620, 40, 1557, 8600, 5910, 3336, 9003, 9052, 662, 5909,5153,5910,3336,9003,530,36,536,1552,51,1556,
        2500,1126,1127,8160,1122,1102,9986,1128,1553,1556,9200,8002,2551,1557,8160,2004,
        5912,1410)`);
    whereConditions.push(`vfn.tp_situacao = 4`);
    whereConditions.push(`vfn.cd_grupoempresa < 5999`);
    whereConditions.push(`(f.tp_documento IS NULL OR f.tp_documento <> 20)`);
    whereConditions.push(`vfn.tp_operacao = 'S'`);

    const whereClause = whereConditions.join(' and ');

    const query = `
      select
        vfn.cd_empresa,
        f.cd_cliente,
        p.nm_fantasia,
        vfn.cd_operacao,
        vfn.tp_situacao,
        vfn.tp_operacao,
        vfn.vl_total,
        vfn.nr_transacao
      from
        tra_transacao vfn
      left join pes_pesjuridica p on
        p.cd_pessoa = vfn.cd_pessoa
      left join fcr_faturai f on
        f.cd_cliente = vfn.cd_pessoa
      where
        ${whereClause}
      group by
        vfn.cd_empresa,
        f.cd_cliente,
        p.nm_fantasia,
        vfn.cd_operacao,
        vfn.dt_transacao,
        vfn.tp_situacao,
        vfn.tp_operacao,
        vfn.vl_total,
        vfn.nr_transacao
      order by
        nm_fantasia
    `;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de faturamento franquia:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de faturamento franquia.' });
  }
});

// Rota para franquias credev
app.get('/franquiascredev', async (req, res) => {
  try {
    const { dt_inicio, dt_fim } = req.query;
    let where = [];
    let params = [];
    let idx = 1;

    if (dt_inicio && dt_fim) {
      where.push(`f.dt_emissao between $${idx++} and $${idx++}`);
      params.push(dt_inicio, dt_fim);
    } else {
      // Intervalo padrão se não informado
      where.push(`f.dt_emissao between '2025-06-10' and '2025-06-10'`);
    }

    where.push(`p.nm_fantasia like 'F%CROSBY%'`);
    where.push(`f.tp_documento = 20`);

    const query = `
      select
        f.cd_cliente,
        p.nm_fantasia,
        f.vl_pago,
        f.dt_emissao as dt_fatura,
        f.tp_documento
      from
        fcr_faturai f
      left join pes_pesjuridica p on
        p.cd_pessoa = f.cd_cliente
      where
        ${where.join(' and ')}
    `;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de franquias credev:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de franquias credev.' });
  }
});

// Rota para buscar dados de faturamento MTM
app.get('/faturamentomtm', async (req, res) => {
  try {
    const { dt_inicio, dt_fim, cd_empresa } = req.query;
    const dataInicio = dt_inicio || '2025-07-01';
    const dataFim = dt_fim || '2025-07-15';
    let empresas = cd_empresa;
    if (!empresas) {
      return res.json([]);
    }
    if (!Array.isArray(empresas)) empresas = [empresas];
    let params = [dataInicio, dataFim];
    let empresaPlaceholders = empresas.map((_, idx) => `$${params.length + idx + 1}`).join(',');
    params = [...params, ...empresas];
    const query = `
      select
        vfn.cd_empresa,
        vfn.nm_grupoempresa,
        p.cd_pessoa,
        p.nm_pessoa,
        pc.cd_classificacao,
        vfn.cd_operacao,
        vfn.tp_operacao,
        vfn.cd_nivel,
        vfn.ds_nivel,
        vfn.dt_transacao,
        vfn.vl_unitliquido,
        vfn.vl_unitbruto,
        vfn.nr_transacao,
        vfn.qt_faturado
      from
        vr_fis_nfitemprod vfn
      left join pes_pessoa p on p.cd_pessoa = vfn.cd_pessoa
      left join public.vr_pes_pessoaclas pc on vfn.cd_pessoa = pc.cd_pessoa
      where
        vfn.dt_transacao between $1 and $2
        and vfn.cd_empresa IN (${empresaPlaceholders})
        and vfn.cd_operacao not in (1152, 9200, 2008,590,5153,660, 536, 1153, 599, 5920, 5930, 1711, 7111, 2009, 5152, 6029, 530, 5152, 5930, 650, 5010, 600, 620, 40, 1557, 8600, 5910, 3336, 9003, 9052, 662, 5909,5153,5910,3336,9003,530,36,536,1552,51,1556,
        2500,1126,1127,8160,1122,1102,9986,1128,1553,1556,9200,8002,2551,1557,8160,2004,
        5912,1410)
        and vfn.tp_situacao not in ('C', 'X')
        and pc.cd_tipoclas in (5)
    `;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de faturamento MTM:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de faturamento MTM.' });
  }
});

app.get('/faturamentorevenda', async (req, res) => {
  try {
    const { dt_inicio, dt_fim, cd_empresa } = req.query;
    const dataInicio = dt_inicio || '2025-06-01';
    const dataFim = dt_fim || '2025-07-15';
    let empresas = cd_empresa;
    if (!empresas) {
      return res.json([]);
    }
    if (!Array.isArray(empresas)) empresas = [empresas];
    let params = [dataInicio, dataFim];
    let empresaPlaceholders = empresas.map((_, idx) => `$${params.length + idx + 1}`).join(',');
    params = [...params, ...empresas];
    const query = `
      select
        vfn.cd_grupoempresa,
        vfn.nm_grupoempresa,
        p.cd_pessoa,
        p.nm_pessoa,
        pc.cd_tipoclas,
        pc.cd_classificacao,
        vfn.cd_operacao,
        vfn.cd_nivel,
        vfn.ds_nivel,
        vfn.dt_transacao,
        vfn.tp_situacao,
        vfn.vl_unitliquido,
        vfn.vl_unitbruto,
        vfn.tp_operacao,
        vfn.nr_transacao,
        vfn.qt_faturado
      from
        vr_fis_nfitemprod vfn
      left join pes_pessoa p on
        p.cd_pessoa = vfn.cd_pessoa
        left join public.vr_pes_pessoaclas pc on
	    vfn.cd_pessoa = pc.cd_pessoa
      where
        vfn.dt_transacao between $1 and $2
        and vfn.cd_empresa IN (${empresaPlaceholders})
      	        	and vfn.cd_operacao not in (522, 9001, 9009, 9027, 9017, 002, 001, 548, 555, 521, 599, 1152, 9200, 2008, 536, 1153, 599, 5920, 5930, 1711, 7111, 2009, 5152, 6029, 530, 5152, 5930, 650, 
         5010, 600, 620, 40, 1557,2505, 8600,590,5153,660, 5910, 3336, 9003, 9052, 662, 5909, 5153, 5910, 3336, 9003, 530, 36, 536, 1552, 51, 1556,
         2500,1126,1127,8160,1122,1102,9986,1128,1553,1556,9200,8002,2551,1557,8160,2004,
         5912,1410)
	      and pc.cd_tipoclas = 20
	      and vfn.tp_situacao not in ('C', 'X')`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de faturamento revenda:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de faturamento revenda.' });
  }
});

app.get('/faturamentolojas', async (req, res) => {
  try {
    // Aceita tanto dt_inicio/dt_fim quanto inicio/fim
    let { cd_grupoempresa_ini, cd_grupoempresa_fim, dt_inicio, dt_fim, inicio, fim } = req.query;
    dt_inicio = dt_inicio || inicio;
    dt_fim = dt_fim || fim;
    if (!cd_grupoempresa_ini || !cd_grupoempresa_fim || !dt_inicio || !dt_fim) {
      return res.status(400).json({ message: 'Parâmetros obrigatórios: cd_grupoempresa_ini, cd_grupoempresa_fim, dt_inicio (ou inicio), dt_fim (ou fim).' });
    }
    const params = [cd_grupoempresa_ini, cd_grupoempresa_fim, dt_inicio, dt_fim];
    const query = `
      SELECT
          A.CD_GRUPOEMPRESA,
          A.CD_PESSOA AS PESSOA_EMPRESA,
          B.CD_PESSOA AS PESSOA_JURIDICA,
          B.NM_FANTASIA AS NOME_FANTASIA,
          SUM(
            CASE
              WHEN T.TP_OPERACAO = 'E' AND T.TP_SITUACAO = 4 THEN T.QT_SOLICITADA
              ELSE 0
            END
          ) AS PAENTRADA,
          SUM(
            CASE
              WHEN T.TP_OPERACAO = 'S' AND T.TP_SITUACAO = 4 THEN T.QT_SOLICITADA
              ELSE 0
            END
          ) AS PASAIDA,
          COUNT(*) FILTER(WHERE T.TP_SITUACAO = 4 AND T.TP_OPERACAO = 'S') AS TRASAIDA,
          COUNT(*) FILTER(WHERE T.TP_SITUACAO = 4 AND T.TP_OPERACAO = 'E') AS TRAENTRADA,
          (
            SUM(
              CASE
                WHEN T.TP_SITUACAO = 4 AND T.TP_OPERACAO = 'S' THEN T.VL_TOTAL
                WHEN T.TP_SITUACAO = 4 AND T.TP_OPERACAO = 'E' THEN -T.VL_TOTAL
                ELSE 0
              END
            )
            -
            SUM(
              CASE
                WHEN T.TP_SITUACAO = 4 AND T.TP_OPERACAO IN ('S', 'E') THEN COALESCE(T.VL_FRETE, 0)
                ELSE 0
              END
            )
          ) AS FATURAMENTO
      FROM
          GER_EMPRESA A
      JOIN
          PES_PESJURIDICA B ON A.CD_PESSOA = B.CD_PESSOA
      LEFT JOIN
          TRA_TRANSACAO T ON T.CD_GRUPOEMPRESA = A.CD_GRUPOEMPRESA
      WHERE 
          B.CD_PESSOA NOT IN (69994,70596,110000001,73469,61000007,61000008,61000009,61000010,45832)
          AND B.CD_PESSOA < 110000100
          AND T.VL_TOTAL > 1
          AND (
              T.TP_SITUACAO IS NULL OR (
                  T.TP_SITUACAO = 4
                  AND T.TP_OPERACAO IN ('S', 'E')
                                     AND T.CD_OPERACAO not in (5914,1407,5102,520,300,200,1152, 9200, 2008, 536, 1153, 599, 5920, 5930, 1711, 7111, 2009, 5152, 6029, 530, 5152, 5930, 650, 
       5010, 600, 620, 40, 1557, 8600, 5910, 3336, 9003, 9052, 662, 5909,5153,5910,3336,9003,530,36,536,1552,51,1556,200,300,512,1402,1405,1409,5102,5110,200,300,
       512,5102,5110,5113,17,21,401,1201,1202,1204,1206,1950,1999,2203,17,21,1201,1202,1204,1950,1999,2203,590,5153,660,
       2500,1126,1127,8160,1122,1102,9986,1128,1553,1556,9200,8002,2551,1557,8160,2004,
       5912,1410)
                  AND T.CD_GRUPOEMPRESA BETWEEN $1 AND $2
                  AND T.DT_TRANSACAO BETWEEN $3::timestamp AND $4::timestamp
              )
          )
      GROUP BY
          A.CD_GRUPOEMPRESA,
          A.CD_PESSOA,
          B.CD_PESSOA,
          B.NM_FANTASIA
      ORDER BY
          FATURAMENTO DESC,
          B.NM_FANTASIA
    `;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar dados de faturamento lojas:', error);
    res.status(500).json({ message: 'Erro ao buscar dados de faturamento lojas.' });
  }
});

// Rota para ranking de vendedores
app.get('/rankingvendedor', async (req, res) => {
  try {
    const { inicio, fim, limit, offset } = req.query;
    
    // Validação dos parâmetros obrigatórios
    if (!inicio || !fim) {
      return res.status(400).json({ 
        message: 'Parâmetros obrigatórios: inicio e fim (formato: YYYY-MM-DD)' 
      });
    }

    // Configuração de paginação
    const limitValue = parseInt(limit, 300 ) || 500;
    const offsetValue = parseInt(offset, 300) || 0;
    
    // Formatação das datas
    const dataInicio = `${inicio} 00:00:00`;
    const dataFim = `${fim} 23:59:59`;

    // Query principal com paginação
    const query = `
      SELECT
        A.CD_VENDEDOR AS VENDEDOR,
        A.NM_VENDEDOR AS NOME_VENDEDOR,
        B.CD_COMPVEND,
        SUM(
          CASE
            WHEN B.TP_OPERACAO = 'E' AND B.TP_SITUACAO = 4 THEN B.QT_SOLICITADA
            ELSE 0
          END
        ) AS PAENTRADA,
        SUM(
          CASE
            WHEN B.TP_OPERACAO = 'S' AND B.TP_SITUACAO = 4 THEN B.QT_SOLICITADA
            ELSE 0
          END
        ) AS PASAIDA,
        COUNT(*) FILTER (WHERE B.TP_SITUACAO = 4 AND B.TP_OPERACAO = 'S') AS TRASAIDA,
        COUNT(*) FILTER (WHERE B.TP_SITUACAO = 4 AND B.TP_OPERACAO = 'E') AS TRAENTRADA,
        (
          SUM(
            CASE
              WHEN B.TP_SITUACAO = 4 AND B.TP_OPERACAO = 'S' THEN B.VL_TOTAL
              WHEN B.TP_SITUACAO = 4 AND B.TP_OPERACAO = 'E' THEN -B.VL_TOTAL
              ELSE 0
            END
          )
          -
          SUM(
            CASE
              WHEN B.TP_SITUACAO = 4 AND B.TP_OPERACAO IN ('S', 'E') THEN COALESCE(B.VL_FRETE, 0)
              ELSE 0
            END
          )
        ) AS FATURAMENTO
      FROM PES_VENDEDOR A
      JOIN TRA_TRANSACAO B ON A.CD_VENDEDOR = B.CD_COMPVEND
      WHERE B.TP_SITUACAO = 4
        AND B.TP_OPERACAO IN ('S', 'E')
                 AND B.CD_OPERACAO not in (5914,1407,5102,520,300,200,1152, 9200, 2008, 536, 1153, 599, 5920, 5930, 1711, 7111, 2009, 5152, 6029, 530, 5152, 5930, 650, 
       5010, 600, 620, 40, 1557, 8600, 5910, 3336, 9003, 9052, 662, 5909,5153,5910,3336,9003,530,36,536,1552,51,1556,200,300,512,1402,1405,1409,5102,5110,200,300,
       512,5102,5110,5113,17,21,401,1201,1202,1204,1206,1950,1999,2203,17,21,1201,1202,1204,1950,1999,2203,590,5153,660,
       2500,1126,1127,8160,1122,1102,9986,1128,1553,1556,9200,8002,2551,1557,8160,2004,
       5912,1410)
        AND B.DT_TRANSACAO BETWEEN $1::timestamp AND $2::timestamp
      GROUP BY A.CD_VENDEDOR, A.NM_VENDEDOR, B.CD_COMPVEND
      ORDER BY FATURAMENTO DESC
      LIMIT $3 OFFSET $4
    `;

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(DISTINCT A.CD_VENDEDOR) as total
      FROM PES_VENDEDOR A
      JOIN TRA_TRANSACAO B ON A.CD_VENDEDOR = B.CD_COMPVEND
      WHERE B.TP_SITUACAO = 4
        AND B.TP_OPERACAO IN ('S', 'E')
                 AND B.CD_OPERACAO not in (5914,1407,5102,520,300,200,1152, 9200, 2008, 536, 1153, 599, 5920, 5930, 1711, 7111, 2009, 5152, 6029, 530, 5152, 5930, 650, 
       5010, 600, 620, 40, 1557, 8600, 5910, 3336, 9003, 9052, 662, 5909,5153,5910,3336,9003,530,36,536,1552,51,1556,200,300,512,1402,1405,1409,5102,5110,200,300,
       512,5102,5110,5113,17,21,401,1201,1202,1204,1206,1950,1999,2203,17,21,1201,1202,1204,1950,1999,2203,590,5153,660,
       2500,1126,1127,8160,1122,1102,9986,1128,1553,1556,9200,8002,2551,1557,8160,2004,
       5912,1410)
        AND B.DT_TRANSACAO BETWEEN $1::timestamp AND $2::timestamp
    `;

    // Executar queries em paralelo
    const [resultado, totalResult] = await Promise.all([
      pool.query(query, [dataInicio, dataFim, limitValue, offsetValue]),
      pool.query(countQuery, [dataInicio, dataFim])
    ]);

    const total = parseInt(totalResult.rows[0].total, 10);

    // Resposta estruturada
    res.json({
      total,
      limit: limitValue,
      offset: offsetValue,
      periodo: {
        inicio: dataInicio,
        fim: dataFim
      },
      dados: resultado.rows
    });

    console.log(`Ranking vendedores: ${resultado.rows.length} registros retornados de ${total} total`);

  } catch (error) {
    console.error('Erro ao buscar ranking de vendedores:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao buscar ranking de vendedores.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Rota para buscar contas a pagar
app.get('/contasapagar', async (req, res) => {
  try {
    const { dt_inicio, dt_fim, cd_empresa, limit, offset } = req.query;
    
    // Validação dos parâmetros obrigatórios
    if (!dt_inicio || !dt_fim || !cd_empresa) {
      return res.status(400).json({ 
        message: 'Parâmetros obrigatórios: dt_inicio, dt_fim (formato: YYYY-MM-DD) e cd_empresa' 
      });
    }

    // Configuração de paginação
    const limitValue = parseInt(limit, 10) || 50;
    const offsetValue = parseInt(offset, 10) || 0;

    // Query principal com paginação
    const query = `
                      select
                  fd.cd_empresa,
                  fd.cd_fornecedor,
                  fd.nr_duplicata,
                  fd.nr_portador,
                  fd.dt_emissao,
                  fd.dt_vencimento,
                  fd.dt_entrada,
                  fd.dt_liq,
                  fd.tp_situacao,
                  fd.tp_estagio,
                  fd.vl_duplicata,
                  fd.vl_juros,
                  fd.vl_acrescimo,
                  fd.vl_desconto,
                  fd.vl_pago,
                  fd.in_aceite,
                  od.ds_observacao
      from
        fcp_duplicatai fd
      left join obs_dupi od on
        fd.nr_duplicata = od.nr_duplicata
      where
        fd.dt_emissao between $1 and $2
        and fd.cd_empresa = $3
                      group by
                  fd.cd_empresa,
                  fd.cd_fornecedor,
                  fd.nr_duplicata,
                  fd.nr_portador,
                  fd.dt_emissao,
                  fd.dt_vencimento,
                  fd.dt_entrada,
                  fd.dt_liq,
                  fd.tp_situacao,
                  fd.tp_estagio,
                  fd.vl_duplicata,
                  fd.vl_juros,
                  fd.vl_acrescimo,
                  fd.vl_desconto,
                  fd.vl_pago,
                  fd.in_aceite,
                  od.ds_observacao
      order by fd.dt_emissao desc
      limit $4 offset $5
    `;

    // Query para contar total de registros
    const countQuery = `
      select count(*) as total
      from
        fcp_duplicatai fd
      left join obs_dupi od on
        fd.nr_duplicata = od.nr_duplicata
      where
        fd.dt_emissao between $1 and $2
        and fd.cd_empresa = $3
    `;

    // Executar queries em paralelo
    const [resultado, totalResult] = await Promise.all([
      pool.query(query, [dt_inicio, dt_fim, cd_empresa, limitValue, offsetValue]),
      pool.query(countQuery, [dt_inicio, dt_fim, cd_empresa])
    ]);

    const total = parseInt(totalResult.rows[0].total, 10);

    // Resposta estruturada
    res.json({
      total,
      limit: limitValue,
      offset: offsetValue,
      filtros: {
        dt_inicio,
        dt_fim,
        cd_empresa
      },
      dados: resultado.rows
    });

    console.log(`Contas a pagar: ${resultado.rows.length} registros retornados de ${total} total`);

  } catch (error) {
    console.error('Erro ao buscar contas a pagar:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao buscar contas a pagar.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend rodando em ${PORT}`);
}); 