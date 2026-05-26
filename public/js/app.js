const formatMoney = (value) => new Intl.NumberFormat('ru-BY').format(value) + ' BYN';

const themeStorageKey = 'climat-theme';
const themeToggles = document.querySelectorAll('[data-theme-toggle]');
const themeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');

function getStoredTheme() {
  try {
    const storedTheme = localStorage.getItem(themeStorageKey);
    return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null;
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  themeToggles.forEach((themeToggle) => {
    const isDark = theme === 'dark';
    themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    themeToggle.setAttribute('aria-label', isDark ? 'Включить светлую тему' : 'Включить темную тему');
  });
}

function storeTheme(theme) {
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    return false;
  }

  return true;
}

applyTheme(getStoredTheme() || (themeMedia?.matches ? 'dark' : 'light'));

themeToggles.forEach((themeToggle) => {
  themeToggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    storeTheme(nextTheme);
    applyTheme(nextTheme);
  });
});

if (themeMedia) {
  const syncSystemTheme = (event) => {
    if (!getStoredTheme()) applyTheme(event.matches ? 'dark' : 'light');
  };

  if (themeMedia.addEventListener) {
    themeMedia.addEventListener('change', syncSystemTheme);
  } else {
    themeMedia.addListener(syncSystemTheme);
  }
}

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
  writeStorage('compareIds', [...new Set(ids)].slice(-2));
  updateCompareUi();
};

