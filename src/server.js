import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pg from 'pg';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import methodOverride from 'method-override';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from './lib/prisma.js';
import { money, leadStatusLabel, orderStatusLabel } from './lib/format.js';
import { exposeLocals } from './middleware.js';
import siteRoutes from './routes/site.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PgSession = pgSession(session);

app.set('view engine', 'ejs');
app.set('views', join(__dirname, '..', 'views'));

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(join(__dirname, '..', 'public')));

const sessionStore = process.env.DATABASE_URL
  ? new PgSession({
      pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
      tableName: 'user_sessions',
      createTableIfMissing: true
    })
  : undefined;

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use((req, res, next) => {
  res.locals.money = money;
  res.locals.leadStatusLabel = leadStatusLabel;
  res.locals.orderStatusLabel = orderStatusLabel;
  res.locals.renderPage = (view, data = {}) => res.render('layout', { view, ...data });
  next();
});
app.use(exposeLocals);

app.use('/', siteRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).render('layout', {
    view: 'pages/not-found',
    title: 'Страница не найдена'
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render('layout', {
    view: 'pages/error',
    title: 'Ошибка',
    error
  });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Minsk Climate is running on http://${host}:${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
