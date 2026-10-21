export interface MenuButton {
  label: string;
  run: () => void;
  disabled?: boolean;
}

export class Menu {
  private el = document.getElementById('menu')!;

  get open() {
    return this.el.style.display === 'flex';
  }

  show(title: string, buttons: MenuButton[], sub = '') {
    this.el.innerHTML = '';
    const h = document.createElement('h1');
    h.textContent = title;
    this.el.appendChild(h);
    if (sub) {
      const p = document.createElement('p');
      p.textContent = sub;
      this.el.appendChild(p);
    }
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.disabled = !!b.disabled;
      btn.addEventListener('click', b.run);
      this.el.appendChild(btn);
    }
    this.el.style.display = 'flex';
    this.el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  hide() {
    this.el.style.display = 'none';
  }
}
