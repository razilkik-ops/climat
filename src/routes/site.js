import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { calculateProjectCost } from '../lib/calculator.js';

const router = Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = authSchema.extend({
  name: z.string().min(2),
  phone: z.string().optional()
});

const leadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  city: z.string().optional(),
  objectType: z.string().optional(),
  roomArea: z.coerce.number().int().positive().optional(),
  budget: z.string().optional(),
  preferredDate: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional()
});

function parseIds(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(',') : value;
  return raw.split(',').map((item) => Number(item)).filter(Boolean).slice(0, 2);
}

function parseCartItems(value) {
  if (!value) return [];

  try {
    const items = JSON.parse(value);
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => ({
        id: Number(item.id),
        quantity: Math.min(Math.max(Number(item.quantity) || 1, 1), 20),
        install: item.install !== false
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

router.get('/', async (req, res, next) => {
  try {
    const [featured, brands, productsCount] = await Promise.all([
      prisma.product.findMany({
        take: 4,
        orderBy: [{ rating: 'desc' }, { price: 'asc' }],
        include: { brand: true }
      }),
      prisma.brand.findMany({ orderBy: { name: 'asc' } }),
      prisma.product.count()
    ]);

    res.render('layout', {
      view: 'pages/home',
      title: 'Кондиционеры с монтажом в Минске',
      featured,
      brands,
      productsCount
    });
  } catch (error) {
    next(error);
  }
});

router.get('/catalog', async (req, res, next) => {
  try {
    const { brand, type, area, minArea, maxArea, minPrice, maxPrice, inverter, wifi, sort } = req.query;
    const where = {
      ...(brand ? { brand: { slug: String(brand) } } : {}),
      ...(type ? { type: String(type) } : {}),
      ...((area || minArea || maxArea) ? {
        roomArea: {
          ...((area || minArea) ? { gte: Number(area || minArea) } : {}),
          ...(maxArea ? { lte: Number(maxArea) } : {})
        }
      } : {}),
      ...(inverter === 'on' ? { inverter: true } : {}),
      ...(wifi === 'on' ? { wifi: true } : {}),
      ...((minPrice || maxPrice) ? {
        price: {
          ...(minPrice ? { gte: Number(minPrice) } : {}),
          ...(maxPrice ? { lte: Number(maxPrice) } : {})
        }
      } : {})
    };

    const orderBy = {
      price_asc: { price: 'asc' },
      price_desc: { price: 'desc' },
      rating: { rating: 'desc' },
      area: { roomArea: 'asc' }
    }[sort] || { rating: 'desc' };

    const [products, brands] = await Promise.all([
      prisma.product.findMany({ where, orderBy, include: { brand: true } }),
      prisma.brand.findMany({ orderBy: { name: 'asc' } })
    ]);

    res.render('layout', {
      view: 'pages/catalog',
      title: 'Каталог кондиционеров',
      products,
      brands,
      query: req.query
    });
  } catch (error) {
    next(error);
  }
});

router.get('/product/:slug', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: { brand: true }
    });

    if (!product) {
      res.status(404).render('layout', { view: 'pages/not-found', title: 'Товар не найден' });
      return;
    }

    res.render('layout', {
      view: 'pages/product',
      title: product.title,
      product
    });
  } catch (error) {
    next(error);
  }
});

router.get('/compare', async (req, res, next) => {
  try {
    const ids = parseIds(req.query.ids);
    const products = ids.length
      ? await prisma.product.findMany({
          where: { id: { in: ids } },
          include: { brand: true }
        })
      : [];

    const suggestions = await prisma.product.findMany({
      take: 4,
      orderBy: { rating: 'desc' },
      include: { brand: true }
    });

    res.render('layout', {
      view: 'pages/compare',
      title: 'Сравнение моделей',
      products,
      suggestions
    });
  } catch (error) {
    next(error);
  }
});

router.get('/login', (req, res) => {
  res.render('layout', {
    view: 'pages/login',
    title: 'Вход',
    error: null,
    form: { email: '' }
  });
});

