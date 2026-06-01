import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // Public-facing site
  layout("routes/public-layout.tsx", [
    index("routes/home.tsx"),
    route("news", "routes/news-index.tsx"),
    route("news/:slug", "routes/news-article.tsx"),
    route("fixtures", "routes/fixtures.tsx"),
    route("fixtures/:id", "routes/fixture-detail.tsx"),
    route("team", "routes/team.tsx"),
    route("team/under-21s", "routes/team-u21.tsx"),
    route("team/under-18s", "routes/team-u18.tsx"),
    route("sponsors", "routes/sponsors.tsx"),
    route("partnership", "routes/partnership.tsx"),
    route("contact", "routes/contact.tsx"),
    route("pitch", "routes/pitch.tsx"),
    route("pitch/success", "routes/pitch-success.tsx"),
    route("pitch/cancel", "routes/pitch-cancel.tsx"),
    route("sponsor/success", "routes/sponsor-player-success.tsx"),
    route("sponsor/:id", "routes/sponsor-player.tsx"),
    route("shop", "routes/shop.tsx"),
    route("shop/success", "routes/shop-success.tsx"),
    route("shop/:slug", "routes/shop-product.tsx"),
    route("cart", "routes/cart.tsx"),
  ]),

  // Uploaded image serving — public, no layout, no auth
  route("uploads/:filename", "routes/serve-upload.tsx"),

  // Stripe webhook — public, no layout, no auth (signature verified)
  route("api/stripe/webhook", "routes/stripe-webhook.tsx"),

  // Admin CMS
  ...prefix("admin", [
    route("login", "routes/admin-login.tsx"),
    route("logout", "routes/admin-logout.tsx"),
    layout("routes/admin-layout.tsx", [
      index("routes/admin-dashboard.tsx"),
      route("posts", "routes/admin-posts.tsx"),
      route("posts/new", "routes/admin-posts-new.tsx"),
      route("posts/:id/edit", "routes/admin-posts-edit.tsx"),
      route("fixtures", "routes/admin-fixtures.tsx"),
      route("fixtures/new", "routes/admin-fixtures-new.tsx"),
      route("fixtures/:id/edit", "routes/admin-fixtures-edit.tsx"),
      route("players", "routes/admin-players.tsx"),
      route("players/new", "routes/admin-players-new.tsx"),
      route("players/:id/edit", "routes/admin-players-edit.tsx"),
      route("sponsors", "routes/admin-sponsors.tsx"),
      route("sponsors/new", "routes/admin-sponsors-new.tsx"),
      route("sponsors/:id/edit", "routes/admin-sponsors-edit.tsx"),
      route("coaching", "routes/admin-coaching.tsx"),
      route("coaching/new", "routes/admin-coaching-new.tsx"),
      route("coaching/:id/edit", "routes/admin-coaching-edit.tsx"),
      route("pitch", "routes/admin-pitch.tsx"),
      route("shop", "routes/admin-shop.tsx"),
      route("shop/new", "routes/admin-shop-new.tsx"),
      route("shop/:id/edit", "routes/admin-shop-edit.tsx"),
      route("orders", "routes/admin-orders.tsx"),
      route("messages", "routes/admin-messages.tsx"),
      route("media", "routes/admin-media.tsx"),
      route("stats", "routes/admin-stats.tsx"),
      route("account", "routes/admin-account.tsx"),
      route("users", "routes/admin-users.tsx"),
      route("users/new", "routes/admin-users-new.tsx"),
      route("users/:id/edit", "routes/admin-users-edit.tsx"),
      route("api/upload", "routes/admin-upload.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
