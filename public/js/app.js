const formatMoney = (value) => new Intl.NumberFormat('ru-BY').format(value) + ' BYN';

const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
if (menuToggle && menu) {
  menuToggle.addEventListener('click', () => menu.classList.toggle('open'));
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((item) => observer.observe(item));

const readStorage = (key, fallback = []) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getCompare = () => readStorage('compareIds');
const setCompare = (ids) => {
  writeStorage('compareIds', ids.slice(0, 4));
  updateCompareUi();
};

function updateCompareUi() {
  const ids = getCompare();
  document.querySelectorAll('[data-compare-id]').forEach((button) => {
    const id = Number(button.dataset.compareId);
    button.classList.toggle('selected', ids.includes(id));
    button.setAttribute('aria-pressed', ids.includes(id) ? 'true' : 'false');
  });

  document.querySelectorAll('[data-compare-link]').forEach((link) => {
    link.href = ids.length ? `/compare?ids=${ids.join(',')}` : '/compare';
  });
}

const getCart = () => readStorage('cartItems');
const setCart = (items) => {
  writeStorage('cartItems', items);
  updateCartUi();
};

function updateCartUi() {
  const items = getCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  document.querySelectorAll('[data-cart-count]').forEach((node) => {
    node.textContent = count;
  });

  const cartItems = document.querySelector('[data-cart-items]');
  const cartEmpty = document.querySelector('[data-cart-empty]');
  const cartTotal = document.querySelector('[data-cart-total]');
  const cartPayload = document.querySelector('[data-cart-payload]');
  const cartForm = document.querySelector('[data-cart-form]');

  if (!cartItems) return;

  cartEmpty.hidden = items.length > 0;
  cartForm.hidden = items.length === 0;
  cartItems.innerHTML = items.map((item) => `
    <article class="cart-item" data-cart-row="${item.id}">
      <img src="${item.image}" alt="${item.title}">
      <div>
        <a href="/product/${item.slug}">${item.title}</a>
        <span>${item.brand} · монтаж ${item.install ? 'включён' : 'не нужен'}</span>
        <strong>${formatMoney((item.price + (item.install ? item.installPrice : 0)) * item.quantity)}</strong>
      </div>
      <div class="quantity-control">
        <button type="button" data-cart-qty="${item.id}" data-delta="-1">−</button>
        <b>${item.quantity}</b>
        <button type="button" data-cart-qty="${item.id}" data-delta="1">+</button>
      </div>
      <button class="round-icon" type="button" data-cart-remove="${item.id}" aria-label="Удалить">×</button>
    </article>
  `).join('');

  const total = items.reduce((sum, item) => sum + (item.price + (item.install ? item.installPrice : 0)) * item.quantity, 0);
  cartTotal.textContent = formatMoney(total);
  cartPayload.value = JSON.stringify(items.map(({ id, quantity, install }) => ({ id, quantity, install })));
}

document.addEventListener('click', (event) => {
  const compareButton = event.target.closest('[data-compare-id]');
  if (compareButton) {
    const id = Number(compareButton.dataset.compareId);
    const ids = getCompare();
    setCompare(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
    return;
  }

  const addButton = event.target.closest('[data-cart-add]');
  if (addButton) {
    const item = {
      id: Number(addButton.dataset.id),
      title: addButton.dataset.title,
      slug: addButton.dataset.slug,
      price: Number(addButton.dataset.price),
      installPrice: Number(addButton.dataset.installPrice),
      image: addButton.dataset.image,
      brand: addButton.dataset.brand,
      quantity: 1,
      install: true
    };
    const items = getCart();
    const current = items.find((entry) => entry.id === item.id);
    if (current) {
      current.quantity += 1;
      setCart(items);
    } else {
      setCart([...items, item]);
    }
    addButton.classList.add('selected');
    setTimeout(() => addButton.classList.remove('selected'), 700);
    return;
  }

  const qtyButton = event.target.closest('[data-cart-qty]');
  if (qtyButton) {
    const id = Number(qtyButton.dataset.cartQty);
    const delta = Number(qtyButton.dataset.delta);
    const items = getCart()
      .map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item);
    setCart(items);
    return;
  }

  const removeButton = event.target.closest('[data-cart-remove]');
  if (removeButton) {
    const id = Number(removeButton.dataset.cartRemove);
    setCart(getCart().filter((item) => item.id !== id));
  }
});

const cartForm = document.querySelector('[data-cart-form]');
if (cartForm) {
  cartForm.addEventListener('submit', () => {
    setTimeout(() => setCart([]), 300);
  });
}

updateCompareUi();
updateCartUi();

const calcForm = document.querySelector('[data-calculator]');
const calcResult = document.querySelector('[data-calc-result]');

async function updateCalculator() {
  if (!calcForm || !calcResult) return;

  const formData = new FormData(calcForm);
  const payload = Object.fromEntries(formData.entries());
  payload.wifi = calcForm.querySelector('[name="wifi"]').checked;
  payload.highFloor = calcForm.querySelector('[name="highFloor"]').checked;

  const response = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  calcResult.innerHTML = `
    <span>Итого ориентировочно</span>
    <strong>${formatMoney(result.rangeFrom)} – ${formatMoney(result.rangeTo)}</strong>
    <p>Оборудование: ${formatMoney(result.equipment)} · монтаж: ${formatMoney(result.install)} · мощность: ${result.recommendedPower} кВт</p>
  `;
}

if (calcForm) {
  calcForm.addEventListener('input', updateCalculator);
  calcForm.addEventListener('change', updateCalculator);
  updateCalculator();
}
