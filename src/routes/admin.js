import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware.js';

const router = Router();

router.get('/login', (req, res) => {
  res.render('layout', {
    view: 'admin/login',
    title: 'Вход в админку',
    error: null
  });
});

router.post('/login', async (req, res, next) => {
  try {
    const admin = await prisma.adminUser.findUnique({ where: { email: req.body.email } });
    const valid = admin && await bcrypt.compare(req.body.password, admin.passwordHash);

    if (!valid) {
      res.status(401).render('layout', {
        view: 'admin/login',
        title: 'Вход в админку',
        error: 'Неверный email или пароль'
      });
      return;
    }

    req.session.adminId = admin.id;
    req.session.admin = { email: admin.email, role: admin.role };
    res.redirect('/admin');
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const [leadsCount, newLeads, ordersCount, paidOrders, productsCount, recentLeads, recentOrders] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'NEW' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.product.count(),
      prisma.lead.findMany({ take: 6, orderBy: { createdAt: 'desc' } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } } }
      })
    ]);

    res.render('layout', {
      view: 'admin/dashboard',
      title: 'CRM',
      stats: { leadsCount, newLeads, ordersCount, paidOrders, productsCount },
      recentLeads,
      recentOrders
    });
  } catch (error) {
    next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { brand: true }
    });

    res.render('layout', {
      view: 'admin/products',
      title: 'Товары',
      products
    });
  } catch (error) {
    next(error);
  }
});

router.get('/leads', async (req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
    res.render('layout', {
      view: 'admin/leads',
      title: 'Заявки',
      leads
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/leads/:id/status', async (req, res, next) => {
  try {
    await prisma.lead.update({
      where: { id: Number(req.params.id) },
      data: { status: req.body.status }
    });
    res.redirect('/admin/leads');
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        payments: true,
        items: { include: { product: true } }
      }
    });

    res.render('layout', {
      view: 'admin/orders',
      title: 'Заказы',
      orders
    });
  } catch (error) {
    next(error);
  }
});

export default router;

