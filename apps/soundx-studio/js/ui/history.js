/**
 * Undo stack for panel layout and the last mix change.
 * One step undoes the most recent of either.
 */
export function createHistory(toast) {
  const stack = [];
  const api = {
    applying: false,
    push(entry) {
      if (this.applying || !entry) return;
      stack.push(entry);
      if (stack.length > 40) stack.shift();
    },
    undo() {
      const entry = stack.pop();
      if (!entry) {
        toast('Nothing to undo');
        return false;
      }
      this.applying = true;
      try {
        entry.undo();
      } finally {
        this.applying = false;
      }
      toast(entry.label || 'Undone');
      return true;
    },
  };
  return api;
}

export function mixChanged(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}
