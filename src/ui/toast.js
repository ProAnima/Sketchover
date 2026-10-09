// Короткое сообщение внизу экрана: подсказка или ошибка.
const box = document.querySelector('#toast');
let timer = 0;

export function showToast(text, { sticky = false } = {}) {
  box.textContent = text;
  box.hidden = false;
  clearTimeout(timer);
  if (!sticky) timer = setTimeout(hideToast, 3000);
}

export function hideToast() {
  box.hidden = true;
}
