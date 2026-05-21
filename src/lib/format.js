export function money(value) {
  return new Intl.NumberFormat('ru-BY').format(value) + ' BYN';
}

export function leadStatusLabel(status) {
  return {
    NEW: 'Новая',
    CONTACTED: 'Связались',
    MEASURED: 'Замер',
    QUOTED: 'Смета',
    WON: 'Продажа',
    LOST: 'Отказ'
  }[status] || status;
}

export function orderStatusLabel(status) {
  return {
    PENDING: 'Ожидает оплаты',
    PAID: 'Оплачен',
    CANCELLED: 'Отменен'
  }[status] || status;
}

