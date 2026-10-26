import type { CategorySlug, TextureId } from "@/commerce/types";
import type { ProductSummary } from "@/commerce/summary";

/**
 * Squish Personality Quiz — a light, just-for-fun preference quiz.
 * No medical or mood claims. Results map to a texture style and a collection,
 * and recommendations only ever come from the real catalog (preview samples
 * are labelled as such where they're shown).
 */
export interface QuizOption {
  id: string;
  label: string;
  emoji: string;
  textures?: Partial<Record<TextureId, number>>;
  collections?: Partial<Record<CategorySlug, number>>;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: "speed",
    prompt: "Pick your perfect squeeze",
    options: [
      { id: "pop", label: "A quick squeeze that pops right back", emoji: "⚡", textures: { soft: 2, jelly: 1 } },
      { id: "slow", label: "Squish it flat and watch it rise", emoji: "🐢", textures: { "slow-rise": 3 } },
      { id: "crunch", label: "Something I can hear crunch", emoji: "🍪", textures: { crunchy: 3 } },
      { id: "wobble", label: "Wiggly, bouncy, jiggly", emoji: "🫧", textures: { jelly: 3 } },
      { id: "sink", label: "Slow and smooth, like soft butter", emoji: "🧈", textures: { buttery: 3 } },
    ],
  },
  {
    id: "snack",
    prompt: "Your dream snack-shop order?",
    options: [
      { id: "slushie", label: "An icy fruit slushie", emoji: "🥤", collections: { "fruity-slushies": 3 }, textures: { soft: 1 } },
      { id: "gummies", label: "A bag of gummy bears", emoji: "🐻", collections: { "jelly-squishies": 3 }, textures: { jelly: 1 } },
      { id: "donut", label: "A sprinkle donut", emoji: "🍩", collections: { "crunchy-squishies": 3 }, textures: { crunchy: 1 } },
      { id: "cookie", label: "A warm butter cookie", emoji: "🍪", collections: { "crunchy-squishies": 1 }, textures: { buttery: 2 } },
      { id: "surprise", label: "Surprise me!", emoji: "🎁", collections: { "cute-collectibles": 3 } },
    ],
  },
  {
    id: "sound",
    prompt: "Which sound makes you smile?",
    options: [
      { id: "snow", label: "Crunchy footsteps in fresh snow", emoji: "❄️", textures: { crunchy: 2 } },
      { id: "boing", label: "A bouncy “boing!”", emoji: "🎈", textures: { jelly: 2 } },
      { id: "pillow", label: "A soft pillow “fwump”", emoji: "☁️", textures: { soft: 2 } },
      { id: "quiet", label: "Total quiet — just vibes", emoji: "🌙", textures: { "slow-rise": 1, buttery: 1 } },
    ],
  },
  {
    id: "home",
    prompt: "Where would your squishy hang out?",
    options: [
      { id: "desk", label: "On my desk, keeping me company", emoji: "🖥️", textures: { buttery: 1, "slow-rise": 1 } },
      { id: "shelf", label: "On a shelf with the whole collection", emoji: "🧸", collections: { "cute-collectibles": 2 } },
      { id: "hand", label: "In my hand, all day long", emoji: "✋", textures: { soft: 1, jelly: 1 } },
      { id: "bag", label: "Riding along in my backpack", emoji: "🎒", collections: { "cute-collectibles": 1 }, textures: { soft: 1 } },
    ],
  },
  {
    id: "color",
    prompt: "Pick a color mood",
    options: [
      { id: "berry", label: "Berry pink", emoji: "🍓", collections: { "fruity-slushies": 2 } },
      { id: "sky", label: "Sky blue", emoji: "💙", collections: { "jelly-squishies": 1 }, textures: { soft: 1 } },
      { id: "lemon", label: "Sunny lemon", emoji: "🍋", collections: { "crunchy-squishies": 1 }, textures: { crunchy: 1 } },
      { id: "mint", label: "Minty fresh", emoji: "🌿", collections: { "cute-collectibles": 2 } },
      { id: "peach", label: "Peachy sunset", emoji: "🍑", textures: { "slow-rise": 1, buttery: 1 } },
    ],
  },
  {
    id: "surprise",
    prompt: "How do you like your surprises?",
    options: [
      { id: "mystery", label: "Mystery capsules, please!", emoji: "🔮", collections: { "cute-collectibles": 3 } },
      { id: "see", label: "I like to see exactly what I get", emoji: "🔍", collections: { "jelly-squishies": 1 }, textures: { jelly: 1 } },
      { id: "slowreveal", label: "A slow, dramatic reveal", emoji: "🎬", textures: { "slow-rise": 2 } },
      { id: "fresh", label: "A fresh, fruity twist", emoji: "🍹", collections: { "fruity-slushies": 2 } },
    ],
  },
];

