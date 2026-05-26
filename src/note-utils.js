/** Nota birleştirme, üst üste binenleri tekilleştirme */
const NoteUtils = (() => {
  function mergeAdjacentNotes(notes, maxGapSec = 0.15) {
    if (!notes?.length) return [];
    const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
    const out = [];

    for (const n of sorted) {
      const last = out[out.length - 1];
      const end = last ? last.time + last.duration : 0;
      if (
        last &&
        last.midi === n.midi &&
        n.time - end <= maxGapSec
      ) {
        const newEnd = Math.max(end, n.time + (n.duration || 0));
        last.duration = Math.max(0.06, newEnd - last.time);
        last.velocity = Math.max(last.velocity || 0, n.velocity || 0);
        continue;
      }
      out.push({
        midi: n.midi,
        time: n.time,
        duration: Math.max(0.06, n.duration || 0.1),
        velocity: n.velocity ?? 0.75,
        name: n.name,
      });
    }
    return out;
  }

  /** Aynı perdede çakışan aralıkları birleştir */
  function mergeOverlappingSamePitch(notes) {
    const groups = new Map();
    for (const n of notes) {
      if (!groups.has(n.midi)) groups.set(n.midi, []);
      groups.get(n.midi).push(n);
    }
    const out = [];
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.time - b.time);
      let cur = { ...arr[0] };
      for (let i = 1; i < arr.length; i++) {
        const n = arr[i];
        const curEnd = cur.time + cur.duration;
        if (n.time < curEnd + 0.04) {
          const newEnd = Math.max(curEnd, n.time + n.duration);
          cur.duration = newEnd - cur.time;
          cur.velocity = Math.max(cur.velocity || 0, n.velocity || 0);
        } else {
          out.push(cur);
          cur = { ...n };
        }
      }
      out.push(cur);
    }
    return out.sort((a, b) => a.time - b.time || a.midi - b.midi);
  }

  function cleanupNotes(notes, minDuration = 0.08) {
    let list = mergeAdjacentNotes(notes, 0.18);
    list = mergeOverlappingSamePitch(list);
    list = mergeAdjacentNotes(list, 0.12);
    return list.filter((n) => (n.duration || 0) >= minDuration);
  }

  return { mergeAdjacentNotes, mergeOverlappingSamePitch, cleanupNotes };
})();

window.NoteUtils = NoteUtils;
