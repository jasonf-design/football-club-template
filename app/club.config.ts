/**
 * Club configuration — edit this file to set up your football club website.
 *
 * This is the main file to change when rebranding for a new club.
 * After editing, also:
 *   1. Replace public/crest-128.avif, .webp, .png with your club crest (128×128px)
 *   2. Replace public/favicon.ico, favicon-32.png, apple-touch-icon.png
 *   3. Update brand colours in app/app.css (@theme block):
 *      --color-navy = your primary colour
 *      --color-sky  = your secondary colour
 *      (class names throughout the app stay the same — just change the hex values)
 *   4. Configure your environment variables (copy .env.example to .env)
 *
 * See SETUP.md for the full setup walkthrough.
 */
export const club = {
  name: {
    /** Full legal name: e.g. "Riverside City Football Club" */
    full: "Riverside City Football Club",
    /** All-caps display name for header/footer: e.g. "RIVERSIDE CITY FC" */
    display: "RIVERSIDE CITY FC",
    /** All-caps short display (header): e.g. "RIVERSIDE CITY" */
    displayShort: "RIVERSIDE CITY",
    /** Short name used in meta titles: e.g. "Riverside City FC" */
    short: "Riverside City FC",
    /** Abbreviation for compact UI (admin sidebar): e.g. "RCFC" */
    abbreviation: "RCFC",
    /** City name used in hero heading: e.g. "Riverside" */
    city: "Riverside",
    /** Club tagline shown in footer */
    tagline: "Built by the community, for the community.",
    /** Year founded */
    established: "2024",
  },

  hero: {
    /** Subtitle paragraph on the home page hero */
    subtitle:
      "Built by supporters, played for the city. Follow the journey through every kick-off, every result, and every story along the way.",
  },

  social: {
    /** Set any to null to hide that platform in the footer */
    twitter: null as string | null,
    instagram: null as string | null,
    facebook: null as string | null,
    tiktok: null as string | null,
    youtube: null as string | null,
    bluesky: null as string | null,
  },

  contact: {
    /** Email addresses that receive contact-form notifications */
    adminEmails: ["admin@yourclub.com"],
  },

  fwp: {
    /**
     * Football Web Pages team ID for fixture/result sync.
     * Find yours at footballwebpages.co.uk — search your club and note the
     * team ID in the URL. Set to 0 to disable sync until you have your ID.
     */
    teamId: 0,
  },

  fundraising: {
    /**
     * easyfundraising.org.uk campaign URL for your club.
     * Set to null to hide the fundraising block in the footer.
     */
    easyfundraisingUrl: null as string | null,
  },

  /** Canonical public URL — also set via PUBLIC_URL env var on the server */
  siteUrl: "https://yourclub.com",

  session: {
    /** Browser cookie name — use your club abbreviation, e.g. "__rcfc_session" */
    cookieName: "__rcfc_session",
    /** localStorage key for the cart */
    cartKey: "rcfc.cart.v1",
    /** CustomEvent name fired when the cart changes */
    cartEvent: "rcfc:cart-changed",
  },

  theme: {
    /**
     * Primary brand colour for <meta name="theme-color">.
     * Must match --color-navy in app/app.css.
     */
    metaThemeColor: "#0e1f44",
  },
};
