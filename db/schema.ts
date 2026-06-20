import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date());

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "editor"] })
      .notNull()
      .default("editor"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

export const media = sqliteTable("media", {
  id: id(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes").notNull(),
  alt: text("alt"),
  uploadedBy: text("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

export const posts = sqliteTable(
  "posts",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    bodyHtml: text("body_html").notNull().default(""),
    bodyJson: text("body_json", { mode: "json" }),
    heroMediaId: text("hero_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    authorId: text("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    slugIdx: uniqueIndex("posts_slug_idx").on(t.slug),
    publishedAtIdx: index("posts_published_at_idx").on(t.publishedAt),
  }),
);

export const players = sqliteTable("players", {
  id: id(),
  name: text("name").notNull(),
  team: text("team", { enum: ["first", "u23"] }).notNull().default("first"),
  position: text("position"),
  position2: text("position2"),
  shirtNumber: integer("shirt_number"),
  bio: text("bio"),
  photoMediaId: text("photo_media_id").references(() => media.id, {
    onDelete: "set null",
  }),
  sponsor1Name: text("sponsor1_name"),
  sponsor1Url: text("sponsor1_url"),
  sponsor1LogoMediaId: text("sponsor1_logo_media_id").references(
    () => media.id,
    { onDelete: "set null" },
  ),
  sponsor2Name: text("sponsor2_name"),
  sponsor2Url: text("sponsor2_url"),
  sponsor2LogoMediaId: text("sponsor2_logo_media_id").references(
    () => media.id,
    { onDelete: "set null" },
  ),
  sponsorshipUrl: text("sponsorship_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const fixtures = sqliteTable(
  "fixtures",
  {
    id: id(),
    competition: text("competition").notNull(),
    opponent: text("opponent").notNull(),
    homeAway: text("home_away", { enum: ["home", "away"] }).notNull(),
    kickoff: integer("kickoff", { mode: "timestamp" }).notNull(),
    venue: text("venue"),
    status: text("status", {
      enum: ["scheduled", "in_progress", "completed", "postponed", "cancelled"],
    })
      .notNull()
      .default("scheduled"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    notes: text("notes"),
    source: text("source", { enum: ["manual", "fwp"] })
      .notNull()
      .default("manual"),
    externalId: text("external_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    kickoffIdx: index("fixtures_kickoff_idx").on(t.kickoff),
  }),
);

export const coachingStaff = sqliteTable("coaching_staff", {
  id: id(),
  team: text("team", { enum: ["first", "u23", "u18"] }).notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  photoMediaId: text("photo_media_id").references(() => media.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sponsors = sqliteTable("sponsors", {
  id: id(),
  name: text("name").notNull(),
  url: text("url"),
  tier: text("tier", { enum: ["principal", "official", "partner"] })
    .notNull()
    .default("partner"),
  logoMediaId: text("logo_media_id").references(() => media.id, {
    onDelete: "set null",
  }),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const pitchOrders = sqliteTable("pitch_orders", {
  id: id(),
  email: text("email").notNull(),
  contactName: text("contact_name"),
  displayName: text("display_name").notNull(),
  totalPence: integer("total_pence").notNull(),
  squareCount: integer("square_count").notNull(),
  status: text("status", {
    enum: ["pending", "paid", "manual", "refunded", "cancelled"],
  })
    .notNull()
    .default("pending"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  holdExpiresAt: integer("hold_expires_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const pitchSquares = sqliteTable(
  "pitch_squares",
  {
    id: integer("id").primaryKey(),
    row: integer("row").notNull(),
    col: integer("col").notNull(),
    zone: text("zone").notNull(),
    pricePence: integer("price_pence").notNull().default(5000),
    status: text("status", { enum: ["available", "pending", "sold"] })
      .notNull()
      .default("available"),
    sponsorName: text("sponsor_name"),
    logoMediaId: text("logo_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    orderId: text("order_id").references(() => pitchOrders.id, {
      onDelete: "set null",
    }),
    updatedAt: updatedAt(),
  },
  (t) => ({
    rowColIdx: uniqueIndex("pitch_squares_row_col_idx").on(t.row, t.col),
    statusIdx: index("pitch_squares_status_idx").on(t.status),
  }),
);

export const products = sqliteTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    pricePence: integer("price_pence").notNull(),
    stock: integer("stock"),
    imageMediaId: text("image_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    stripePriceId: text("stripe_price_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    slugIdx: uniqueIndex("products_slug_idx").on(t.slug),
  }),
);

export const shopOrders = sqliteTable("shop_orders", {
  id: id(),
  email: text("email").notNull(),
  totalPence: integer("total_pence").notNull(),
  status: text("status", {
    enum: ["pending", "paid", "shipped", "refunded", "cancelled"],
  })
    .notNull()
    .default("pending"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  shippingJson: text("shipping_json", { mode: "json" }),
  lineItemsJson: text("line_items_json", { mode: "json" }).notNull(),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  shippedAt: integer("shipped_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const fwpSnapshots = sqliteTable("fwp_snapshots", {
  key: text("key").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
});

export const programmes = sqliteTable("programmes", {
  id: id(),
  fixtureId: text("fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  coverImageMediaId: text("cover_image_media_id").references(() => media.id, { onDelete: "set null" }),
  managersNotes: text("managers_notes"),
  oppositionProfile: text("opposition_profile"),
  oppositionLineup: text("opposition_lineup"),
  featuredPlayerId: text("featured_player_id").references(() => players.id, { onDelete: "set null" }),
  featuredSponsorId: text("featured_sponsor_id").references(() => sponsors.id, { onDelete: "set null" }),
  coverSponsorId: text("cover_sponsor_id").references(() => sponsors.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const programmeInterest = sqliteTable("programme_interest", {
  id: id(),
  programmeId: text("programme_id").notNull().references(() => programmes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

export const contactMessages = sqliteTable("contact_messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  ipAddress: text("ip_address"),
  handled: integer("handled", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Fixture = typeof fixtures.$inferSelect;
export type Sponsor = typeof sponsors.$inferSelect;
export type PitchSquare = typeof pitchSquares.$inferSelect;
export type PitchOrder = typeof pitchOrders.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ShopOrder = typeof shopOrders.$inferSelect;
export type Media = typeof media.$inferSelect;
export type CoachingStaff = typeof coachingStaff.$inferSelect;
export type Programme = typeof programmes.$inferSelect;
export type ProgrammeInterest = typeof programmeInterest.$inferSelect;
