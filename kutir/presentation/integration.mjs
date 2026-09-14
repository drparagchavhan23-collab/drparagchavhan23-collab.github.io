// Anchor positions are in the tuner's 1400 × 700 drawing coordinates.
const spaces = [
  { name: 'Sloping roof', lines: ['Sheds heavy rain and', 'possible mountain snow', 'in Sikkim.'], point: [477, 95], side: 'left', row: .20 },
  { name: 'Upper bedroom', lines: ['Private space beneath', 'the sloping roof.'], point: [640, 216], side: 'right', row: .23 },
  { name: 'Personal room', lines: ['Bedroom, work desk', 'and a small library by', 'the large window.'], point: [436, 258], side: 'left', row: .39 },
  { name: 'Stair core', lines: ['The vertical connection', 'between every level.'], point: [613, 321], side: 'right', row: .47 },
  { name: 'Kitchen + dining', lines: ['Everyday cooking,', 'eating and gathering.'], point: [449, 369], side: 'left', row: .59 },
  { name: 'Fashion studio', lines: ["The fashion designer's", 'workspace for making', 'and production.'], point: [477, 490], side: 'left', row: .79 },
  { name: 'Garden annex', lines: ['An exterior room', 'at the garden edge.'], point: [940, 400], side: 'right', row: .71 },
];
const ns = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('spaceAnnotations');
const make = (tag, attrs, text) => {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
};
svg.replaceChildren(...spaces.map((space, i) => {
  const group = make('g', { class: 'annotation' });
  group.append(make('path', { class: 'leader', pathLength: 180 }), make('circle', { r: 4 }),
    make('text', { class: 'pin' }, String(i + 1)), make('text', { class: 'name' }, space.name),
    ...space.lines.map(line => make('text', { class: 'description' }, line)));
  return group;
}));
const legend = document.createElement('ol');
legend.id = 'mobileLegend';
legend.setAttribute('aria-label', 'Rooms in the drawing');
for (const space of spaces) {
  const li = document.createElement('li');
  const title = document.createElement('strong'); title.textContent = space.name;
  const text = document.createElement('span'); text.textContent = space.lines.join(' ');
  li.append(title, text); legend.append(li);
}
svg.after(legend);
document.querySelectorAll('a[href="../tuner/"]').forEach(link => link.remove());
const back = document.getElementById('closeProject');
back.textContent = '← Back to room'; back.setAttribute('aria-label', 'Back to room');

export function layoutAnnotations() {
  const rect = document.getElementById('front').getBoundingClientRect();
  const bounds = svg.getBoundingClientRect();
  const w = bounds.width, h = bounds.height;
  const narrow = w <= 700;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  for (const [i, group] of [...svg.children].entries()) {
    const space = spaces[i];
    const tx = rect.left - bounds.left + rect.width * space.point[0] / 1400;
    const ty = rect.top - bounds.top + rect.height * space.point[1] / 700;
    const gutter = Math.min(190, w * .19);
    const x = space.side === 'left' ? 24 : w - gutter - 24;
    const y = Math.max(94, h * space.row);
    const endX = space.side === 'left' ? x + gutter : x - 14;
    const endY = y + 12;
    const elbow = endX + (tx - endX) * .42;
    const [path, circle, pin, title, ...lines] = group.children;
    path.setAttribute('d', `M ${tx} ${ty} L ${elbow} ${endY} L ${endX} ${endY}`);
    path.style.display = narrow ? 'none' : '';
    circle.setAttribute('cx', tx); circle.setAttribute('cy', ty);
    pin.setAttribute('x', tx); pin.setAttribute('y', ty + 3);
    title.setAttribute('x', x); title.setAttribute('y', y);
    lines.forEach((line, j) => { line.setAttribute('x', x); line.setAttribute('y', y + 23 + j * 17); });
  }
}
