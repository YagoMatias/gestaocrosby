import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// ─── Rotas existentes ────────────────────────────────────────────────────────────────────
import chatRoutes from './routes/chat.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';

// ─── Rotas TOTVS (separadas por domínio) ────────────────────────────────────────────
import authRouter from './totvsrouter/auth.js';
import fiscalRouter from './totvsrouter/fiscal.js';
import clientesRouter from './totvsrouter/clientes.js';
import filiaisRouter from './totvsrouter/filiais.js';
import financeiroRouter from './totvsrouter/financeiro.js';
import estoqueRouter from './totvsrouter/estoque.js';
import painelVendasRouter from './totvsrouter/painelVendas.js';
import voucherRouter from './totvsrouter/voucher.js';

// =============================================================================
// SERVER SETUP
// =============================================================================

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Montar rotas TOTVS (/api/totvs/*) ───────────────────────────────────────────────────────────────────
app.use('/api/totvs', authRouter); // GET /token, POST /auth
app.use('/api/totvs', fiscalRouter); // boleto, DANFE, XML, NFs, movimentos fiscais
app.use('/api/totvs', clientesRouter); // legal-entity, individual, clientes, sync
app.use('/api/totvs', filiaisRouter); // branches, franchise, multibrand
app.use('/api/totvs', financeiroRouter); // accounts-receivable, accounts-payable
app.use('/api/totvs', estoqueRouter); // best-selling-products, product-balances
app.use('/api/totvs', painelVendasRouter); // sale-panel/*, seller-panel/*

// ─── Demais rotas ───────────────────────────────────────────────────────────────────────────
app.use('/api/chat', chatRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
