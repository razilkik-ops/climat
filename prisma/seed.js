import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const brands = [
  { name: 'Daikin', slug: 'daikin', country: 'Япония' },
  { name: 'Mitsubishi Electric', slug: 'mitsubishi-electric', country: 'Япония' },
  { name: 'Cooper&Hunter', slug: 'cooper-hunter', country: 'США' },
  { name: 'Gree', slug: 'gree', country: 'Китай' }
];

const products = [
  {
    brand: 'daikin',
    title: 'Daikin Sensira FTXF25E',
    slug: 'daikin-sensira-ftxf25e',
    type: 'split',
    roomArea: 25,
    coolingPower: 2.5,
    energyClass: 'A++',
    noiseLevel: 20,
    inverter: true,
    wifi: false,
    price: 2290,
    installPrice: 520,
    rating: 4.9,
    stock: 7,
    badge: 'Тихий выбор',
    description: 'Инверторная сплит-система для спальни, кабинета или детской с мягким распределением потока.',
    features: ['тихий ночной режим', 'экономичное охлаждение', 'самодиагностика', 'фильтрация воздуха'],
    image: '/img/install-1.jpg'
  },
  {
    brand: 'mitsubishi-electric',
    title: 'Mitsubishi Electric MSZ-AP35VG',
    slug: 'mitsubishi-electric-msz-ap35vg',
    type: 'split',
    roomArea: 35,
    coolingPower: 3.5,
    energyClass: 'A+++',
    noiseLevel: 19,
    inverter: true,
    wifi: true,
    price: 3490,
    installPrice: 560,
    rating: 5,
    stock: 4,
    badge: 'Премиум',
    description: 'Премиальная модель для гостиной или большой комнаты с точным климат-контролем и Wi-Fi.',
    features: ['Wi-Fi в комплекте', 'очень низкий шум', 'режим i-save', 'плазменный фильтр'],
    image: '/img/install-2.jpg'
  },
  {
    brand: 'cooper-hunter',
    title: 'Cooper&Hunter Nordic Evo II CH-S09FTXN',
    slug: 'cooper-hunter-nordic-evo-ii-ch-s09ftxn',
    type: 'split',
    roomArea: 28,
    coolingPower: 2.7,
    energyClass: 'A++',
    noiseLevel: 21,
    inverter: true,
    wifi: true,
    price: 1990,
    installPrice: 520,
    rating: 4.8,
    stock: 9,
    badge: 'Зима/лето',
    description: 'Универсальная модель для охлаждения летом и эффективного обогрева в межсезонье.',
    features: ['работа на обогрев', 'Wi-Fi ready', 'антикоррозийное покрытие', 'теплый старт'],
    image: '/img/tools.jpg'
  },
  {
    brand: 'gree',
    title: 'Gree Pular Inverter GWH12AGB',
    slug: 'gree-pular-inverter-gwh12agb',
    type: 'split',
    roomArea: 35,
    coolingPower: 3.2,
    energyClass: 'A+',
    noiseLevel: 24,
    inverter: true,
    wifi: false,
    price: 1590,
    installPrice: 540,
    rating: 4.7,
    stock: 12,
    badge: 'Оптимально',
    description: 'Надежная инверторная система для квартиры с хорошим балансом цены и ресурса.',
    features: ['стабильный компрессор', 'автоочистка', 'турборежим', 'запоминание настроек'],
    image: '/img/technician.jpg'
  },
  {
    brand: 'daikin',
    title: 'Daikin Stylish FTXA42',
    slug: 'daikin-stylish-ftxa42',
    type: 'designer',
    roomArea: 42,
    coolingPower: 4.2,
    energyClass: 'A+++',
    noiseLevel: 19,
    inverter: true,
    wifi: true,
    price: 4890,
    installPrice: 620,
    rating: 5,
    stock: 2,
    badge: 'Дизайн',
    description: 'Тонкий дизайнерский блок для интерьеров, где техника должна выглядеть дорого и спокойно.',
    features: ['эффект Коанда', '3D-поток', 'Wi-Fi', 'серебристый корпус'],
    image: '/img/interior.jpg'
  },
  {
    brand: 'gree',
    title: 'Gree U-Match Console 18',
    slug: 'gree-u-match-console-18',
    type: 'commercial',
    roomArea: 55,
    coolingPower: 5.0,
    energyClass: 'A+',
    noiseLevel: 32,
    inverter: true,
    wifi: false,
    price: 4210,
    installPrice: 890,
    rating: 4.8,
    stock: 3,
    badge: 'Для офиса',
    description: 'Полупромышленное решение для офиса, салона, кофейни или помещения сложной формы.',
    features: ['напольно-потолочный монтаж', 'длинная трасса', 'дренажная помпа', 'служебный режим'],
    image: '/img/office.jpg'
  }
];

async function main() {
  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: brand,
      create: brand
    });
  }

  for (const item of products) {
    const brand = await prisma.brand.findUnique({ where: { slug: item.brand } });
    await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        ...item,
        brand: undefined,
        brandId: brand.id
      },
      create: {
        ...item,
        brand: undefined,
        brandId: brand.id
      }
    });
  }

  const passwordHash = await bcrypt.hash('admin123', 12);
  await prisma.adminUser.upsert({
    where: { email: 'admin@climate.by' },
    update: { passwordHash },
    create: {
      email: 'admin@climate.by',
      passwordHash
    }
  });

  const existingLeads = await prisma.lead.count();
  if (existingLeads === 0) {
    await prisma.lead.createMany({
      data: [
      {
        name: 'Анна',
        phone: '+375 29 111-22-33',
        objectType: 'Квартира',
        roomArea: 32,
        budget: 'до 2500 BYN',
        source: 'quiz',
        notes: 'Нужен тихий вариант в спальню'
      },
      {
        name: 'Игорь',
        phone: '+375 44 555-66-77',
        objectType: 'Офис',
        roomArea: 55,
        budget: 'до 5000 BYN',
        source: 'calculator',
        notes: 'Монтаж после ремонта, трасса около 7 м'
      }
      ]
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
