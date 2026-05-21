const baseByArea = [
  { max: 20, unit: 2.1, price: 1450 },
  { max: 28, unit: 2.6, price: 1790 },
  { max: 35, unit: 3.5, price: 2290 },
  { max: 50, unit: 5.0, price: 3790 },
  { max: 70, unit: 7.0, price: 5490 }
];

export function calculateProjectCost(input) {
  const area = Number(input.area || 25);
  const routeLength = Number(input.routeLength || 3);
  const drilling = Number(input.drilling || 1);
  const highFloor = input.highFloor === true || input.highFloor === 'true';
  const wifi = input.wifi === true || input.wifi === 'true';
  const tier = input.tier || 'balanced';

  const matched = baseByArea.find((item) => area <= item.max) || baseByArea.at(-1);
  const tierMultiplier = {
    economy: 0.88,
    balanced: 1,
    premium: 1.32
  }[tier] || 1;

  const equipment = Math.round(matched.price * tierMultiplier);
  const routeExtra = Math.max(routeLength - 3, 0) * 55;
  const install = 520 + routeExtra + drilling * 45 + (highFloor ? 180 : 0);
  const options = wifi ? 130 : 0;
  const total = equipment + install + options;

  return {
    area,
    recommendedPower: matched.unit,
    equipment,
    install,
    options,
    total,
    rangeFrom: Math.round(total * 0.94),
    rangeTo: Math.round(total * 1.12)
  };
}