router.post('/login', async (req, res, next) => {
  try {
    const data = authSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user && await bcrypt.compare(data.password, user.passwordHash);

    if (valid) {
      req.session.userId = user.id;
      req.session.user = { id: user.id, name: user.name, email: user.email, phone: user.phone };
      res.redirect('/account');
      return;
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    const validAdmin = admin && await bcrypt.compare(data.password, admin.passwordHash);

    if (validAdmin) {
      req.session.adminId = admin.id;
      req.session.admin = { email: admin.email, role: admin.role };
      res.redirect('/admin');
      return;
    }

    if (!validAdmin) {
      res.status(401).render('layout', {
        view: 'pages/login',
        title: 'Вход',
        error: 'Неверный email или пароль',
        form: { email: data.email }
      });
      return;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).render('layout', {
        view: 'pages/login',
        title: 'Вход',
        error: 'Введите корректный email и пароль от 6 символов',
        form: { email: req.body.email || '' }
      });
      return;
    }

    next(error);
  }
});

router.get('/register', (req, res) => {
  res.render('layout', {
    view: 'pages/register',
    title: 'Регистрация',
    error: null,
    form: { name: '', email: '', phone: '' }
  });
});

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      res.status(409).render('layout', {
        view: 'pages/register',
        title: 'Регистрация',
        error: 'Пользователь с таким email уже зарегистрирован',
        form: { name: data.name, email, phone: data.phone || '' }
      });
      return;
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        phone: data.phone || null,
        passwordHash: await bcrypt.hash(data.password, 12)
      }
    });

    req.session.userId = user.id;
    req.session.user = { id: user.id, name: user.name, email: user.email, phone: user.phone };
    res.redirect('/account');
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).render('layout', {
        view: 'pages/register',
        title: 'Регистрация',
        error: 'Заполните имя, корректный email и пароль от 6 символов',
        form: {
          name: req.body.name || '',
          email: req.body.email || '',
          phone: req.body.phone || ''
        }
      });
      return;
    }

    next(error);
  }
});

router.get('/account', (req, res) => {
  if (!req.session?.userId) {
    res.redirect('/login');
    return;
  }

  res.render('layout', {
    view: 'pages/account',
    title: 'Личный кабинет'
  });
});

router.post('/logout', (req, res) => {
  req.session.userId = null;
  req.session.user = null;
  res.redirect('/');
});

router.get('/quiz', async (req, res) => {
  res.render('layout', {
    view: 'pages/quiz',
    title: 'Подбор кондиционера'
  });
});

router.post('/quiz', async (req, res, next) => {
  try {
    const area = Number(req.body.area || 25);
    const budget = calculateProjectCost({
      area,
      routeLength: req.body.routeLength || 3,
      tier: req.body.tier || 'balanced',
      wifi: req.body.wifi === 'on'
    });

    const recommendedProduct = await prisma.product.findFirst({
      where: {
        roomArea: { gte: area },
        price: { lte: Math.round(budget.equipment * 1.25) }
      },
      orderBy: [{ rating: 'desc' }, { price: 'asc' }],
      include: { brand: true }
    });

    const quiz = await prisma.quizSubmission.create({
      data: {
        name: req.body.name || null,
        phone: req.body.phone || null,
        answers: req.body,
        calculatedBudget: budget.total,
        recommendedProductId: recommendedProduct?.id || null
      }
    });

    if (req.body.phone) {
      await prisma.lead.create({
        data: {
          name: req.body.name || 'Квиз',
          phone: req.body.phone,
          objectType: req.body.objectType,
          roomArea: area,
          budget: `${budget.rangeFrom}-${budget.rangeTo} BYN`,
          source: 'quiz',
          notes: `Квиз #${quiz.id}. Рекомендация: ${recommendedProduct?.title || 'нужна консультация'}`
        }
      });
    }

    res.render('layout', {
      view: 'pages/quiz-result',
      title: 'Результат подбора',
      budget,
      recommendedProduct
    });
  } catch (error) {
    next(error);
  }
});

router.get('/calculator', (req, res) => {
  res.render('layout', {
    view: 'pages/calculator',
    title: 'Калькулятор стоимости'
  });
});

router.get('/cart', (req, res) => {
  res.render('layout', {
    view: 'pages/cart',
    title: 'Корзина'
  });
});

router.post('/api/calculate', (req, res) => {
  res.json(calculateProjectCost(req.body));
});

