import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware.js';

const router = Router();

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '') || `product-${Date.now()}`;
}

function splitFeatures(value) {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function productPayload(body) {
  return {
    title: body.title,
    slug: slugify(body.slug || body.title),
    type: body.type || 'split',
    roomArea: Number(body.roomArea),
    coolingPower: Number(body.coolingPower),
    energyClass: body.energyClass,
    noiseLevel: Number(body.noiseLevel),
    inverter: body.inverter === 'on',
    wifi: body.wifi === 'on',
    price: Number(body.price),
    installPrice: Number(body.installPrice),
    rating: Number(body.rating || 4.8),
    stock: Number(body.stock || 0),
    badge: body.badge || null,
    description: body.description,
    features: splitFeatures(body.features),
    image: body.image || '/img/ac-white.svg',
    brandId: Number(body.brandId)
  };
}

router.get('/login', (req, res) => {
  res.redirect('/login');
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
      title: 'Админка',
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
    const [products, brands] = await Promise.all([
      prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        include: { brand: true }
      }),
      prisma.brand.findMany({ orderBy: { name: 'asc' } })
    ]);

    res.render('layout', {
      view: 'admin/products',
      title: 'Товары',
      products,
      brands,
      product: null,
      mode: 'create'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    await prisma.product.create({ data: productPayload(req.body) });
    res.redirect('/admin/products');
  } catch (error) {
    next(error);
  }
});

router.get('/products/:id/edit', async (req, res, next) => {
  try {
    const [product, products, brands] = await Promise.all([
      prisma.product.findUnique({ where: { id: Number(req.params.id) }, include: { brand: true } }),
      prisma.product.findMany({ orderBy: { createdAt: 'desc' }, include: { brand: true } }),
      prisma.brand.findMany({ orderBy: { name: 'asc' } })
    ]);

    if (!product) {
      res.status(404).render('layout', { view: 'pages/not-found', title: 'Товар не найден' });
      return;
    }

    res.render('layout', {
      view: 'admin/products',
      title: 'Редактирование товара',
      products,
      brands,
      product,
      mode: 'edit'
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: productPayload(req.body)
    });
    res.redirect('/admin/products');
  } catch (error) {
    next(error);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.redirect('/admin/products');
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
