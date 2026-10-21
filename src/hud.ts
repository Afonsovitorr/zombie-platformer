export class Hud {
  private hearts = document.getElementById('hearts')!;
  private bar = document.querySelector<HTMLElement>('#stamina i')!;
  private souls = document.getElementById('souls')!;
  private msg = document.getElementById('msg')!;
  private toastEl = document.getElementById('toast')!;
  private toastTimer = 0;
  private last = '';

  set(hp: number, maxHp: number, stamina: number, maxStamina: number, souls: number) {
    const hearts = '♥'.repeat(Math.max(0, hp)) + '♡'.repeat(Math.max(0, maxHp - hp));
    if (hearts !== this.last) {
      this.hearts.textContent = hearts;
      this.last = hearts;
    }
    this.bar.style.width = `${(stamina / maxStamina) * 100}%`;
    this.bar.style.background = stamina < 25 ? '#f59e0b' : '#4ade80';
    this.souls.textContent = `Almas: ${souls}`;
  }

  message(title: string | null, sub = '') {
    if (!title) {
      this.msg.style.display = 'none';
      return;
    }
    this.msg.innerHTML = `${title}<small>${sub}</small>`;
    this.msg.style.display = 'flex';
  }

  toast(text: string) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.style.opacity = '0'), 2200);
  }
}
