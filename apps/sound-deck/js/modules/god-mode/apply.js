/**
 * God Mode apply helper — snapshot before mutator; restore on failure.
 *
 * Adapts to session-versions API from createSessionVersions():
 *   push(label) → snap | null
 *   restore(id) → boolean
 * (Plan draft used saveSnapshot / restoreLast — those do not exist.)
 */

/**
 * @param {object} ctx — must include sessionVersions + toast when available
 * @param {string} [label]
 * @param {() => (void|Promise<void>)} mutator
 */
export async function godApply(ctx, label, mutator) {
  const sv = ctx?.sessionVersions;
  const tag = label || 'God Mode';
  let snap = null;

  if (typeof sv?.push === 'function') {
    try {
      snap = await sv.push(tag);
      // push() skips identical states — then the newest snapshot already equals "now",
      // so it is the correct restore point for this Apply.
      if (!snap && !sv.applying && typeof sv.list === 'function') {
        const all = sv.list();
        snap = all[all.length - 1] || null;
      }
    } catch (e) {
      console.warn('[God Mode] snapshot failed', e);
    }
  }

  try {
    await mutator();
    ctx?.toast?.(`${label || 'Applied'} · undo via Restore`, 'ok');
  } catch (err) {
    console.error('[God Mode]', err);
    if (snap?.id && typeof sv?.restore === 'function') {
      try {
        await sv.restore(snap.id);
        ctx?.toast?.(err?.message || 'Apply failed — restored', 'error');
      } catch (restoreErr) {
        console.error('[God Mode] restore failed', restoreErr);
        ctx?.toast?.(
          err?.message
            ? `${err.message} · use Restore panel to undo`
            : 'Apply failed — use Restore panel to undo',
          'error',
        );
      }
    } else {
      // No snap id (duplicate/skipped push, or no sessionVersions) — do not invent restoreLast
      ctx?.toast?.(
        err?.message
          ? `${err.message} · use Restore panel to undo`
          : 'Apply failed — use Restore panel to undo',
        'error',
      );
    }
    throw err;
  }
}