router.get('/api/products/:slug', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: { brand: true }
    });

    if (!product) {
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }

    res.json({
      id: product.id,
      title: product.title,
      slug: product.slug,
      price: product.price,
      installPrice: product.installPrice,
      image: product.image,
      brand: product.brand.name,
      description: product.description || 'Тихая инверторная модель для квартиры, дома или офиса с профессиональным монтажом под ключ.',
      area: product.roomArea,
      power: product.coolingPower || '',
      noise: product.noiseLevel || '',
      energy: product.energyClass || ''
    });
  } catch (error) {
    next(error);
  }
});

router.post('/api/leads', async (req, res, next) => {
  try {
    const data = leadSchema.parse(req.body);
    await prisma.lead.create({
      data: {
        ...data,
        city: data.city || 'Минск',
        source: data.source || 'site'
      }
    });

    if (req.accepts('html')) {
      res.redirect('/thanks');
      return;
    }

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/installation', (req, res) => {
  res.render('layout', {
    view: 'pages/installation',
    title: 'Монтаж кондиционеров'
  });
});

router.get('/warranty', (req, res) => {
  res.render('layout', {
    view: 'pages/warranty',
    title: 'Гарантия и сервис'
  });
});

router.get('/checkout', async (req, res, next) => {
  try {
    const product = req.query.product
      ? await prisma.product.findUnique({ where: { slug: String(req.query.product) }, include: { brand: true } })
      : null;

    res.render('layout', {
      view: 'pages/checkout',
      title: 'Онлайн-оплата',
      product
    });
  } catch (error) {
    next(error);
  }
});

router.get('/payment', (req, res) => {
  res.render('layout', {
    view: 'pages/delivery-payment',
    title: 'Доставка и оплата'
  });
});

router.post('/orders', async (req, res, next) => {
  try {
    const cartItems = parseCartItems(req.body.cartItems);
    const orderLines = [];

    if (cartItems.length) {
      const products = await prisma.product.findMany({
        where: { id: { in: cartItems.map((item) => item.id) } }
      });

      for (const item of cartItems) {
        const product = products.find((entry) => entry.id === item.id);
        if (!product) continue;

        orderLines.push({
          product,
          quantity: item.quantity,
          install: item.install
        });
      }
    } else {
      const product = await prisma.product.findUnique({ where: { id: Number(req.body.productId) } });
      if (product) {
        orderLines.push({
          product,
          quantity: 1,
          install: req.body.install === 'on'
        });
      }
    }

    if (!orderLines.length) {
      res.redirect('/catalog');
      return;
    }

    const total = orderLines.reduce((sum, line) => (
      sum + (line.product.price + (line.install ? line.product.installPrice : 0)) * line.quantity
    ), 0);

    const order = await prisma.order.create({
      data: {
        customer: req.body.customer,
        phone: req.body.phone,
        email: req.body.email || null,
        address: req.body.address || null,
        total,
        items: {
          create: orderLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            price: line.product.price,
            install: line.install
          }))
        },
        payments: {
          create: {
            amount: total,
            reference: `PAY-${Date.now()}-${Math.round(Math.random() * 1000)}`
          }
        }
      },
      include: { payments: true }
    });

    await prisma.lead.create({
      data: {
        name: req.body.customer,
        phone: req.body.phone,
        objectType: 'Заказ',
        budget: `${total} BYN`,
        source: 'checkout',
        notes: `Заказ #${order.id}: ${orderLines.map((line) => `${line.product.title} x${line.quantity}`).join(', ')}`
      }
    });

    res.redirect(`/payment/${order.payments[0].reference}`);
  } catch (error) {
    next(error);
  }
});

router.get('/payment/:reference', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { reference: req.params.reference },
      include: {
        order: {
          include: {
            items: { include: { product: true } }
          }
        }
      }
    });

    if (!payment) {
      res.status(404).render('layout', { view: 'pages/not-found', title: 'Платеж не найден' });
      return;
    }

    res.render('layout', {
      view: 'pages/payment',
      title: 'Оплата заказа',
      payment
    });
  } catch (error) {
    next(error);
  }
});

router.post('/payment/:reference/pay', async (req, res, next) => {
  try {
    const payment = await prisma.payment.update({
      where: { reference: req.params.reference },
      data: { status: 'SUCCEEDED' }
    });
    await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: 'PAID' }
    });
    res.redirect(`/payment/${payment.reference}?paid=1`);
  } catch (error) {
    next(error);
  }
});

router.get('/thanks', (req, res) => {
  res.render('layout', {
    view: 'pages/thanks',
    title: 'Заявка принята'
  });
});

export default router;