export interface QuizPersonality {
  texture: TextureId;
  title: string;
  blurb: string;
}

export const personalities: Record<TextureId, QuizPersonality> = {
  soft: {
    texture: "soft",
    title: "Cloud Cuddler",
    blurb: "Easygoing and always up for a squeeze. You like your squishies light, pillowy and quick to bounce back — just like you.",
  },
  "slow-rise": {
    texture: "slow-rise",
    title: "Slow-Rise Dreamer",
    blurb: "You're patient, chill and love a good slow reveal. Squish it flat, sit back and watch the magic happen.",
  },
  jelly: {
    texture: "jelly",
    title: "Jelly Jiggler",
    blurb: "Bouncy, bright and a little bit extra. You love anything glossy and wobbly that jiggles back for more.",
  },
  crunchy: {
    texture: "crunchy",
    title: "Crunch Champion",
    blurb: "You want to hear it AND feel it. Every squeeze should come with a satisfying crunch.",
  },
  buttery: {
    texture: "buttery",
    title: "Butter Buddy",
    blurb: "Smooth, calm and cozy. You love the slow, velvety sink of a dense, buttery squish.",
  },
};

export type QuizAnswers = Record<string, string>;

const TEXTURE_ORDER: TextureId[] = ["jelly", "crunchy", "soft", "slow-rise", "buttery"];
const COLLECTION_ORDER: CategorySlug[] = ["jelly-squishies", "crunchy-squishies", "fruity-slushies", "cute-collectibles"];

/** Natural collection for each texture (used when collection scores tie at zero). */
const TEXTURE_COLLECTION: Record<TextureId, CategorySlug> = {
  jelly: "jelly-squishies",
  crunchy: "crunchy-squishies",
  soft: "fruity-slushies",
  "slow-rise": "cute-collectibles",
  buttery: "crunchy-squishies",
};

export interface QuizResult {
  texture: TextureId;
  collection: CategorySlug;
  textureScores: Record<TextureId, number>;
}

function best<K extends string>(scores: Record<K, number>, order: K[]): K {
  return order.reduce((top, k) => (scores[k] > scores[top] ? k : top), order[0]);
}

/** Scores answers. Unknown question/option ids are ignored. Ties break in a fixed order. */
export function scoreQuiz(answers: QuizAnswers): QuizResult {
  const textureScores = Object.fromEntries(TEXTURE_ORDER.map((t) => [t, 0])) as Record<TextureId, number>;
  const collectionScores = Object.fromEntries(COLLECTION_ORDER.map((c) => [c, 0])) as Record<CategorySlug, number>;

  for (const q of quizQuestions) {
    const option = q.options.find((o) => o.id === answers[q.id]);
    if (!option) continue;
    for (const [t, n] of Object.entries(option.textures ?? {})) textureScores[t as TextureId] += n ?? 0;
    for (const [c, n] of Object.entries(option.collections ?? {})) collectionScores[c as CategorySlug] += n ?? 0;
  }

  const texture = best(textureScores, TEXTURE_ORDER);
  const anyCollection = Object.values(collectionScores).some((n) => n > 0);
  const collection = anyCollection ? best(collectionScores, COLLECTION_ORDER) : TEXTURE_COLLECTION[texture];
  return { texture, collection, textureScores };
}

export function isComplete(answers: QuizAnswers) {
  return quizQuestions.every((q) => q.options.some((o) => o.id === answers[q.id]));
}

/** Picks catalog items for a result: texture matches first, then the collection. */
export function recommend(products: ProductSummary[], texture: TextureId, collection: CategorySlug, limit = 4) {
  return products
    .map((p) => ({ p, score: (p.textures.includes(texture) ? 2 : 0) + (p.category === collection ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}
