// Things that can be bought for coins to decorate a profile.
// The css strings are fixed here (users never send css), and are applied on
// the profile page: `bg` = background, `font` = font, `frame` = frame.
const ITEMS = [
  // backgrounds
  { id: 'bg_ocean', type: 'bg', name: 'Океан', price: 80,
    css: 'background:linear-gradient(135deg,#0b1f3a,#12406b 55%,#0f766e);' },
  { id: 'bg_violet', type: 'bg', name: 'Фиолетовая ночь', price: 80,
    css: 'background:linear-gradient(135deg,#1e1038,#3b1a6b 55%,#6d28d9);' },
  { id: 'bg_sunset', type: 'bg', name: 'Закат', price: 120,
    css: 'background:linear-gradient(135deg,#3b0a1e,#9f1239 50%,#f59e0b);' },
  { id: 'bg_matrix', type: 'bg', name: 'Матрица', price: 150,
    css: 'background:linear-gradient(180deg,#020a04,#052e16);' },
  // fonts (system fonts only, nothing is downloaded)
  { id: 'font_mono', type: 'font', name: 'Моно', price: 50,
    css: "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace;" },
  { id: 'font_serif', type: 'font', name: 'С засечками', price: 50,
    css: "font-family:Georgia,'Times New Roman',serif;" },
  { id: 'font_round', type: 'font', name: 'Округлый', price: 60,
    css: "font-family:'Trebuchet MS','Segoe UI',Verdana,sans-serif;" },
  { id: 'font_hand', type: 'font', name: 'Рукописный', price: 70,
    css: "font-family:'Comic Sans MS','Comic Neue','Segoe Print',cursive;" },
  // frames
  { id: 'frame_double', type: 'frame', name: 'Двойная рамка', price: 100,
    css: 'border:3px double #e5e7eb;border-radius:22px;' },
  { id: 'frame_gold', type: 'frame', name: 'Золото', price: 160,
    css: 'border:2px solid #f5c542;box-shadow:0 0 24px rgba(245,197,66,.35);border-radius:22px;' },
  { id: 'frame_rose', type: 'frame', name: 'Роза', price: 160,
    css: 'border:2px solid #f472b6;box-shadow:0 0 26px rgba(244,114,182,.4);border-radius:22px;' },
  { id: 'frame_neon', type: 'frame', name: 'Неон', price: 200,
    css: 'border:2px solid #22d3ee;box-shadow:0 0 28px rgba(34,211,238,.45),inset 0 0 18px rgba(34,211,238,.15);border-radius:22px;' },
];

const TYPES = ['bg', 'font', 'frame'];

function findItem(id) {
  return ITEMS.find((i) => i.id === id) || null;
}

// css for a saved item id (or null)
function cssFor(id) {
  const item = id ? findItem(id) : null;
  return item ? item.css : null;
}

// Coins economy
const REWARDS = {
  daily: 20, // once every 24 hours
  profileApproved: 100, // first time a profile is approved
  reviewApproved: 30, // when a moderator approves a review you wrote
};

module.exports = { ITEMS, TYPES, findItem, cssFor, REWARDS };
