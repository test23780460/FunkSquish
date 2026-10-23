/**
 * FAQ content. `pending: true` marks answers that are still undecided —
 * they show a "Coming soon" badge. Update these as decisions are made.
 */
export interface FaqItem {
  q: string;
  a: string;
  pending?: boolean;
}

export interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

export const faqGroups: FaqGroup[] = [
  {
    id: "about",
    title: "About FunkSquish",
    items: [
      {
        q: "What is FunkSquish?",
        a: "FunkSquish is a brand-new small business for squishy toys — colorful fruit slushies, jelly squishies, crunchy squishies, and cute collectibles. We're getting ready to launch.",
      },
      {
        q: "Can I buy squishies right now?",
        a: "Not yet. We're still choosing our first collection and don't have any products for sale. The items in our shop preview are illustrated samples, not real inventory.",
      },
      {
        q: "Where can I follow along?",
        a: "TikTok is the best place! Follow @FunkSquish for launch news, sneak peeks, and our upcoming LIVEs.",
      },
    ],
  },
  {
    id: "launch",
    title: "Launch",
    items: [
      {
        q: "When does the shop open?",
        a: "We don't have a launch date yet. We'll announce it on TikTok as soon as our first collection is ready.",
        pending: true,
      },
      {
        q: "Which squishies will you carry?",
        a: "We're planning four collections: Fruity Slushies, Jelly Squishies, Crunchy Squishies, and Cute Collectibles. Exact designs will be shared closer to launch.",
      },
      {
        q: "Will you sell on TikTok Shop?",
        a: "We're exploring it. We'll share how and where you can shop once it's decided.",
        pending: true,
      },
    ],
  },
  {
    id: "orders",
    title: "Pricing, shipping & returns",
    items: [
      {
        q: "How much will squishies cost?",
        a: "Pricing hasn't been set yet. Prices will be listed on each product when the shop opens.",
        pending: true,
      },
      {
        q: "Where do you ship, and how much does shipping cost?",
        a: "Shipping regions, rates, and processing times are still being decided. A draft of our shipping policy is on the Shipping page, and the final details will be published before launch. Shipping costs are always shown at checkout before you pay.",
        pending: true,
      },
      {
        q: "What is your return policy?",
        a: "Our returns and exchanges policy is still being decided. A draft is on the Returns page, and the final policy will be published before the shop opens.",
        pending: true,
      },
      {
        q: "Which payment methods will you accept?",
        a: "Checkout will be handled by an established, secure payment provider. Accepted payment methods will be listed at launch.",
        pending: true,
      },
    ],
  },
  {
    id: "products",
    title: "Squishies",
    items: [
      {
        q: "Who are your squishies for?",
        a: "We'll share product details — including sizes, materials, and age guidance — for each squishy when it's listed. Please check each product page before buying.",
        pending: true,
      },
      {
        q: "Can I heat or microwave a squishy?",
        a: "No — never heat or microwave a squishy. Heated squishies can burst and cause serious burns. Our Product care & safety page has more tips, based on guidance from the U.S. Consumer Product Safety Commission.",
      },
      {
        q: "Will your squishies be safety tested?",
        a: "We will only sell children's toys that come with the required U.S. safety documentation, including a Children's Product Certificate based on testing by a CPSC-accepted lab. Each product page will show its age grading and warnings exactly as they appear on the label.",
        pending: true,
      },
      {
        q: "Are the products in the shop preview real?",
        a: "No. They're illustrations we made to show how the shop will look. Real products will have real photos and full details.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    items: [
      {
        q: "How can I contact you?",
        a: "Email us at travis@funksquish.com, or message @FunkSquish on TikTok.",
      },
      {
        q: "I'm a supplier or creator. Who do I talk to?",
        a: "We'd love to hear from you! Email travis@funksquish.com with a little about yourself.",
      },
    ],
  },
];
