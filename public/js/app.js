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

const getCompare = () => {
  try {
    return JSON.parse(localStorage.getItem('compareIds') || '[]');
  } catch {
    return [];
  }
};

const setCompare = (ids) => {
  localStorage.setItem('compareIds', JSON.stringify(ids.slice(0, 4)));
  updateCompareUi();
};

function updateCompareUi() {
  const ids = getCompare();
  document.querySelectorAll('[data-compare-id]').forEach((button) => {
    const id = Number(button.dataset.compareId);
    button.classList.toggle('selected', ids.includes(id));
    if (button.classList.contains('compare-toggle')) {
      button.setAttribute('aria-pressed', ids.includes(id) ? 'true' : 'false');
    }
  });

  document.querySelectorAll('[data-compare-link]').forEach((link) => {
    link.href = ids.length ? `/compare?ids=${ids.join(',')}` : '/compare';
    link.textContent = ids.length ? `Сравнить (${ids.length})` : 'Сравнить выбранные';
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-compare-id]');
  if (!button) return;

  const id = Number(button.dataset.compareId);
  const ids = getCompare();
  const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  setCompare(next);
});

updateCompareUi();

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