function updateCompareUi() {
  const storedIds = getCompare();
  const ids = storedIds.slice(-2);
  if (storedIds.length !== ids.length || storedIds.some((id, index) => id !== ids[index])) {
    writeStorage('compareIds', ids);
  }
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
  const serviceTotal = [...document.querySelectorAll('[data-service-toggle]:checked')]
    .reduce((sum, input) => sum + Number(input.dataset.servicePrice || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const installTotal = items.reduce((sum, item) => sum + (item.install ? item.installPrice : 0) * item.quantity, 0);
  const delivery = subtotal > 0 && subtotal < 500 ? 35 : 0;
  const discount = subtotal > 0 ? 250 : 0;
  const total = Math.max(0, subtotal + installTotal + serviceTotal + delivery - discount);

  document.querySelectorAll('[data-cart-count]').forEach((node) => {
    node.textContent = count;
  });

  const cartItems = document.querySelector('[data-cart-items]');
  const cartEmpty = document.querySelector('[data-cart-empty]');
  const cartTotal = document.querySelector('[data-cart-total]');
  const cartSubtotal = document.querySelector('[data-cart-subtotal]');
  const cartInstall = document.querySelector('[data-cart-install]');
  const cartDelivery = document.querySelector('[data-cart-delivery]');
  const cartDiscount = document.querySelector('[data-cart-discount]');
  const cartProductsLabel = document.querySelector('[data-cart-products-label]');
  const cartInstallMin = document.querySelector('[data-cart-install-min]');
  const baseInstallPrice = items.find((item) => item.install && item.installPrice > 0)?.installPrice || 0;
  const cartPayload = document.querySelector('[data-cart-payload]');
  const cartForm = document.querySelector('[data-cart-form]');
  const cartServices = document.querySelector('[data-cart-services]');

  if (!cartItems) return;

  cartEmpty.hidden = items.length > 0;
  cartForm.hidden = items.length === 0;
  if (cartServices) cartServices.hidden = items.length === 0;
  cartItems.innerHTML = items.map((item) => `
    <article class="cart-item" data-cart-row="${item.id}">
      <a class="cart-item-media" href="/product/${item.slug}">
        <img src="${item.image}" alt="${item.title}">
      </a>
      <div class="cart-item-copy">
        <a href="/product/${item.slug}">${item.title}</a>
        <div class="cart-item-specs">
          <span>${item.area || 25} м²</span>
          <span>${item.energy || 'A++'}</span>
          <span>${item.wifi ? 'Wi-Fi' : `${item.noise || 20} дБ`}</span>
        </div>
        <small>Монтаж: <b>${formatMoney(item.install ? item.installPrice : 0)}</b></small>
      </div>
      <strong>${formatMoney(item.price * item.quantity)}</strong>
      <div class="quantity-control">
        <button type="button" data-cart-qty="${item.id}" data-delta="-1">−</button>
        <b>${item.quantity}</b>
        <button type="button" data-cart-qty="${item.id}" data-delta="1">+</button>
      </div>
      <button class="round-icon" type="button" data-cart-remove="${item.id}" aria-label="Удалить">×</button>
    </article>
  `).join('');

  cartTotal.textContent = formatMoney(total);
  if (cartSubtotal) cartSubtotal.textContent = formatMoney(subtotal);
  if (cartInstall) cartInstall.textContent = formatMoney(installTotal);
  if (cartDelivery) cartDelivery.textContent = formatMoney(delivery);
  if (cartDiscount) cartDiscount.textContent = discount ? `− ${formatMoney(discount)}` : formatMoney(0);
  if (cartProductsLabel) cartProductsLabel.textContent = `Товары (${count})`;
  if (cartInstallMin) cartInstallMin.textContent = formatMoney(baseInstallPrice);
  cartPayload.value = JSON.stringify(items.map(({ id, quantity, install }) => ({ id, quantity, install })));
}

document.addEventListener('click', (event) => {
  const quickViewButton = event.target.closest('[data-quick-view]');
  if (quickViewButton) {
    event.preventDefault();
    openProductModal(getProductModalData(quickViewButton));
    return;
  }

  const productCard = event.target.closest('[data-product-card]');
  if (productCard && !event.target.closest('button, input, select, textarea, label')) {
    event.preventDefault();
    openProductModal(getProductModalData(productCard));
    return;
  }

  const productLink = event.target.closest('a[href^="/product/"]');
  if (productLink && productModal) {
    event.preventDefault();
    openProductModalFromLink(productLink);
    return;
  }

  const compareButton = event.target.closest('[data-compare-id]');
  if (compareButton) {
    const id = Number(compareButton.dataset.compareId);
    const ids = getCompare();
    setCompare(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
    return;
  }

  const addButton = event.target.closest('[data-cart-add]');
  if (addButton) {
    const productData = { ...(addButton.closest('[data-product-card]')?.dataset || {}), ...addButton.dataset };
    const item = {
      id: Number(productData.id),
      title: productData.title,
      slug: productData.slug,
      price: Number(productData.price),
      installPrice: Number(productData.installPrice),
      image: productData.image,
      brand: productData.brand,
      area: productData.area,
      energy: productData.energy,
      noise: productData.noise,
      wifi: productData.wifi === 'true' || productData.wifi === '1',
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

  const serviceToggle = event.target.closest('[data-service-toggle]');
  if (serviceToggle) {
    serviceToggle.closest('.cart-service-card')?.classList.toggle('selected', serviceToggle.checked);
    updateCartUi();
  }

  const checkoutButton = event.target.closest('[data-cart-checkout]');
  if (checkoutButton) {
    const form = checkoutButton.closest('form');
    const fields = form?.querySelector('[data-cart-contact-fields]');
    if (fields?.hidden) {
      fields.hidden = false;
      checkoutButton.innerHTML = 'Перейти к оплате <span>→</span>';
      fields.querySelector('input')?.focus();
      return;
    }
    form?.requestSubmit();
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

const productModal = document.querySelector('[data-product-modal]');
const modalImage = document.querySelector('[data-modal-image]');
const modalZoom = document.querySelector('[data-modal-zoom]');
const modalCartButton = document.querySelector('[data-modal-cart]');
const modalCompareLink = document.querySelector('[data-modal-compare]');

function getProductModalData(trigger) {
  const card = trigger.closest('[data-product-card]');
  return { ...(card?.dataset || {}), ...trigger.dataset };
}

async function openProductModalFromLink(link) {
  const slug = link.getAttribute('href')?.split('/product/')[1]?.split(/[?#]/)[0];
  if (!slug) return;

  try {
    const response = await fetch(`/api/products/${slug}`);
    if (!response.ok) return;
    openProductModal(await response.json());
  } catch {
    window.location.href = link.href;
  }
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value || '';
}

function openProductModal(data) {
  if (!productModal) return;

  const price = Number(data.price || 0);
  const installPrice = Number(data.installPrice || 0);
  const compareIds = getCompare().filter((id) => id !== Number(data.id));
  const modalCompareIds = [...compareIds, Number(data.id)].slice(-2);

  setText('[data-modal-brand]', data.brand);
  setText('[data-modal-title]', data.title);
  setText('[data-modal-description]', data.description);
  setText('[data-modal-price]', formatMoney(price));
  setText('[data-modal-install]', `монтаж от ${formatMoney(installPrice)}`);
  setText('[data-modal-color-name]', 'Белый');

  if (modalImage) {
    modalImage.src = data.image;
    modalImage.alt = data.title;
  }

  const specs = document.querySelector('[data-modal-specs]');
  if (specs) {
    specs.innerHTML = [
      ['icon-ruler', 'Площадь', data.area ? `до ${data.area} м²` : 'под задачу'],
      ['icon-circle', 'Мощность', data.power ? `${data.power} кВт` : 'рассчитаем'],
      ['icon-wave', 'Шум', data.noise ? `${data.noise} дБ` : 'тихий режим'],
      ['icon-star-line', 'Класс', data.energy || 'A+']
    ].map(([icon, label, value]) => `
      <div>
        <span class="ui-icon ${icon}"></span>
        <small>${label}</small>
        <strong>${value}</strong>
      </div>
    `).join('');
  }

  if (modalCartButton) {
    Object.assign(modalCartButton.dataset, {
      id: data.id,
      title: data.title,
      slug: data.slug,
      price: data.price,
      installPrice: data.installPrice,
      image: data.image,
      brand: data.brand
    });
  }

  if (modalCompareLink) {
    modalCompareLink.href = `/compare?ids=${modalCompareIds.join(',')}`;
  }

  productModal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeProductModal() {
  if (!productModal) return;
  productModal.hidden = true;
  document.body.classList.remove('modal-open');
  modalZoom?.classList.remove('zoomed');
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-modal-close]')) {
    closeProductModal();
  }

  const colorButton = event.target.closest('[data-color-name]');
  if (colorButton) {
    document.querySelectorAll('[data-color-name]').forEach((button) => button.classList.remove('active'));
    colorButton.classList.add('active');
    setText('[data-modal-color-name]', colorButton.dataset.colorName);
    modalZoom?.style.setProperty('--modal-accent', colorButton.dataset.color);
  }
});

modalZoom?.addEventListener('click', () => {
  modalZoom.classList.toggle('zoomed');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeProductModal();
});
