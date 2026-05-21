import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { calculateProjectCost } from '../lib/calculator.js';

const router = Router();

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
  return raw.split(',').map((item) => Number(item)).filter(Boolean).slice(0, 4);
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
    const { brand, type, area, minPrice, maxPrice, inverter, wifi, sort } = req.query;
    const where = {
      ...(brand ? { brand: { slug: String(brand) } } : {}),
      ...(type ? { type: String(type) } : {}),
      ...(area ? { roomArea: { gte: Number(area) } } : {}),
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

    const related = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        roomArea: { gte: Math.max(product.roomArea - 10, 1), lte: product.roomArea + 15 }
      },
      take: 3,
      include: { brand: true }
    });

    res.render('layout', {
      view: 'pages/product',
      title: product.title,
      product,
      related
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

router.post('/api/calculate', (req, res) => {
  res.json(calculateProjectCost(req.body));
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

router.post('/orders', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: Number(req.body.productId) } });
    if (!product) {
      res.redirect('/catalog');
      return;
    }

    const install = req.body.install === 'on';
    const total = product.price + (install ? product.installPrice : 0);
    const order = await prisma.order.create({
      data: {
        customer: req.body.customer,
        phone: req.body.phone,
        email: req.body.email || null,
        address: req.body.address || null,
        total,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            price: product.price,
            install
          }
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
        notes: `Заказ #${order.id}: ${product.title}`
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

