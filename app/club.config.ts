/**
 * Club configuration — edit this file to rebrand for a new football club.
 *
 * Also update the colour palette in app.css (@theme block) to match the club's
 * brand colours. The colour names (navy, sky, etc.) are semantic aliases;
 * you only need to change the hex values there, not the class names in components.
 */
export const club = {
  name: {
    /** Full legal name: "Doncaster City Football Club" */
    full: "Doncaster City Football Club",
    /** All-caps display name for header/footer: "DONCASTER CITY FC" */
    display: "DONCASTER CITY FC",
    /** All-caps short display (header): "DONCASTER CITY" */
    displayShort: "DONCASTER CITY",
    /** Short name used in meta titles: "Doncaster City FC" */
    short: "Doncaster City FC",
    /** Abbreviation for compact UI (admin sidebar): "DCFC" */
    abbreviation: "DCFC",
    /** City name used in hero heading: "Doncaster" */
    city: "Doncaster",
    /** Club tagline shown in footer */
    tagline: "Built by the community, for the community.",
    /** Year founded */
    established: "2022",
  },

  hero: {
    /** Subtitle paragraph on the home page hero */
    subtitle:
      "Built by supporters, played for the city. Follow the journey through every kick-off, every result, and every story along the way.",
  },

  social: {
    twitter: "https://x.com/doncastercityfc",
    instagram: "https://www.instagram.com/doncastercityfc",
    facebook: "https://www.facebook.com/doncastercityfc",
    tiktok: "https://www.tiktok.com/@doncastercityfc",
    youtube: "https://www.youtube.com/@DoncasterCity",
    /** Set to null to hide a platform in the footer */
    bluesky: "@doncastercityfc.bsky.social" as string | null,
  },

  contact: {
    /** Email addresses that receive contact-form notifications */
    adminEmails: [
      "jason.f@DoncasterCity-FC.com",
      "Mark@DoncasterCity-FC.com",
    ],
  },

  fwp: {
    /** Football Web Pages team ID for fixture/result sync */
    teamId: 3314,
  },

  fundraising: {
    /** Set to null to hide the easyfundraising block in the footer */
    easyfundraisingUrl:
      "https://www.easyfundraising.org.uk/causes/doncaster-city-fc/" as string | null,
  },

  /** Canonical public URL — also set via PUBLIC_URL env var on the server */
  siteUrl: "https://doncastercity-fc.com",

  session: {
    /** Browser cookie name for the auth session */
    cookieName: "__dcfc_session",
    /** localStorage key for the cart */
    cartKey: "dcfc.cart.v1",
    /** CustomEvent name fired when the cart changes */
    cartEvent: "dcfc:cart-changed",
  },

  theme: {
    /**
     * Primary brand colour used for <meta name="theme-color">.
     * Must match --color-navy in app.css.
     */
    metaThemeColor: "#0E1F44",
  },
};
