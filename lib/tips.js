// Tip of the week. A new one every Monday, in Jordan's voice. Some come with a one-tap request.
// Intellectual property of Sidedoor Digital.

export const TIPS = [
  { title: 'Ask for reviews at the till', body: "Most happy customers would leave a review if someone asked. A small card by the card machine with a QR code that goes straight to your Google review box does the asking for you.", action: { label: 'Get me a review QR card', title: 'Google review QR card for the counter' } },
  { title: 'Reply to every review', body: "Good or bad, reply within a couple of days. People reading reviews look at how you answer the bad ones more than the bad review itself. Keep it short, thank them, and offer to put it right." },
  { title: 'Bank holiday hours', body: "Google shows your opening hours before people ever reach your site. If they're wrong on a bank holiday, you lose the visit. Update your Google profile a week before any change.", action: { label: 'Put special hours on my site', title: 'Special opening hours banner' } },
  { title: 'A photo a week', body: "Businesses that add photos to their Google profile get noticeably more clicks. Snap something new each week: a fresh display, a busy Saturday, a new product." },
  { title: 'Make the number tappable', body: "On a phone, people want to tap your number and ring. If they have to copy it, a lot of them won't. Check yours on your own phone today." },
  { title: 'Show your prices', body: "People quietly skip places that hide prices. Even a 'from' price helps them decide to come in rather than keep scrolling.", action: { label: 'Add prices to my site', title: 'Add prices to the site' } },
  { title: 'Reshare your customers', body: "When someone tags you on Instagram, reshare it to your story. It's free content, it thanks them, and it tells everyone else real people love the place." },
  { title: 'Name things how people search', body: "Google reads your words. 'Pick and mix in Southport' gets found, 'Our range' doesn't. Write the way your customers would type it into a search." },
  { title: 'Give a reason to sign up', body: "Nobody joins a mailing list for news. They join for a birthday treat, early access or a members' price. Give them the reason and the list builds itself." },
  { title: 'Be your own customer', body: "Once a week, open your site on your phone and try to do the thing customers do: book, buy, find you. If anything is fiddly, tell me and I'll sort it.", action: { label: 'Something felt fiddly', title: 'Something on my site felt fiddly' } },
  { title: 'One clear next step', body: "Every page should have one obvious thing to do next. Book, order, call. When there are five buttons, people often press none of them." },
  { title: 'Seasonal changes early', body: "Google takes a few weeks to notice changes. Put Christmas, Easter or summer offers up three or four weeks before, not the week of. The Ideas list in the app does this for you." },
  { title: 'Same details everywhere', body: "Your business name, address and phone should match exactly on Google, Facebook, directories and your site. Mismatches quietly push you down in local results." },
  { title: 'Answer the questions you get asked', body: "If customers keep asking the same things, put the answers on your site. It saves you time and Google loves pages that answer real questions.", action: { label: 'Add a questions page', title: 'Add a frequently asked questions section' } },
  { title: "Don't pay that renewal email", body: "Scam emails saying your domain is about to expire are everywhere. Your domain is looked after with me. If one turns up, ignore it, or forward it to me if you're not sure." },
  { title: 'A password manager', body: "Using the same password everywhere is the single biggest risk for small businesses. A password manager remembers them all, so each one can be different and long." },
  { title: 'Two-step login', body: "Turn on two-step login for your email and social accounts. Even if someone gets your password, they can't get in without your phone. Ten minutes, well worth it." },
  { title: 'Say thanks after they buy', body: "A short thank-you message after a purchase or visit brings people back. It doesn't need a discount, just a human note." },
  { title: 'Team up locally', body: "Businesses near you share your customers. A joint offer or a shout-out swap costs nothing. The Sidedoor network is there for exactly this.", link: { label: 'Open the network', url: '#/network' } },
  { title: 'Ask where they heard about you', body: "A quick 'how did you find us?' at the till tells you what's working. Do it for a fortnight and you'll know where to put your effort." },
  { title: 'Fill the quiet days', body: "Pick your quietest day and give people a reason to come then. Post it that morning, not the night before. Small, regular offers beat one big sale." },
  { title: 'Real photos win', body: "Stock photos look like stock photos. Your own place, your own products and your own people, even on a phone, feel more trustworthy.", action: { label: 'Swap in my own photos', title: 'Swap stock photos for our own' } },
  { title: 'Link your bios', body: "Every social profile should link to your site, not just list a phone number. That's how people go from looking to booking or buying." },
  { title: 'Ask your regulars', body: "Your regulars know what's missing. Ask three of them what one thing would make them come more often. Small changes they suggest build real loyalty." },
  { title: 'Post your events on Google', body: "Google lets you post events and offers on your profile. They show right in search results, free. Use it for anything with a date on it." },
  { title: "Most changes take under an hour", body: "Small tweaks add up. Seasonal banners, new photos, price changes: most of them are quick, quoted first, and never more than the quote. Just send it through.", link: { label: 'Ask for a change', url: '#/requests/new' } }
];

// ISO week number, so everyone sees the same tip and it changes on Mondays.
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((t - year) / 864e5 + 1) / 7), year: t.getUTCFullYear() };
}

export function tipOfTheWeek(date = new Date()) {
  const { week, year } = isoWeek(date);
  const i = (year * 53 + week) % TIPS.length;
  return { index: i, week, ...TIPS[i] };
}

// This week's and the ones before it, newest first.
export function recentTips(n = 8, date = new Date()) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(tipOfTheWeek(new Date(date - k * 7 * 864e5)));
  return out;
}
