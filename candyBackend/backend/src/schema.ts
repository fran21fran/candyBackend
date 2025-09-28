import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  isPremium: boolean("is_premium").default(false),
  subscriptionDate: timestamp("subscription_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export const loginUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type User = typeof users.$inferSelect;

// Game scores table for leaderboard system
export const gameScores = pgTable("game_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameId: varchar("game_id").notNull(),
  score: integer("score").notNull().default(0),
  completionTime: integer("completion_time"), // in seconds
  difficulty: varchar("difficulty").notNull().default("Principiante"),
  language: varchar("language").notNull().default("spanish"),
  playedAt: timestamp("played_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for game scores
export const gameScoresRelations = relations(gameScores, ({ one }) => ({
  user: one(users, {
    fields: [gameScores.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  gameScores: many(gameScores),
}));

export const insertGameScoreSchema = createInsertSchema(gameScores).pick({
  gameId: true,
  score: true,
  completionTime: true,
  difficulty: true,
  language: true,
});

export type GameScore = typeof gameScores.$inferSelect;
export type InsertGameScore = z.infer<typeof insertGameScoreSchema>;

// Cultural suggestions table
export const suggestions = pgTable("suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // pelicula, cancion, comic, artista, libro, serie, podcast
  title: varchar("title").notNull(),
  artist: varchar("artist"),
  language: varchar("language").notNull(),
  description: text("description").notNull(),
  reason: text("reason"),
  submittedBy: varchar("submitted_by").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Suggestion likes table for tracking user likes
export const suggestionLikes = pgTable("suggestion_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  suggestionId: varchar("suggestion_id").notNull().references(() => suggestions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSuggestionSchema = createInsertSchema(suggestions).pick({
  type: true,
  title: true,
  artist: true,
  language: true,
  description: true,
  reason: true,
});

export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type SuggestionLike = typeof suggestionLikes.$inferSelect;
export type InsertSuggestionLike = typeof suggestionLikes.$inferInsert;